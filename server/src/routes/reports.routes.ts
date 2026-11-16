/**
 * Express router for User Moderation Reports (SRS FR-4.4).
 *
 * WHY:
 * 1. Active Account Requirement: All report submissions require both valid authentication
 *    and ACTIVE status (RESTRICTED and SUSPENDED users cannot report).
 * 2. Privacy & Abuse Prevention: No GET or listing routes are registered. Normal users can
 *    never view existing reports or identify authors.
 */

import { Router } from 'express';
import { authenticate, requireActive } from '../middleware/auth.js';
import { createReportHandler } from '../controllers/report.controller.js';

const router = Router();

// POST /api/reports - submit report on a post or comment
router.post('/', authenticate, requireActive, createReportHandler);

export default router;
