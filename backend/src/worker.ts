import dotenv from 'dotenv';
// Load environment variables before anything else
dotenv.config();

import { logger } from './common/logger/logger.js';
import prisma from './prisma.js';
import { initializeWorker, shutdownWorker } from './workers/worker.lifecycle.js';

async function bootstrap() {
  logger.info('Starting JobFlow Background Worker Process...');

  try {
    // Verify Database Connection
    await prisma.$queryRaw`SELECT 1`;
    logger.info('Worker DB Connection: SUCCESS');

    // Initialize Worker instance & listener
    await initializeWorker();
    logger.info('Worker Lifecycle: READY & LISTENING');

    // Register Shutdown hooks
    process.on('SIGINT', async () => {
      logger.info('Worker received SIGINT. Shutting down gracefully...');
      await shutdownWorker();
      process.exit(0);
    });

    process.on('SIGTERM', async () => {
      logger.info('Worker received SIGTERM. Shutting down gracefully...');
      await shutdownWorker();
      process.exit(0);
    });

  } catch (error) {
    logger.error('Worker failed to bootstrap:', error);
    process.exit(1);
  }
}

bootstrap();
