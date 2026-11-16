import { z } from 'zod';
import { RoutineStatus } from '@mindrise/database';

/**
 * Validation schemas for the Routines module using Zod.
 *
 * WHY: Strict input validation at the API boundary protects our database
 * and business logic from malformed inputs, malicious injections, and
 * accidental property assignment (mass-assignment vulnerability).
 */

// Title regex: Must contain at least one Unicode letter (\p{L}) or Unicode digit (\p{N}).
// WHY: We support both English and Ethiopic Unicode characters (Amharic).
// Using \p{L}|\p{N} ensures characters like 'ፀ', 'ሰ', 'a', '1' are accepted,
// while symbol-only strings like '***' or '---' are rejected.
const titleRegex = /[\p{L}\p{N}]/u;

const titleValidator = z
  .string({ required_error: 'Title is required.' })
  .trim()
  .min(1, 'Title must be at least 1 character long.')
  .max(100, 'Title cannot exceed 100 characters.')
  .refine((val) => titleRegex.test(val), {
    message: 'Title must contain at least one letter or digit (cannot be empty or symbol-only).',
  });

const optionalDescriptionValidator = z
  .string()
  .trim()
  .max(500, 'Description cannot exceed 500 characters.')
  .nullable()
  .optional();

/**
 * Schema for POST /routines (Create routine)
 * .strict() ensures unexpected/extra fields in the request body trigger a 400 VALIDATION_ERROR.
 */
export const createRoutineSchema = z
  .object({
    title: titleValidator,
    description: optionalDescriptionValidator,
  })
  .strict({ message: 'Unrecognized fields in request body.' });

/**
 * Schema for PATCH /routines/:id (Update routine)
 * Allows updating title and/or status (ACTIVE | PAUSED), and optionally description.
 * Rejects empty payloads where nothing is being updated.
 */
export const updateRoutineSchema = z
  .object({
    title: titleValidator.optional(),
    status: z.nativeEnum(RoutineStatus, {
      errorMap: () => ({ message: 'Status must be either ACTIVE or PAUSED.' }),
    }).optional(),
    description: optionalDescriptionValidator,
  })
  .strict({ message: 'Unrecognized fields in request body.' })
  .refine(
    (data) => data.title !== undefined || data.status !== undefined || data.description !== undefined,
    { message: 'At least one field (title, status, or description) must be provided for update.' }
  );

/**
 * Schema for route parameters containing a routine ID (e.g., GET/PATCH/DELETE /routines/:id)
 * WHY: Validating UUID format upfront prevents unnecessary DB queries and SQL syntax errors.
 */
export const routineIdParamSchema = z
  .object({
    id: z.string().uuid({ message: 'Routine ID must be a valid UUID.' }),
  })
  .strict();

export type CreateRoutineInput = z.infer<typeof createRoutineSchema>;
export type UpdateRoutineInput = z.infer<typeof updateRoutineSchema>;
