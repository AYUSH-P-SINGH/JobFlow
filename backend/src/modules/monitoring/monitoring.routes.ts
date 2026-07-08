import { Router } from 'express';
import { MetricsController } from './metrics.controller.js';
import { authMiddleware } from '../../common/middleware/auth.middleware.js';
import { ForbiddenError } from '../../common/errors/errors.js';

const router = Router();

// Middleware to restrict access to ADMIN role only
const adminOnly = (req: any, res: any, next: any) => {
  if (req.user?.role !== 'ADMIN') {
    return next(new ForbiddenError('Access forbidden: Admins only'));
  }
  next();
};

// Prometheus scraper endpoint (publicly accessible)
router.get('/metrics', MetricsController.prometheus);

// Secure all operational dashboard and query endpoints
router.use('/api/v1/monitoring', authMiddleware);

router.get('/api/v1/monitoring/dashboard', adminOnly, MetricsController.dashboard);
router.get('/api/v1/monitoring/queues', adminOnly, MetricsController.queues);
router.get('/api/v1/monitoring/workflows', adminOnly, MetricsController.workflows);
router.get('/api/v1/monitoring/workers', adminOnly, MetricsController.workers);
router.get('/api/v1/monitoring/logs', adminOnly, MetricsController.logs);

// Timeline is authenticated but checked at workflow level inside the service
router.get('/api/v1/monitoring/workflows/:id/timeline', MetricsController.timeline);

export default router;
