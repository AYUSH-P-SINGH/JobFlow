import { Router } from 'express';
import { WorkflowController } from './workflow.controller.js';
import { TemplateController } from './template.controller.js';
import { authMiddleware } from '../../common/middleware/auth.middleware.js';
import { validateRequest } from '../../common/middleware/validation.middleware.js';
import {
  createWorkflowSchema,
  queryWorkflowsSchema,
  workflowIdParamSchema,
} from './workflow.validation.js';

const router = Router();

// Require authentication for all workflow/template routes
router.use(authMiddleware);

// Template and Versioning Routes
router.post('/templates', TemplateController.createTemplate);
router.get('/templates', TemplateController.listTemplates);
router.post('/templates/import', TemplateController.importTemplate);
router.post('/templates/:id/versions', TemplateController.createVersion);
router.post('/templates/:id/run', TemplateController.runTemplate);
router.get('/templates/:id/export', TemplateController.exportTemplate);

// Traditional Workflow Execution Routes
router.post('/', validateRequest(createWorkflowSchema), WorkflowController.create);
router.get('/', validateRequest(queryWorkflowsSchema), WorkflowController.getAll);
router.get('/metrics', WorkflowController.getMetrics);
router.get('/compare', WorkflowController.compare);
router.get('/:id', validateRequest(workflowIdParamSchema), WorkflowController.getById);
router.patch('/:id/cancel', validateRequest(workflowIdParamSchema), WorkflowController.cancel);
router.post('/:id/retry', validateRequest(workflowIdParamSchema), WorkflowController.retry);

export default router;
