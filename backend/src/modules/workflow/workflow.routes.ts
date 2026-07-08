import { Router } from 'express';
import { WorkflowController } from './workflow.controller.js';
import { authMiddleware } from '../../common/middleware/auth.middleware.js';
import { validateRequest } from '../../common/middleware/validation.middleware.js';
import {
  createWorkflowSchema,
  queryWorkflowsSchema,
  workflowIdParamSchema,
} from './workflow.validation.js';

const router = Router();

// Require authentication for all workflow routes
router.use(authMiddleware);

router.post('/', validateRequest(createWorkflowSchema), WorkflowController.create);
router.get('/', validateRequest(queryWorkflowsSchema), WorkflowController.getAll);
router.get('/metrics', WorkflowController.getMetrics);
router.get('/templates', WorkflowController.getTemplates);
router.get('/:id', validateRequest(workflowIdParamSchema), WorkflowController.getById);
router.patch('/:id/cancel', validateRequest(workflowIdParamSchema), WorkflowController.cancel);
router.post('/:id/retry', validateRequest(workflowIdParamSchema), WorkflowController.retry);

export default router;
