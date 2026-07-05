import { Router } from 'express';
import { AuthController } from './auth.controller.js';
import { authMiddleware } from '../../common/middleware/auth.middleware.js';
import { validateRequest } from '../../common/middleware/validation.middleware.js';
import { registerSchema, loginSchema, refreshSchema } from './auth.validation.js';

const router = Router();

router.post('/register', validateRequest(registerSchema), AuthController.register);
router.post('/login', validateRequest(loginSchema), AuthController.login);
router.post('/refresh', validateRequest(refreshSchema), AuthController.refresh);
router.get('/me', authMiddleware, AuthController.me);

export default router;
