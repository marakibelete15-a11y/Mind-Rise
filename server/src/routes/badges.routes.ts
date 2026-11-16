import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { getAllBadges } from '../controllers/progress.controller.js';

const router = Router();

/**
 * Badges Module Routing
 *
 * WHY:
 * - Requires authentication so the system can annotate which badges have been earned by the caller.
 * - Supports ?lang=en|am for bilingual display.
 */
router.get('/', authenticate, getAllBadges);

export default router;
