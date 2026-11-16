/**
 * Service Layer for User Moderation Reports (SRS FR-4.4).
 *
 * WHY:
 * 1. Evidence Preservation: Reports reference existing, active posts and comments. Soft-deleted content
 *    cannot be reported (404), but content reported BEFORE deletion preserves the evidence for moderators.
 * 2. Self-Harm & Abuse Prevention: Authors cannot report their own content (400 CANNOT_REPORT_OWN_CONTENT).
 * 3. Idempotency & Concurrency: Reporting the same target multiple times returns HTTP 200 without creating
 *    duplicate rows. Transactional advisory locking and P2002 error handling ensure concurrent duplicates
 *    resolve safely with exactly one database record.
 * 4. Rate Limiting: Max 20 reports per user per hour (REPORT_RATE_LIMIT, 429) prevents report spamming.
 * 5. Strict Response Anonymity: The response is strictly { received: true }. No reporter IDs, report IDs,
 *    target author IDs, or moderation statuses are ever leaked to the client.
 */

import prisma, { Report, ReportTargetType } from '@mindrise/database';
import { AppError } from '../middleware/errorHandler.js';
import { CreateReportInput } from '../validators/report.validators.js';

export interface ReportResultDTO {
  received: boolean;
}

/**
 * Report hook adapter.
 * Part A: report counting and auto-restriction (FR-7.5) plug in here.
 * Exported as an object to allow clean test spying without touching Part A.
 */
export const reportHook = {
  onReportCreated: async (report: Report): Promise<void> => {
    // Part A: report counting and auto-restriction (FR-7.5) plug in here.
    void report;
  },
};

/**
 * Submits a user moderation report on a community post or comment.
 *
 * Rules:
 * - Target must exist and not be soft-deleted (otherwise 404).
 * - User cannot report their own post or comment (400 CANNOT_REPORT_OWN_CONTENT).
 * - Enforces 20 reports/hour rate limit per user.
 * - Idempotent: repeated reports by the same reporter return { received: true } with 0 new rows.
 * - Invokes onReportCreated hook once per newly created report.
 */
export async function createReport(
  reporterId: string,
  input: CreateReportInput
): Promise<ReportResultDTO> {
  // 1. Enforce Rate Limit: Max 20 reports per user per hour
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  const reportsLastHour = await prisma.report.count({
    where: {
      reporterId,
      createdAt: { gte: oneHourAgo },
    },
  });

  if (reportsLastHour >= 20) {
    throw new AppError(
      429,
      'REPORT_RATE_LIMIT',
      'You have reached the maximum of 20 reports per hour.'
    );
  }

  // 2. Verify Target Exists and is not Soft-Deleted
  let targetAuthorId: string | null = null;

  if (input.targetType === 'POST') {
    const post = await prisma.post.findFirst({
      where: {
        id: input.targetId,
        deletedAt: null,
      },
      select: { id: true, authorId: true },
    });
    if (!post) {
      throw new AppError(404, 'TARGET_NOT_FOUND', 'Target post not found or has been removed.');
    }
    targetAuthorId = post.authorId;
  } else if (input.targetType === 'COMMENT') {
    const comment = await prisma.comment.findFirst({
      where: {
        id: input.targetId,
        deletedAt: null,
      },
      select: { id: true, authorId: true },
    });
    if (!comment) {
      throw new AppError(404, 'TARGET_NOT_FOUND', 'Target comment not found or has been removed.');
    }
    targetAuthorId = comment.authorId;
  }

  // 3. Prevent Self-Reporting
  if (targetAuthorId && targetAuthorId === reporterId) {
    throw new AppError(
      400,
      'CANNOT_REPORT_OWN_CONTENT',
      'You cannot report your own content.'
    );
  }

  // 4. Idempotent Persist with Transactional Advisory Lock
  // Uses PostgreSQL pg_advisory_xact_lock to prevent concurrent duplicate rows without schema modifications.
  let newlyCreatedReport: Report | null = null;

  try {
    const result = await prisma.$transaction(async (tx) => {
      // Advisory transaction lock scoped to (reporterId:targetId)
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`${reporterId}:${input.targetId}`}))`;

      const existing = await tx.report.findFirst({
        where: {
          reporterId,
          targetType: input.targetType as ReportTargetType,
          targetId: input.targetId,
        },
      });

      if (existing) {
        return { created: false, report: existing };
      }

      const report = await tx.report.create({
        data: {
          reporterId,
          targetType: input.targetType as ReportTargetType,
          targetId: input.targetId,
          reason: input.reason?.trim() || 'No reason provided',
        },
      });

      return { created: true, report };
    });

    if (result.created) {
      newlyCreatedReport = result.report;
    }
  } catch (err: unknown) {
    // Handle unique constraint conflict (P2002) in case a DB index is present
    if (err && typeof err === 'object' && 'code' in err && (err as { code: string }).code === 'P2002') {
      return { received: true };
    }
    throw err;
  }

  // 5. Trigger Part A Moderation Hook (once per new report)
  if (newlyCreatedReport) {
    await reportHook.onReportCreated(newlyCreatedReport);
  }

  // Strictly sanitized return: never expose reporterId, reportId, or target author info
  return { received: true };
}
