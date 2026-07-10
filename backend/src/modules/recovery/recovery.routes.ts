import { Router } from 'express';
import { RecoveryController } from './recovery.controller.js';
import { authMiddleware } from '../../common/middleware/auth.middleware.js';

const router = Router();

// All recovery routes require authentication
router.use(authMiddleware);

router.post('/dlq/:jobId/replay', RecoveryController.replayJob);
router.post('/dlq/:jobId/discard', RecoveryController.discardJob);
router.get('/dashboard', RecoveryController.getDashboardStats);

export default router;
