import { Router } from 'express';
import { JobController } from './job.controller.js';
import { authMiddleware } from '../../common/middleware/auth.middleware.js';
import { validateRequest } from '../../common/middleware/validation.middleware.js';
import {
  createJobSchema,
  updateJobSchema,
  queryJobsSchema,
  jobIdParamSchema,
} from './job.validation.js';

const router = Router();

// Require authentication for all job endpoints
router.use(authMiddleware);

router.post('/', validateRequest(createJobSchema), JobController.create);
router.get('/', validateRequest(queryJobsSchema), JobController.getAll);
router.get('/:id', validateRequest(jobIdParamSchema), JobController.getById);
router.patch(
  '/:id',
  validateRequest(jobIdParamSchema),
  validateRequest(updateJobSchema),
  JobController.update
);
router.delete('/:id', validateRequest(jobIdParamSchema), JobController.delete);
router.patch('/:id/cancel', validateRequest(jobIdParamSchema), JobController.cancel);

export default router;
