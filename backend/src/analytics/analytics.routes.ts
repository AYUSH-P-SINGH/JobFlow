import { Router } from 'express';
import { AnalyticsController } from './analytics.controller.js';
import { authMiddleware } from '../common/middleware/auth.middleware.js';

const router = Router();

// Endpoint: GET /api/v1/analytics
router.get('/', authMiddleware, AnalyticsController.getAnalytics);

export default router;
