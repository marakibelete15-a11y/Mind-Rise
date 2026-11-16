/**
 * Central routing configuration for MindRise API.
 *
 * WHY:
 * 1. Uniform Routing: Every API subrouter (Auth, Routines, Progress, Badges, Assessments,
 *    Community, Reports, Moderation) is mounted strictly under `/api`.
 * 2. System Health: `/health` remains accessible at root level for load balancer / container checks.
 */

import { Router } from 'express';
import healthRouter from './health.routes.js';
import authRouter from './auth.routes.js';
import usersRouter from './users.routes.js';
import assessmentsRouter from './assessments.routes.js';
import routinesRouter from './routines.routes.js';
import communityRouter from './community.routes.js';
import reportsRouter from './reports.routes.js';
import crisisRouter from './crisis.routes.js';
import moderationRouter from './moderation.routes.js';
import progressRouter from './progress.routes.js';
import badgesRouter from './badges.routes.js';

const router = Router();

// Health check endpoint (root level)
router.use('/health', healthRouter);

// Application API routes (mounted strictly under /api)
const api = Router();
api.use('/auth', authRouter);
api.use('/users', usersRouter);
api.use('/assessments', assessmentsRouter);
api.use('/routines', routinesRouter);
api.use('/progress', progressRouter);
api.use('/badges', badgesRouter);
api.use('/community', communityRouter);
api.use('/reports', reportsRouter);
api.use('/crisis', crisisRouter);
api.use('/moderation', moderationRouter);

router.use('/api', api);

export default router;
