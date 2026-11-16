/**
 * Validation schemas for the Anonymous Community module (SRS FR-4.1, 4.2).
 *
 * WHY:
 * 1. Strict Payload Sanitization: `.strict()` rejects unknown or unexpected keys.
 * 2. Unicode Letter/Number Requirement: Refuses empty or punctuation-only spam titles
 *    and bodies while allowing natural Amharic (Ethiopic) and English scripts.
 * 3. Bounded Field Lengths: Protects the database from unbounded payloads (max 150 chars
 *    for titles, 5,000 chars for post content, 1,000 chars for comments).
 */

import { z } from 'zod';

const unicodeTextRefinement = (val: string) => /[\p{L}\p{N}]/u.test(val);

export const createPostSchema = z
  .object({
    topicId: z.string().uuid('topicId must be a valid UUID.'),
    title: z
      .string()
      .trim()
      .min(1, 'Title cannot be empty.')
      .max(150, 'Title cannot exceed 150 characters.')
      .refine(unicodeTextRefinement, {
        message: 'Title must contain at least one letter or number.',
      }),
    content: z
      .string()
      .trim()
      .min(1, 'Content cannot be empty.')
      .max(5000, 'Content cannot exceed 5000 characters.')
      .refine(unicodeTextRefinement, {
        message: 'Content must contain at least one letter or number.',
      }),
  })
  .strict();

export const createCommentSchema = z
  .object({
    content: z
      .string()
      .trim()
      .min(1, 'Content cannot be empty.')
      .max(1000, 'Content cannot exceed 1000 characters.')
      .refine(unicodeTextRefinement, {
        message: 'Content must contain at least one letter or number.',
      }),
  })
  .strict();

export const feedQuerySchema = z
  .object({
    cursor: z.string().uuid().optional(),
    limit: z.coerce.number().int().min(1).max(50).default(20),
    topicId: z.string().uuid().optional(),
  })
  .strict();

export const commentsQuerySchema = z
  .object({
    cursor: z.string().uuid().optional(),
    limit: z.coerce.number().int().min(1).max(50).default(20),
  })
  .strict();

export const postIdParamSchema = z
  .object({
    id: z.string().uuid('Post ID must be a valid UUID.'),
  })
  .strict();

export const commentIdParamSchema = z
  .object({
    id: z.string().uuid('Comment ID must be a valid UUID.'),
  })
  .strict();
