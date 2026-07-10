import { Router } from 'express';
import { ReplayController } from './replay.controller.js';
import { TimelineController } from './timeline.controller.js';
import { authMiddleware } from '../common/middleware/auth.middleware.js';

const router = Router();

// Endpoints:
// POST /api/v1/workflows/:id/replay
router.post('/:id/replay', authMiddleware, ReplayController.replay);

// GET /api/v1/workflows/:id/timeline
router.get('/:id/timeline', authMiddleware, TimelineController.getTimeline);

export default router;
