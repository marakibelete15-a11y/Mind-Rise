import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { getUserProgress } from '../controllers/progress.controller.js';

const router = Router();

/**
 * Progress Module Routing
 *
 * WHY:
 * - Requires authentication to identify the user and calculate their effective streak.
 * - Reads are allowed even for RESTRICTED or SUSPENDED accounts.
 */
router.get('/', authenticate, getUserProgress);

export default router;
