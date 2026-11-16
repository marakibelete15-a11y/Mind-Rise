import { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import { sendSuccess } from '../utils/response.js';
import { parsePagination } from '../utils/pagination.js';
import { resolveLanguage } from '../utils/localize.js';
import { routinesService } from '../services/routines.service.js';
import { progressService } from '../services/progress.service.js';
import {
  createRoutineSchema,
  updateRoutineSchema,
  routineIdParamSchema,
} from '../validators/routines.validators.js';

/**
 * Controller layer for the Routines module.
 *
 * WHY: Controllers are responsible for parsing HTTP inputs (params, query, body),
 * invoking validation schemas, triggering service methods, and framing HTTP responses
 * using the project's standard response envelope: { "data": ... }.
 * Controllers do not contain business rules or direct database access.
 */

/**
 * GET /routines/starter
 * Returns curated starter routines localized according to ?lang=en|am or user preference.
 */
export const getStarterRoutines = asyncHandler(async (req: Request, res: Response) => {
  // Extract user's preferred language if available on request or session
  const userLang = (req.user as { preferredLanguage?: string } | undefined)?.preferredLanguage;
  const lang = resolveLanguage(req.query.lang, userLang);

  const starters = await routinesService.getStarterRoutines(lang);
  sendSuccess(res, starters, 200);
});

/**
 * POST /routines
 * Creates a new routine. Requires authenticate + requireActive.
 */
export const createRoutine = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const validatedBody = createRoutineSchema.parse(req.body);

  const routine = await routinesService.createRoutine(userId, validatedBody);
  sendSuccess(res, routine, 201);
});

/**
 * GET /routines
 * Lists the caller's active (non-deleted) routines with cursor pagination.
 */
export const listRoutines = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const pagination = parsePagination(req.query as Record<string, unknown>);

  const result = await routinesService.getUserRoutines(userId, pagination);
  sendSuccess(res, result, 200);
});

/**
 * GET /routines/:id
 * Fetches a single routine owned by the caller.
 */
export const getRoutineById = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const { id } = routineIdParamSchema.parse(req.params);

  const routine = await routinesService.getRoutineById(userId, id);
  sendSuccess(res, routine, 200);
});

/**
 * PATCH /routines/:id
 * Updates an existing routine's title or status (ACTIVE | PAUSED).
 * Requires authenticate + requireActive.
 */
export const updateRoutine = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const { id } = routineIdParamSchema.parse(req.params);
  const validatedBody = updateRoutineSchema.parse(req.body);

  const updated = await routinesService.updateRoutine(userId, id, validatedBody);
  sendSuccess(res, updated, 200);
});

/**
 * DELETE /routines/:id
 * Soft deletes a routine by setting deletedAt.
 * Requires authenticate + requireActive.
 */
export const deleteRoutine = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const { id } = routineIdParamSchema.parse(req.params);

  const deleted = await routinesService.deleteRoutine(userId, id);
  sendSuccess(res, { message: 'Routine deleted successfully', id: deleted.id }, 200);
});

/**
 * GET /routines/today
 * Returns caller's active routines annotated with completedToday boolean.
 */
export const getTodayRoutines = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const routines = await routinesService.getTodayRoutines(userId);
  sendSuccess(res, routines, 200);
});

/**
 * POST /routines/:id/checkin
 * Records daily habit completion, awards points, updates streaks, and unlocks badges.
 * Requires authenticate + requireActive.
 */
export const checkInRoutine = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const { id } = routineIdParamSchema.parse(req.params);

  const result = await progressService.checkIn(userId, id);
  sendSuccess(res, result, 200);
});

