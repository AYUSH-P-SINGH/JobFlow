import { Router } from 'express';
import { MarketplaceController } from './marketplace.controller.js';
import { authMiddleware } from '../common/middleware/auth.middleware.js';

const router = Router();

// Require authorization for all marketplace activities
router.use(authMiddleware);

// Endpoints:
// GET  /api/v1/marketplace/plugins
// POST /api/v1/marketplace/plugins
// GET  /api/v1/marketplace/templates
router.get('/plugins', MarketplaceController.listPlugins);
router.post('/plugins', MarketplaceController.uploadPlugin);
router.get('/templates', MarketplaceController.listTemplates);

export default router;
