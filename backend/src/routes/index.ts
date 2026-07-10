import { Router } from 'express';
import authRoutes from '../modules/auth/auth.routes.js';
import jobRoutes from '../modules/jobs/job.routes.js';
import workflowRoutes from '../modules/workflow/workflow.routes.js';
import notificationRoutes from '../modules/notifications/notification.routes.js';
import monitoringRoutes from '../modules/monitoring/monitoring.routes.js';
import tenantRoutes from '../modules/tenants/tenant.routes.js';
import schedulerRoutes from '../modules/scheduler/scheduler.routes.js';
import webhookRoutes from '../modules/webhooks/webhook.routes.js';
import pluginRoutes from '../modules/plugins/plugin.routes.js';
import healthRoutes from './health.routes.js';
import { createAdminRouter } from './admin.routes.js';
import recoveryRoutes from '../modules/recovery/recovery.routes.js';
import { RecoveryDashboard } from '../modules/recovery/recovery-dashboard.js';
import aiRoutes from '../ai/workflow-generator/workflow-generator.routes.js';
import simulatorRoutes from '../simulator/simulator.routes.js';
import replayRoutes from '../debugger/replay.routes.js';
import { GraphQLGateway } from '../graphql/graphql.gateway.js';
import marketplaceRoutes from '../marketplace/marketplace.routes.js';
import portalRoutes from '../developer-portal/portal.routes.js';
import analyticsRoutes from '../analytics/analytics.routes.js';
import { authMiddleware } from '../common/middleware/auth.middleware.js';

const router = Router();

// Root check and health metrics
router.use('/', healthRoutes);

// API v1 versioned authentication routes (e.g. /api/v1/auth/register)
router.use('/api/v1/auth', authRoutes);

// API v1 versioned tenant and key management routes
router.use('/api/v1/tenants', tenantRoutes);

// API v1 versioned cron schedules routes
router.use('/api/v1/schedules', schedulerRoutes);

// API v1 versioned webhooks configuration and trigger routes
router.use('/api/v1/webhooks', webhookRoutes);

// API v1 versioned plugins routes
router.use('/api/v1/plugins', pluginRoutes);

// API v1 versioned job management routes
router.use('/api/v1/jobs', jobRoutes);

// API v1 versioned workflow management routes
router.use('/api/v1/workflows', workflowRoutes);
router.use('/api/v1/workflows', simulatorRoutes);
router.use('/api/v1/workflows', replayRoutes);

// API v1 versioned notifications routes
router.use('/api/v1/notifications', notificationRoutes);

// API monitoring, metrics, and timeline routes
router.use('/', monitoringRoutes);

// Bull Board admin dashboard
router.use('/admin/queues', createAdminRouter());

// Recovery Dashboard API
router.use('/api/v1/admin/recovery', recoveryRoutes);

// AI Workflow Generator API
router.use('/api/v1/ai', aiRoutes);

// GraphQL Endpoint
router.post('/graphql', authMiddleware, GraphQLGateway.handle);

// Marketplace APIs
router.use('/api/v1/marketplace', marketplaceRoutes);

// Developer Portal APIs
router.use('/api/v1/portal', portalRoutes);

// Analytics APIs
router.use('/api/v1/analytics', analyticsRoutes);

// Recovery Dashboard UI
router.get('/admin/recovery', RecoveryDashboard.serve);

// Expose /login and /register directly at root to satisfy basic milestone requirements
router.use('/', authRoutes);

export default router;
