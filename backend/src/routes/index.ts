import { Router } from 'express';
import authRoutes from '../modules/auth/auth.routes.js';
import jobRoutes from '../modules/jobs/job.routes.js';
import workflowRoutes from '../modules/workflow/workflow.routes.js';
import healthRoutes from './health.routes.js';
import { createAdminRouter } from './admin.routes.js';

const router = Router();

// Root check and health metrics
router.use('/', healthRoutes);

// API v1 versioned authentication routes (e.g. /api/v1/auth/register)
router.use('/api/v1/auth', authRoutes);

// API v1 versioned job management routes
router.use('/api/v1/jobs', jobRoutes);

// API v1 versioned workflow management routes
router.use('/api/v1/workflows', workflowRoutes);

// Bull Board admin dashboard
router.use('/admin/queues', createAdminRouter());

// Expose /login and /register directly at root to satisfy basic milestone requirements
router.use('/', authRoutes);

export default router;
