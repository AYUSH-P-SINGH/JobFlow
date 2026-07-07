import { Worker } from 'bullmq';
import { QueueNames } from '../queues/queue.constants.js';
import { createRedisConnection } from '../config/redis.js';
import { ExecutionService } from '../modules/jobs/execution.service.js';
import { logger } from '../common/logger/logger.js';

let jobWorker: Worker | null = null;

export function createJobWorker(): Worker {
  if (jobWorker) {
    return jobWorker;
  }

  jobWorker = new Worker(
    QueueNames.JOB_QUEUE,
    async (job) => {
      // The payload structure defined in EnqueueService contains { jobId, userId, type, priority }
      const { jobId } = job.data;
      logger.info(`Worker picked up Job ${jobId} [Type: ${job.name}]`);
      await ExecutionService.executeJob(jobId, job);
    },
    {
      connection: createRedisConnection('worker:job-processing') as any,
      concurrency: 5,
    }
  );

  jobWorker.on('error', (err) => {
    logger.error('Worker internal error:', err);
  });

  logger.info(`BullMQ Worker initialized for queue: ${QueueNames.JOB_QUEUE}`);
  return jobWorker;
}

export function getJobWorker(): Worker | null {
  return jobWorker;
}

export async function closeJobWorker(): Promise<void> {
  if (jobWorker) {
    await jobWorker.close();
    jobWorker = null;
    logger.info('BullMQ Worker closed');
  }
}
