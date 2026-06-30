import { Router } from 'express';
import authRoutes from './auth.routes.js';
import healthRoutes from './health.routes.js';

const router = Router();

// Root check and health metrics
router.use('/', healthRoutes);

// API v1 versioned authentication routes (e.g. /api/v1/auth/register)
router.use('/api/v1/auth', authRoutes);

// Expose /login and /register directly at root to satisfy basic milestone requirements
router.use('/', authRoutes);

export default router;
