import app from './app.js';
import { config } from './config/env.js';
import { logger } from './common/logger/logger.js';
import { connectDatabase, disconnectDatabase } from './database.js';
import { redisConnection } from './config/redis.js';
import { initJobQueue } from './queues/job.queue.js';
import { initQueueEvents, closeQueueEvents } from './queues/queue.events.js';
import { closeAllQueues } from './queues/queue.factory.js';

// Connect to database prior to listening on the server port
await connectDatabase();

// Initialize BullMQ job queue and event listeners
initJobQueue();
initQueueEvents();
logger.info('BullMQ queues and event listeners initialized');

const server = app.listen(config.port, () => {
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
const gracefulShutdown = (signal: string) => {
  logger.info(`Received ${signal}. Starting graceful shutdown...`);
  
  server.close(async () => {
    logger.info('HTTP server closed.');

    // Close queue event listeners first, then queues, then Redis, then DB
    await closeQueueEvents();
    await closeAllQueues();

    try {
      await redisConnection.quit();
      logger.info('Redis connection closed.');
    } catch (error) {
      logger.error('Error closing Redis connection:', error);
    }

    await disconnectDatabase();
    process.exit(0);
  });

  // Force shut down after 10s if connections remain active
  setTimeout(async () => {
    logger.error('Could not close active connections in time, forcing shutdown');
    await disconnectDatabase();
    process.exit(1);
  }, 10000);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
