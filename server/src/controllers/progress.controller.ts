import { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import { sendSuccess } from '../utils/response.js';
import { resolveLanguage } from '../utils/localize.js';
import { progressService } from '../services/progress.service.js';

/**
 * Controller for User Progress and Badges.
 *
 * WHY:
 * - Separates gamification inspection from routine management.
 * - Localizes badge names and descriptions using the three-tier language cascade.
 * - Exposes effective streak calculation on read without side-effects.
 */

/**
 * GET /api/progress
 * Returns user points, effective streak, longest streak, last completed date, and earned badges.
 */
export const getUserProgress = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const userLang = (req.user as { preferredLanguage?: string } | undefined)?.preferredLanguage;
  const lang = resolveLanguage(req.query.lang, userLang);

  const progress = await progressService.getUserProgress(userId, lang);
  sendSuccess(res, progress, 200);
});

/**
 * GET /api/badges
 * Returns all system badges localized by language, annotated with earned boolean.
 */
export const getAllBadges = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const userLang = (req.user as { preferredLanguage?: string } | undefined)?.preferredLanguage;
  const lang = resolveLanguage(req.query.lang, userLang);

  const badges = await progressService.getAllBadges(userId, lang);
  sendSuccess(res, badges, 200);
});
