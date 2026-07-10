import { Router } from 'express';
import { PortalController } from './portal.controller.js';

const router = Router();

// Endpoints:
// GET /api/v1/portal/spec
// GET /api/v1/portal/sdks
// GET /api/v1/portal/docs
router.get('/spec', PortalController.getOpenApiSpec);
router.get('/sdks', PortalController.getSdks);
router.get('/docs', PortalController.getDocumentation);

export default router;
