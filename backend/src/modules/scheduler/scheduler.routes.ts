import { Router } from 'express';
import { SchedulerController } from './scheduler.controller.js';
import { authMiddleware } from '../../common/middleware/auth.middleware.js';

const router = Router();

// Protect all schedules endpoints
router.use(authMiddleware);

router.post('/', SchedulerController.createSchedule);
router.get('/', SchedulerController.listSchedules);
router.delete('/:id', SchedulerController.deleteSchedule);

export default router;
