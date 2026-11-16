/**
 * Pure scoring engine for MindRise self-assessments (SRS FR-2.2, FR-2.4).
 *
 * WHY:
 * 1. Purity: This module is isolated with zero external network or database dependencies.
 *    Keeping scoring as a pure function (input -> output) makes clinical calculations
 *    deterministic, easy to unit test, and impossible to tamper with from client input.
 * 2. Security & Anti-Cheating: The server ALWAYS computes the score from the validated
 *    answers and the stored template scoring rules; any client-supplied scores are ignored.
 * 3. Crisis Safety: Triage risk is triggered if the total score meets/exceeds the template
 *    riskThreshold OR if any critical safety question (`isRiskItem: true`) is answered
 *    above its safe value (safe = 0, indicating 'never' / 'not at all').
 */

import { AssessmentDomain } from '@mindrise/database';
import { AppError } from '../middleware/errorHandler.js';
import { SummaryBandKey } from '../content/assessment-summaries.js';

export interface ScoringTemplateInput {
  id: string;
  domain: AssessmentDomain;
  riskThreshold: number;
}

export interface ScoringQuestionInput {
  id: string;
  templateId: string;
  order: number;
  isRiskItem: boolean;
  scoring: unknown;
}

export interface AnswerSubmission {
  questionId: string;
  value: string | number;
  score?: unknown; // Any client-provided score field will be ignored
}

export interface AssessmentScoringResult {
  score: number;
  summaryKey: SummaryBandKey;
  riskFlagged: boolean;
  questionScores: Map<string, number>;
}

/**
 * Safe baseline score for any critical screening question (isRiskItem).
 * In psychiatric triage, 0 denotes absence of the risk indicator (e.g. 'never', 'not at all').
 * Any endorsement score > 0 represents an answer above the safe value.
 */
export const SAFE_RISK_ITEM_VALUE = 0;

/**
 * Pure function to score an assessment attempt.
 *
 * Validates:
 * - Every question belonging to the template is answered exactly once.
 * - No unknown question IDs are present.
 * - No duplicate question IDs are present.
 * - Every answer value is valid for that specific question's scoring map.
 *
 * Throws AppError(400, 'INVALID_ASSESSMENT_ANSWERS') on any validation discrepancy.
 */
export function scoreAssessment(
  template: ScoringTemplateInput,
  questions: ScoringQuestionInput[],
  answers: AnswerSubmission[]
): AssessmentScoringResult {
  if (!questions || questions.length === 0) {
    throw new AppError(500, 'TEMPLATE_CONFIGURATION_ERROR', 'Assessment template has no questions.');
  }

  // 1. Validate Answer Set Completeness & Uniqueness
  const questionMap = new Map<string, ScoringQuestionInput>();
  for (const q of questions) {
    questionMap.set(q.id, q);
  }

  if (answers.length !== questions.length) {
    throw new AppError(
      400,
      'INVALID_ASSESSMENT_ANSWERS',
      `Assessment requires exactly ${questions.length} answers, but ${answers.length} were provided.`
    );
  }

  const seenQuestionIds = new Set<string>();
  for (const ans of answers) {
    if (!ans || typeof ans.questionId !== 'string') {
      throw new AppError(400, 'INVALID_ASSESSMENT_ANSWERS', 'Each answer must specify a questionId.');
    }

    if (seenQuestionIds.has(ans.questionId)) {
      throw new AppError(
        400,
        'INVALID_ASSESSMENT_ANSWERS',
        `Duplicate answer provided for question ID ${ans.questionId}.`
      );
    }
    seenQuestionIds.add(ans.questionId);

    if (!questionMap.has(ans.questionId)) {
      throw new AppError(
        400,
        'INVALID_ASSESSMENT_ANSWERS',
        `Question ID ${ans.questionId} does not belong to this assessment.`
      );
    }
  }

  // 2. Score Each Question Individually
  let totalScore = 0;
  let hasCriticalRiskItem = false;
  const questionScores = new Map<string, number>();

  for (const ans of answers) {
    const question = questionMap.get(ans.questionId)!;
    const scoringMap = (typeof question.scoring === 'object' && question.scoring !== null
      ? (question.scoring as Record<string, unknown>)
      : {}) as Record<string, unknown>;

    let itemScore: number | null = null;

    if (typeof ans.value === 'string') {
      // Option key match (e.g. 'rarely', 'sometimes', 'always')
      if (Object.prototype.hasOwnProperty.call(scoringMap, ans.value)) {
        const val = scoringMap[ans.value];
        if (typeof val === 'number') {
          itemScore = val;
        }
      }
    } else if (typeof ans.value === 'number') {
      // Direct numeric value match against one of the allowed scores
      const allowedNumericScores = Object.values(scoringMap).filter(
        (v): v is number => typeof v === 'number'
      );
      if (allowedNumericScores.includes(ans.value)) {
        itemScore = ans.value;
      }
    }

    if (itemScore === null) {
      throw new AppError(
        400,
        'INVALID_ASSESSMENT_ANSWERS',
        `Invalid or out-of-range value '${String(ans.value)}' for question ${question.order}.`
      );
    }

    questionScores.set(question.id, itemScore);
    totalScore += itemScore;

    // Evaluate risk flag on individual critical items
    if (question.isRiskItem && itemScore > SAFE_RISK_ITEM_VALUE) {
      hasCriticalRiskItem = true;
    }
  }

  // 3. Determine Overall Risk Escalation
  // riskFlagged is true if total score meets threshold OR any risk item is elevated
  const riskFlagged = totalScore >= template.riskThreshold || hasCriticalRiskItem;

  // 4. Map Total Score to Non-Diagnostic Summary Band
  const lowThreshold = Math.ceil(template.riskThreshold * 0.5);
  let summaryKey: SummaryBandKey = 'LOW';
  if (totalScore >= template.riskThreshold) {
    summaryKey = 'HIGH';
  } else if (totalScore >= lowThreshold) {
    summaryKey = 'MODERATE';
  }

  return {
    score: totalScore,
    summaryKey,
    riskFlagged,
    questionScores,
  };
}
