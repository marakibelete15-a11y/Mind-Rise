/**
 * Service Layer for Self-Assessments (SRS FR-2.1 to FR-2.5).
 *
 * WHY:
 * 1. Layered Architecture: Keeps HTTP routing/controllers detached from business
 *    logic, validation, and database operations.
 * 2. Privacy & Confidentiality (SRS 6.1): Answers are encrypted at rest with AES-256-GCM
 *    (`encryptJson`), stored in the database, and decrypted ONLY when the owning user
 *    explicitly requests their single attempt detail. List views never decrypt answers.
 * 3. Crisis Safety Hook (SRS FR-2.4): If an attempt flags risk, `crisisService.raiseFlag`
 *    is invoked asynchronously with error isolation (try/catch) so that a failure in the
 *    flag notification never fails the user's assessment result. Decrypted answers are
 *    NEVER logged or passed to logging systems.
 * 4. Anti-Tampering & No Gamification: Assessment scores are calculated server-side.
 *    No gamification points, streaks, or badges are awarded for mental health assessments.
 */

import prisma, { AssessmentDomain, CrisisPriority, CrisisSource } from '@mindrise/database';
import { AppError } from '../middleware/errorHandler.js';
import { SupportedLanguage, pickLocalized } from '../utils/localize.js';
import { encryptJson, decryptJson } from '../utils/crypto.js';
import { ClockFn, defaultClock, getAddisDayRange } from '../utils/dates.js';
import {
  scoreAssessment,
  AnswerSubmission,
  ScoringQuestionInput,
} from './assessment-scoring.js';
import { raiseFlag } from './crisis.service.js';
import {
  getLocalizedSummary,
  getLocalizedDisclaimer,
  getLocalizedEmergencyFallback,
  OPTION_LABELS,
} from '../content/assessment-summaries.js';

export interface AssessmentAttemptSummaryDTO {
  id: string;
  domain: AssessmentDomain;
  score: number;
  summaryKey: string;
  summary: string;
  createdAt: Date;
}

export interface CrisisResourceDTO {
  name: string;
  description: string;
  phone: string;
}

export interface SubmitAttemptResponseDTO {
  attempt: {
    id: string;
    domain: AssessmentDomain;
    score: number;
    summary: string;
    disclaimer: string;
    createdAt: Date;
  };
  crisis: {
    show: boolean;
    resources: CrisisResourceDTO[];
    emergencyMessage?: string;
  };
}

/**
 * Lists available assessment questionnaires (latest version per domain).
 * Localized according to requested language.
 */
export async function listTemplates(lang: SupportedLanguage = 'en') {
  const allTemplates = await prisma.assessmentTemplate.findMany({
    include: {
      _count: {
        select: { questions: true },
      },
    },
    orderBy: [
      { domain: 'asc' },
      { version: 'desc' },
    ],
  });

  // Pick highest version per domain
  const latestMap = new Map<AssessmentDomain, (typeof allTemplates)[0]>();
  for (const t of allTemplates) {
    if (!latestMap.has(t.domain)) {
      latestMap.set(t.domain, t);
    }
  }

  return Array.from(latestMap.values()).map((t) => ({
    id: t.id,
    domain: t.domain,
    version: t.version,
    title: pickLocalized(t.titleEn, t.titleAm, lang),
    description: pickLocalized(t.descriptionEn, t.descriptionAm, lang),
    questionCount: t._count.questions,
  }));
}

/**
 * Retrieves a single questionnaire template and its ordered, localized questions with answer options.
 *
 * CRITICAL CLINICAL & SECURITY RULE:
 * NEVER include scoring rules, riskThreshold, or isRiskItem in this response payload.
 */
export async function getTemplateById(templateId: string, lang: SupportedLanguage = 'en') {
  const template = await prisma.assessmentTemplate.findUnique({
    where: { id: templateId },
    include: {
      questions: {
        orderBy: { order: 'asc' },
      },
    },
  });

  if (!template) {
    throw new AppError(404, 'TEMPLATE_NOT_FOUND', 'Assessment template not found.');
  }

  const questions = template.questions.map((q) => {
    const scoringMap = (typeof q.scoring === 'object' && q.scoring !== null
      ? q.scoring
      : {}) as Record<string, unknown>;

    const options = Object.keys(scoringMap).map((key) => ({
      value: key,
      label: OPTION_LABELS[key]?.[lang] || key,
    }));

    // Strictly omit scoring, riskThreshold, and isRiskItem
    return {
      id: q.id,
      order: q.order,
      text: pickLocalized(q.textEn, q.textAm, lang),
      options,
    };
  });

  return {
    id: template.id,
    domain: template.domain,
    version: template.version,
    title: pickLocalized(template.titleEn, template.titleAm, lang),
    description: pickLocalized(template.descriptionEn, template.descriptionAm, lang),
    questions,
  };
}

/**
 * Submits answers for an assessment attempt.
 *
 * Flow:
 * 1. Validate template existence.
 * 2. Enforce light abuse limit (max 5 attempts per user per template per Addis day).
 * 3. Validate and score answers server-side via pure scoring engine.
 * 4. Encrypt raw answers at rest with AES-256-GCM.
 * 5. Persist attempt record.
 * 6. If riskFlagged, asynchronously raise crisis flag with error isolation.
 * 7. Return localized result with disclaimer and active crisis resources if indicated.
 */
export async function submitAttempt(
  userId: string,
  templateId: string,
  rawAnswers: AnswerSubmission[],
  lang: SupportedLanguage = 'en',
  clock: ClockFn = defaultClock
): Promise<SubmitAttemptResponseDTO> {
  const template = await prisma.assessmentTemplate.findUnique({
    where: { id: templateId },
    include: {
      questions: {
        orderBy: { order: 'asc' },
      },
    },
  });

  if (!template) {
    throw new AppError(404, 'TEMPLATE_NOT_FOUND', 'Assessment template not found.');
  }

  // Abuse Protection: Max 5 attempts per user per template per local Addis Ababa day
  const { startUtc, endUtc } = getAddisDayRange(clock);
  const attemptsToday = await prisma.assessmentAttempt.count({
    where: {
      userId,
      templateId,
      createdAt: {
        gte: startUtc,
        lte: endUtc,
      },
    },
  });

  if (attemptsToday >= 5) {
    throw new AppError(
      429,
      'ASSESSMENT_DAILY_LIMIT',
      'You have reached the maximum of 5 assessment attempts for this checkup today.'
    );
  }

  // Score answers server-side using pure function
  const scoringQuestions: ScoringQuestionInput[] = template.questions.map((q) => ({
    id: q.id,
    templateId: q.templateId,
    order: q.order,
    isRiskItem: q.isRiskItem,
    scoring: q.scoring,
  }));

  const { score, summaryKey, riskFlagged } = scoreAssessment(
    {
      id: template.id,
      domain: template.domain,
      riskThreshold: template.riskThreshold,
    },
    scoringQuestions,
    rawAnswers
  );

  // Encrypt answers at application layer with AES-256-GCM before saving to database
  const encryptedAnswers = encryptJson(rawAnswers);

  const attempt = await prisma.assessmentAttempt.create({
    data: {
      userId,
      templateId,
      answers: encryptedAnswers,
      score,
      summaryKey,
      riskFlagged,
    },
  });

  // Safety escalation hook (executed AFTER attempt is safely persisted)
  if (riskFlagged) {
    try {
      await raiseFlag({
        userId,
        source: CrisisSource.ASSESSMENT,
        sourceId: attempt.id,
        priority: CrisisPriority.HIGH,
      });
    } catch (err) {
      // Non-blocking: a failure in flag notification must never abort or block user response
      console.error('Crisis escalation raiseFlag failed', {
        userId,
        sourceId: attempt.id,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  // Retrieve active crisis resources if safety support is indicated
  let crisisResources: CrisisResourceDTO[] = [];
  let emergencyMessage: string | undefined = undefined;

  if (riskFlagged) {
    try {
      const activeResources = await prisma.crisisResource.findMany({
        where: { isActive: true },
        orderBy: { createdAt: 'asc' },
      });

      crisisResources = activeResources.map((r) => ({
        name: pickLocalized(r.nameEn, r.nameAm, lang),
        description: pickLocalized(r.descriptionEn, r.descriptionAm, lang),
        phone: r.phone,
      }));

      if (crisisResources.length === 0) {
        emergencyMessage = getLocalizedEmergencyFallback(lang);
      }
    } catch (err) {
      console.error('Failed to query crisis resources', {
        error: err instanceof Error ? err.message : String(err),
      });
      crisisResources = [];
      emergencyMessage = getLocalizedEmergencyFallback(lang);
    }
  }

  // Return sanitized response: NEVER expose riskFlagged field or the word 'flagged' to the user
  return {
    attempt: {
      id: attempt.id,
      domain: template.domain,
      score: attempt.score,
      summary: getLocalizedSummary(template.domain, summaryKey, lang),
      disclaimer: getLocalizedDisclaimer(lang),
      createdAt: attempt.createdAt,
    },
    crisis: {
      show: riskFlagged,
      resources: crisisResources,
      ...(emergencyMessage ? { emergencyMessage } : {}),
    },
  };
}

/**
 * Lists the caller's own assessment history, newest first, with cursor-based pagination.
 *
 * PRIVACY REQUIREMENT:
 * Decrypted answers are NEVER returned in list views.
 */
export async function listUserAttempts(
  userId: string,
  options: {
    cursor?: string;
    limit?: number;
    domain?: AssessmentDomain;
  },
  lang: SupportedLanguage = 'en'
) {
  const limit = Math.min(Math.max(options.limit ?? 20, 1), 50);

  const whereClause: {
    userId: string;
    template?: { domain: AssessmentDomain };
  } = {
    userId,
    ...(options.domain ? { template: { domain: options.domain } } : {}),
  };

  const attempts = await prisma.assessmentAttempt.findMany({
    where: whereClause,
    take: limit + 1,
    cursor: options.cursor ? { id: options.cursor } : undefined,
    skip: options.cursor ? 1 : 0,
    orderBy: { createdAt: 'desc' },
    include: {
      template: {
        select: { domain: true },
      },
    },
  });

  const hasMore = attempts.length > limit;
  const items = hasMore ? attempts.slice(0, limit) : attempts;
  const nextCursor = hasMore ? items[items.length - 1].id : null;

  const data: AssessmentAttemptSummaryDTO[] = items.map((a) => ({
    id: a.id,
    domain: a.template.domain,
    score: a.score,
    summaryKey: a.summaryKey,
    summary: getLocalizedSummary(a.template.domain, a.summaryKey, lang),
    createdAt: a.createdAt,
  }));

  return {
    items: data,
    nextCursor,
  };
}

/**
 * Retrieves a single attempt by ID.
 * Decrypts answers ONLY here and ONLY for the owning user.
 * Cross-user access returns 404 (IDOR defense).
 */
export async function getAttemptById(
  userId: string,
  attemptId: string,
  lang: SupportedLanguage = 'en'
) {
  const attempt = await prisma.assessmentAttempt.findUnique({
    where: { id: attemptId },
    include: {
      template: {
        select: { domain: true },
      },
    },
  });

  if (!attempt || attempt.userId !== userId) {
    throw new AppError(404, 'ATTEMPT_NOT_FOUND', 'Assessment attempt not found.');
  }

  // Decrypt answers only for the owner
  let answers: AnswerSubmission[] = [];
  try {
    answers = decryptJson<AnswerSubmission[]>(attempt.answers as string);
  } catch (err) {
    console.error('Failed to decrypt assessment answers', {
      attemptId: attempt.id,
      error: err instanceof Error ? err.message : String(err),
    });
    throw new AppError(500, 'DECRYPTION_ERROR', 'Unable to decrypt assessment answers.');
  }

  return {
    id: attempt.id,
    domain: attempt.template.domain,
    score: attempt.score,
    summaryKey: attempt.summaryKey,
    summary: getLocalizedSummary(attempt.template.domain, attempt.summaryKey, lang),
    disclaimer: getLocalizedDisclaimer(lang),
    answers,
    createdAt: attempt.createdAt,
  };
}

/**
 * Hard delete of an assessment attempt (SRS 6.1: user data sovereignty).
 * Cross-user requests return 404.
 */
export async function deleteAttempt(userId: string, attemptId: string) {
  const attempt = await prisma.assessmentAttempt.findUnique({
    where: { id: attemptId },
    select: { id: true, userId: true },
  });

  if (!attempt || attempt.userId !== userId) {
    throw new AppError(404, 'ATTEMPT_NOT_FOUND', 'Assessment attempt not found.');
  }

  await prisma.assessmentAttempt.delete({
    where: { id: attemptId },
  });

  return { success: true, message: 'Assessment attempt deleted successfully.' };
}
