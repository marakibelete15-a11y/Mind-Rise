/**
 * Validation schema for User Moderation Reports (SRS FR-4.4).
 *
 * WHY:
 * 1. Strict Payload Integrity: Unknown fields are strictly rejected (.strict()).
 * 2. Privacy by Design: Only POST and COMMENT target types are exposed. ACCOUNT reports are intentionally
 *    omitted because public user IDs are never exposed in the community API (SRS FR-4.1). Moderators
 *    reach the author through the reported content.
 * 3. Input Validation: targetId must be a valid UUID. The reason is optional free text (max 500 characters)
 *    and, if provided, must contain alphanumeric characters (disallowing whitespace/punctuation-only spam).
 */

import { z } from 'zod';

export const createReportSchema = z
  .object({
    targetType: z.enum(['POST', 'COMMENT'], {
      errorMap: () => ({
        message: 'targetType must be either POST or COMMENT.',
      }),
    }),
    targetId: z.string().uuid('targetId must be a valid UUID.'),
    reason: z
      .string()
      .trim()
      .max(500, 'Reason must not exceed 500 characters.')
      .refine(
        (val) => val.length === 0 || /[\p{L}\p{N}]/u.test(val),
        'Reason must contain letters or numbers.'
      )
      .optional(),
  })
  .strict();

export type CreateReportInput = z.infer<typeof createReportSchema>;
