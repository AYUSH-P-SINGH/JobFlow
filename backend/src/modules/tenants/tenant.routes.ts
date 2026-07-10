import { Router } from 'express';
import { TenantController } from './tenant.controller.js';
import { authMiddleware } from '../../common/middleware/auth.middleware.js';

const router = Router();

// Create new tenant (onboarding)
router.post('/', TenantController.createTenant);

// Manage API Keys under a specific tenant
router.post('/:tenantId/keys', authMiddleware, TenantController.generateApiKey);
router.get('/:tenantId/keys', authMiddleware, TenantController.listApiKeys);
router.delete('/:tenantId/keys/:keyId', authMiddleware, TenantController.revokeApiKey);
router.post('/:tenantId/keys/:keyId/rotate', authMiddleware, TenantController.rotateApiKey);

// Organization Administration APIs
router.post('/:tenantId/invite', authMiddleware, TenantController.inviteUser);
router.patch('/:tenantId/quotas', authMiddleware, TenantController.updateQuotas);
router.get('/:tenantId/billing', authMiddleware, TenantController.getBillingMetrics);

export default router;
