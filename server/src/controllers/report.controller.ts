/**
 * Controller for User Moderation Reports (SRS FR-4.4).
 *
 * WHY:
 * 1. Layered Pattern: Validates request body with strict Zod schema, invokes report service,
 *    and emits standard { data: { received: true } } response envelope.
 * 2. Privacy & Confidentiality: Never returns report IDs or target author details.
 */

import { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import { sendSuccess } from '../utils/response.js';
import { createReportSchema } from '../validators/report.validators.js';
import { createReport } from '../services/report.service.js';

/**
 * POST /api/reports
 * Submits a user moderation report against a post or comment.
 * Requires authenticate + requireActive.
 */
export const createReportHandler = asyncHandler(async (req: Request, res: Response) => {
  const reporterId = req.user!.id;
  const validatedBody = createReportSchema.parse(req.body);

  const result = await createReport(reporterId, validatedBody);
  sendSuccess(res, result, 200);
});
