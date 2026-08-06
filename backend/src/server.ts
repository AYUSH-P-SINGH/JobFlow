import './common/tracing/otel.js';
import app from './app.js';
import { config } from './config/env.js';
import { logger } from './common/logger/logger.js';
import { connectDatabase, disconnectDatabase } from './database.js';
import { redisConnection } from './config/redis.js';
import http from 'http';
import { initSocketServer, closeSocketServer } from './socket/socket.server.js';
import { NotificationService } from './modules/notifications/notification.service.js';
import { AuditService } from './modules/monitoring/audit.service.js';
import { MetricsService } from './modules/monitoring/metrics.service.js';
import { initJobQueue } from './queues/job.queue.js';
import { initQueueEvents, closeQueueEvents } from './queues/queue.events.js';
import { closeAllQueues } from './queues/queue.factory.js';

// Connect to database prior to listening on the server port
await connectDatabase();

// Initialize notifications, audit & metrics subscriptions
NotificationService.initSubscriptions();
AuditService.initSubscriptions();
MetricsService.initSubscriptions();

// Initialize outbound webhook dispatcher subscriptions
const { WebhookService } = await import('./modules/webhooks/webhook.service.js');
WebhookService.initDispatcher();

// Initialize BullMQ job queue and event listeners
initJobQueue();
initQueueEvents();
logger.info('BullMQ queues and event listeners initialized');

// Phase 16: Initialize Worker Registry, Discovery Service, and Health Monitor
const { WorkerRegistry } = await import('./modules/workers/scheduler/worker.registry.js');
const { WorkerDiscovery } = await import('./modules/workers/scheduler/worker.discovery.js');
const { WorkerHealthMonitor } = await import('./modules/workers/scheduler/worker.health.monitor.js');

await WorkerRegistry.initialize();
WorkerDiscovery.start();
logger.info('Worker Registry and Discovery Service initialized');

// Synchronize database cron schedules to BullMQ
const { CronService } = await import('./modules/scheduler/cron.service.js');
await CronService.initSchedules();

const httpServer = http.createServer(app);
initSocketServer(httpServer);

const server = httpServer.listen(config.port, () => {
  logger.info(`Server is running in ${config.nodeEnv} mode on port ${config.port}`);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (err: Error) => {
  logger.error(`Unhandled Promise Rejection: ${err.message}`);
  // In production, we might want to shut down and let orchestrator (K8s) restart
  logger.error(err.stack || 'No stack trace');
});

// Handle uncaught exceptions
process.on('uncaughtException', (err: Error) => {
  logger.error(`Uncaught Exception: ${err.message}`);
  logger.error(err.stack || 'No stack trace');
  process.exit(1);
});

// Handle graceful shutdown
let isShuttingDown = false;

const gracefulShutdown = (signal: string) => {
  if (isShuttingDown) {
    logger.warn(`Shutdown already in progress. Ignoring additional signal: ${signal}`);
    return;
  }
  isShuttingDown = true;
  logger.info(`Received ${signal}. Starting graceful shutdown...`);
  
  // Force shut down after 10s if connections remain active
  const timer = setTimeout(() => {
    logger.error('Could not close active connections in time, forcing shutdown');
    process.exit(1);
  }, 10000);
  timer.unref();

  server.close(async (err) => {
    if (err) {
      logger.error('Error closing HTTP server:', err);
    } else {
      logger.info('HTTP server closed.');
    }

    try {
      // Close Socket.IO first, then queue event listeners, then queues, then Redis, then DB
      await closeSocketServer();

      // Phase 16: Shut down worker management services
      WorkerDiscovery.stop();
      WorkerRegistry.shutdown();

      await closeQueueEvents();
      await closeAllQueues();

      try {
        await redisConnection.quit();
        logger.info('Redis connection closed.');
      } catch (error) {
        logger.error('Error closing Redis connection:', error);
      }

      await disconnectDatabase();
      logger.info('Graceful shutdown completed successfully.');
      process.exit(0);
    } catch (shutdownErr) {
      logger.error('Error during shutdown steps:', shutdownErr);
      process.exit(1);
    }
  });
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
