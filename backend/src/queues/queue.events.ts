import { QueueEvents } from 'bullmq';
import { createRedisConnection } from '../config/redis.js';
import { QueueNames } from './queue.constants.js';
import { logger } from '../common/logger/logger.js';

let jobQueueEvents: QueueEvents | null = null;

/**
 * Initializes QueueEvents listener for the job processing queue.
 * Logs all queue lifecycle events for observability.
 * Workers are not yet present (Phase 6), but events still fire for
 * waiting, delayed, removed, etc.
 */
export function initQueueEvents(): QueueEvents {
  jobQueueEvents = new QueueEvents(QueueNames.JOB_QUEUE, {
    connection: createRedisConnection('queue-events:job') as any,
  });

  jobQueueEvents.on('waiting', ({ jobId }) => {
    logger.info(`Queue Event [${QueueNames.JOB_QUEUE}]: Job ${jobId} is waiting`);
  });

  jobQueueEvents.on('active', ({ jobId }) => {
    logger.info(`Queue Event [${QueueNames.JOB_QUEUE}]: Job ${jobId} is active`);
  });

  jobQueueEvents.on('completed', ({ jobId, returnvalue }) => {
    logger.info(`Queue Event [${QueueNames.JOB_QUEUE}]: Job ${jobId} completed`);
  });

  jobQueueEvents.on('failed', ({ jobId, failedReason }) => {
    logger.error(`Queue Event [${QueueNames.JOB_QUEUE}]: Job ${jobId} failed — ${failedReason}`);
  });

  jobQueueEvents.on('delayed', ({ jobId, delay }) => {
    logger.info(`Queue Event [${QueueNames.JOB_QUEUE}]: Job ${jobId} delayed by ${delay}ms`);
  });

  jobQueueEvents.on('removed', ({ jobId }) => {
    logger.info(`Queue Event [${QueueNames.JOB_QUEUE}]: Job ${jobId} removed`);
  });

  logger.info(`Queue events listener initialized for: ${QueueNames.JOB_QUEUE}`);
  return jobQueueEvents;
}

/**
 * Gracefully closes the QueueEvents listener.
 */
export async function closeQueueEvents(): Promise<void> {
  if (jobQueueEvents) {
    await jobQueueEvents.close();
    jobQueueEvents = null;
    logger.info('Queue events listener closed');
  }
}
