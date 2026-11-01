import { Router } from 'express';
import healthRouter from './health.routes.js';
import authRouter from './auth.routes.js'; import usersRouter from './users.routes.js'; import assessmentsRouter from './assessments.routes.js'; import routinesRouter from './routines.routes.js'; import communityRouter from './community.routes.js'; import reportsRouter from './reports.routes.js'; import crisisRouter from './crisis.routes.js'; import moderationRouter from './moderation.routes.js';
const router=Router();
router.use('/health',healthRouter);
const api=Router(); api.use('/auth',authRouter); api.use('/users',usersRouter); api.use('/assessments',assessmentsRouter); api.use('/routines',routinesRouter); api.use('/community',communityRouter); api.use('/reports',reportsRouter); api.use('/crisis',crisisRouter); api.use('/moderation',moderationRouter); router.use('/api',api);
export default router;
