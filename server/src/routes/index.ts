import { Router } from 'express';
import healthRouter from './health.routes.js';

const router = Router();

// Root level health check
router.use('/health', healthRouter);

// API v1 placeholder
router.get('/api', (_req, res) => {
  res.json({
    name: 'MindRise API',
    version: 'v1',
    status: 'active',
  });
});

export default router;
