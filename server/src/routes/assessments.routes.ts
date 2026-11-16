/**
 * Routes for the Self-Assessment module (SRS FR-2.1 to FR-2.5).
 *
 * WHY:
 * 1. Fixed-route declaration order: We declare `/attempts` and `/attempts/:id` BEFORE
 *    `/:id` to prevent Express route matching from mistaking the literal string 'attempts'
 *    for a template UUID parameter.
 * 2. Status accessibility: We use `authenticate` without `requireActive`.
 *    Users with RESTRICTED accounts must always be permitted to perform confidential
 *    self-assessments and receive safety crisis support.
 */

import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import {
  listTemplatesHandler,
  getTemplateByIdHandler,
  submitAttemptHandler,
  listUserAttemptsHandler,
  getAttemptByIdHandler,
  deleteAttemptHandler,
} from '../controllers/assessments.controller.js';

const router = Router();

// All self-assessment routes require an authenticated user
router.use(authenticate);

// ---------------------------------------------------------------------------
// 1. User Attempt History & Detail (Fixed paths declared BEFORE /:id)
// ---------------------------------------------------------------------------
router.get('/attempts', listUserAttemptsHandler);
router.get('/attempts/:id', getAttemptByIdHandler);
router.delete('/attempts/:id', deleteAttemptHandler);

// ---------------------------------------------------------------------------
// 2. Assessment Questionnaires & Submissions
// ---------------------------------------------------------------------------
router.get('/', listTemplatesHandler);
router.get('/:id', getTemplateByIdHandler);
router.post('/:id/attempts', submitAttemptHandler);

export default router;
