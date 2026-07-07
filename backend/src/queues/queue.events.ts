import { QueueEvents } from 'bullmq';
import { createRedisConnection } from '../config/redis.js';
import { QueueNames } from './queue.constants.js';
import { logger } from '../common/logger/logger.js';
import { jobRepository } from '../modules/jobs/job.repository.js';
import { JobStatus } from '../modules/jobs/job.types.js';

let jobQueueEvents: QueueEvents | null = null;

/**
 * Initializes QueueEvents listener for the job processing queue.
 * Logs all queue lifecycle events for observability and synchronizes
 * status with PostgreSQL database.
 */
export function initQueueEvents(): QueueEvents {
  jobQueueEvents = new QueueEvents(QueueNames.JOB_QUEUE, {
    connection: createRedisConnection('queue-events:job') as any,
  });

  jobQueueEvents.on('waiting', ({ jobId }) => {
    logger.info(`Queue Event [${QueueNames.JOB_QUEUE}]: Job ${jobId} is waiting`);
  });

  jobQueueEvents.on('active', async ({ jobId }) => {
    logger.info(`Queue Event [${QueueNames.JOB_QUEUE}]: Job ${jobId} is active`);
    try {
      const dbJob = await jobRepository.findById(jobId);
      if (dbJob && dbJob.status !== JobStatus.RUNNING && dbJob.status !== JobStatus.COMPLETED && dbJob.status !== JobStatus.FAILED) {
        await jobRepository.updateStatus(jobId, JobStatus.RUNNING, undefined, new Date());
        logger.info(`[QueueEvents] Synced Job ${jobId} to RUNNING`);
      }
    } catch (err) {
      logger.error(`[QueueEvents] Failed to sync Job ${jobId} active state: ${(err as Error).message}`);
    }
  });

  jobQueueEvents.on('completed', async ({ jobId, returnvalue }) => {
    logger.info(`Queue Event [${QueueNames.JOB_QUEUE}]: Job ${jobId} completed`);
    try {
      const dbJob = await jobRepository.findById(jobId);
      if (dbJob && dbJob.status !== JobStatus.COMPLETED) {
        await jobRepository.updateStatus(jobId, JobStatus.COMPLETED, undefined, undefined, new Date());
        logger.info(`[QueueEvents] Synced Job ${jobId} to COMPLETED`);
      }
    } catch (err) {
      logger.error(`[QueueEvents] Failed to sync Job ${jobId} completed state: ${(err as Error).message}`);
    }
  });

  jobQueueEvents.on('failed', async ({ jobId, failedReason }) => {
    logger.error(`Queue Event [${QueueNames.JOB_QUEUE}]: Job ${jobId} failed — ${failedReason}`);
    try {
      const dbJob = await jobRepository.findById(jobId);
      if (dbJob && dbJob.status !== JobStatus.FAILED) {
        const attempts = 1; // Fallback
        const errorPayload = {
          message: failedReason || 'Unknown execution failure',
          attempts,
        };
        await jobRepository.updateStatus(jobId, JobStatus.FAILED, errorPayload, undefined, new Date());
        logger.info(`[QueueEvents] Synced Job ${jobId} to FAILED`);
      }
    } catch (err) {
      logger.error(`[QueueEvents] Failed to sync Job ${jobId} failed state: ${(err as Error).message}`);
    }
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
