/**
 * Validation schemas for Self-Assessment endpoints (SRS FR-2.1 to FR-2.5).
 *
 * WHY:
 * 1. Strict payload sanitization: `.strict()` rejects unexpected or malicious fields,
 *    preventing client injection of scores or tampering with server-calculated results.
 * 2. Type integrity: Validates UUIDs and value types (string/number) before passing
 *    to the service layer.
 */

import { z } from 'zod';
import { AssessmentDomain } from '@mindrise/database';

export const submitAttemptSchema = z
  .object({
    answers: z
      .array(
        z
          .object({
            questionId: z.string().uuid('Each questionId must be a valid UUID.'),
            value: z.union([z.string().min(1), z.number()]),
          })
          .strict()
      )
      .min(1, 'At least one answer must be provided.'),
  })
  .strict();

export const attemptsQuerySchema = z
  .object({
    cursor: z.string().uuid().optional(),
    limit: z.coerce.number().int().min(1).max(50).default(20),
    domain: z.nativeEnum(AssessmentDomain).optional(),
    lang: z.enum(['en', 'am']).optional(),
  })
  .strict();

export const uuidParamSchema = z
  .object({
    id: z.string().uuid('ID must be a valid UUID.'),
  })
  .strict();
