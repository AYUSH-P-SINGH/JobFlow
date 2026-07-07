import { createJobWorker, closeJobWorker } from './worker.factory.js';
import prisma from '../prisma.js';
import { redisConnection } from '../config/redis.js';
import { logger } from '../common/logger/logger.js';

export async function initializeWorker(): Promise<void> {
  createJobWorker();
  logger.info('Worker lifecycle initialized');
}

export async function shutdownWorker(): Promise<void> {
  logger.info('Starting worker graceful shutdown sequence...');

  // 1. Close BullMQ Worker
  try {
    await closeJobWorker();
  } catch (error) {
    logger.error('Error closing BullMQ worker:', error);
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
