import { Router } from 'express';
import { NotificationController } from './notification.controller.js';
import { authMiddleware } from '../../common/middleware/auth.middleware.js';

const router = Router();

// Secure all routes with authentication middleware
router.use(authMiddleware);

router.get('/', NotificationController.list);
router.patch('/:id/read', NotificationController.markRead);
router.delete('/:id', NotificationController.delete);

export default router;
