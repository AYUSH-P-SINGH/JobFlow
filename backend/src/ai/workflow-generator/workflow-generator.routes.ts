import { Router } from 'express';
import { WorkflowGeneratorController } from './workflow-generator.controller.js';
import { authMiddleware } from '../../common/middleware/auth.middleware.js';

const router = Router();

// Endpoint: POST /api/v1/ai/generate
router.post('/generate', authMiddleware, WorkflowGeneratorController.generateWorkflow);

export default router;
