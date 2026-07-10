import { createJobWorker, closeJobWorker } from './worker.factory.js';
import { startCronWorker, stopCronWorker } from '../modules/scheduler/cron.runner.js';
import prisma from '../prisma.js';
import { redisConnection } from '../config/redis.js';
import { logger } from '../common/logger/logger.js';
import { RecoveryService } from '../modules/recovery/recovery.service.js';
import { RetentionService } from '../modules/governance/retention.service.js';
import '../modules/plugins/plugin.manager.js';

export async function initializeWorker(): Promise<void> {
  createJobWorker();
  startCronWorker();
  logger.info('Worker lifecycle initialized');

  // Run database-backed workflow recovery scan on startup
  RecoveryService.recoverRunningWorkflows().catch((err) => {
    logger.error('Error running startup recovery scan:', err);
  });

  // Run data retention cleanup once on startup
  RetentionService.runCleanup().catch((err) => {
    logger.error('Error running startup data retention cleanup:', err);
  });

  // Run data retention cleanup periodically every 24 hours
  setInterval(() => {
    RetentionService.runCleanup().catch((err) => {
      logger.error('Error running periodic data retention cleanup:', err);
    });
  }, 24 * 60 * 60 * 1000);
}

export async function shutdownWorker(): Promise<void> {
  logger.info('Starting worker graceful shutdown sequence...');

  // 1. Close BullMQ Workers
  try {
    await closeJobWorker();
  } catch (error) {
    logger.error('Error closing BullMQ worker:', error);
  }

  try {
    await stopCronWorker();
  } catch (error) {
    logger.error('Error closing Cron scheduler worker:', error);
  }

  // 2. Disconnect database client
  try {
    await prisma.$disconnect();
    logger.info('Prisma Database disconnected');
  } catch (error) {
    logger.error('Error disconnecting Prisma:', error);
  }

  // 3. Disconnect shared Redis connection
  try {
    await redisConnection.quit();
    logger.info('Redis connection disconnected');
  } catch (error) {
    logger.error('Error disconnecting Redis:', error);
  }

  logger.info('Worker graceful shutdown complete');
}
