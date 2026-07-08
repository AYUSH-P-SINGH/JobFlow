import { Router } from 'express';
import { WebhookController } from './webhook.controller.js';
import { authMiddleware } from '../../common/middleware/auth.middleware.js';

const router = Router();

// Public inbound webhook endpoint (triggered by external integrations, e.g. GitHub/Stripe)
router.post('/inbound/:webhookId', WebhookController.handleInboundWebhook);

// Protected webhook management endpoints
router.post('/', authMiddleware, WebhookController.createWebhook);
router.get('/', authMiddleware, WebhookController.listWebhooks);
router.delete('/:id', authMiddleware, WebhookController.deleteWebhook);

export default router;
