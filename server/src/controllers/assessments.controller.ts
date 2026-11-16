/**
 * Controller for Self-Assessment endpoints (SRS FR-2.1 to FR-2.5).
 *
 * WHY:
 * 1. Delegates to assessments service: parses query, params, and body, invokes Zod validation,
 *    and frames responses inside standard `{ data: ... }` envelope.
 * 2. Privacy: Neither this layer nor the service leaks `riskFlagged` status or logs decrypted answers.
 * 3. Status compliance: Does NOT enforce `requireActive`, allowing RESTRICTED users access to self-assessments.
 */

import { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import { sendSuccess } from '../utils/response.js';
import { resolveLanguage } from '../utils/localize.js';
import {
  listTemplates,
  getTemplateById,
  submitAttempt,
  listUserAttempts,
  getAttemptById,
  deleteAttempt,
} from '../services/assessments.service.js';
import {
  submitAttemptSchema,
  attemptsQuerySchema,
  uuidParamSchema,
} from '../validators/assessments.validators.js';

/**
 * GET /api/assessments
 * Returns latest questionnaire version per domain with question count and localized titles.
 */
export const listTemplatesHandler = asyncHandler(async (req: Request, res: Response) => {
  const userLang = (req.user as { preferredLanguage?: string } | undefined)?.preferredLanguage;
  const lang = resolveLanguage(req.query.lang, userLang);

  const templates = await listTemplates(lang);
  sendSuccess(res, templates, 200);
});

/**
 * GET /api/assessments/:id
 * Returns a single template with ordered, localized questions and answer options.
 * Omits all scoring rules, risk threshold, and risk flags.
 */
export const getTemplateByIdHandler = asyncHandler(async (req: Request, res: Response) => {
  const { id } = uuidParamSchema.parse(req.params);
  const userLang = (req.user as { preferredLanguage?: string } | undefined)?.preferredLanguage;
  const lang = resolveLanguage(req.query.lang, userLang);

  const template = await getTemplateById(id, lang);
  sendSuccess(res, template, 200);
});

/**
 * POST /api/assessments/:id/attempts
 * Submits an assessment attempt. Encrypts answers at rest, calculates score server-side,
 * raises crisis flag if needed, and returns localized non-diagnostic summary.
 */
export const submitAttemptHandler = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const { id } = uuidParamSchema.parse(req.params);
  const validatedBody = submitAttemptSchema.parse(req.body);
  const userLang = (req.user as { preferredLanguage?: string } | undefined)?.preferredLanguage;
  const lang = resolveLanguage(req.query.lang, userLang);

  const result = await submitAttempt(userId, id, validatedBody.answers, lang);
  sendSuccess(res, result, 201);
});

/**
 * GET /api/assessments/attempts
 * Returns caller's own attempt history, newest first, with cursor pagination.
 * Decrypted answers are omitted from list.
 */
export const listUserAttemptsHandler = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const query = attemptsQuerySchema.parse(req.query);
  const userLang = (req.user as { preferredLanguage?: string } | undefined)?.preferredLanguage;
  const lang = resolveLanguage(query.lang, userLang);

  const result = await listUserAttempts(
    userId,
    {
      cursor: query.cursor,
      limit: query.limit,
      domain: query.domain,
    },
    lang
  );
  sendSuccess(res, result, 200);
});

/**
 * GET /api/assessments/attempts/:id
 * Returns a single attempt owned by caller with decrypted answers.
 */
export const getAttemptByIdHandler = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const { id } = uuidParamSchema.parse(req.params);
  const userLang = (req.user as { preferredLanguage?: string } | undefined)?.preferredLanguage;
  const lang = resolveLanguage(req.query.lang, userLang);

  const attempt = await getAttemptById(userId, id, lang);
  sendSuccess(res, attempt, 200);
});

/**
 * DELETE /api/assessments/attempts/:id
 * Permanently deletes caller's assessment attempt (user data sovereignty).
 */
export const deleteAttemptHandler = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const { id } = uuidParamSchema.parse(req.params);

  const result = await deleteAttempt(userId, id);
  sendSuccess(res, result, 200);
});
