import { Router } from 'express';
import { AuthController } from './auth.controller.js';
import { authMiddleware } from '../../common/middleware/auth.middleware.js';

const router = Router();

router.post('/register', AuthController.register);
router.post('/login', AuthController.login);
router.post('/refresh', AuthController.refresh);
router.get('/me', authMiddleware, AuthController.me);

export default router;
