import { Router } from 'express';
import { SimulatorController } from './simulator.controller.js';
import { authMiddleware } from '../common/middleware/auth.middleware.js';

const router = Router();

// Endpoint: POST /api/v1/workflows/simulate (mounted in workflow routes or gateway router)
router.post('/simulate', authMiddleware, SimulatorController.simulateWorkflow);

export default router;
