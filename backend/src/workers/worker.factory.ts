import { Worker } from 'bullmq';
import { QueueNames } from '../queues/queue.constants.js';
import { createRedisConnection } from '../config/redis.js';
import { ExecutionService } from '../modules/jobs/execution.service.js';
import { logger } from '../common/logger/logger.js';
import { WorkerHealthTracker } from './worker.health.js';

let jobWorker: Worker | null = null;
const specializedWorkers: Map<string, Worker> = new Map();

/**
 * Creates a BullMQ Worker for the default job processing queue.
 * Backward-compatible: works exactly as before Phase 16.
 */
export function createJobWorker(): Worker {
  if (jobWorker) {
    return jobWorker;
  }

  const concurrency = 5;
  WorkerHealthTracker.getInstance().setConcurrency(concurrency);

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
      concurrency,
    }
  );

  jobWorker.on('error', (err) => {
    logger.error('Worker internal error:', err);
  });

  logger.info(`BullMQ Worker initialized for queue: ${QueueNames.JOB_QUEUE}`);
  return jobWorker;
}

/**
 * Creates a BullMQ Worker for a specialized queue.
 * Used by Phase 16 intelligent worker management — workers subscribe
 * to queues matching their capabilities.
 */
export function createSpecializedWorker(
  queueName: string,
  concurrency: number = 5
): Worker {
  if (specializedWorkers.has(queueName)) {
    return specializedWorkers.get(queueName)!;
  }

  const tracker = WorkerHealthTracker.getInstance();

  const worker = new Worker(
    queueName,
    async (job) => {
      const { jobId } = job.data;
      logger.info(`[Specialized Worker] Picked up Job ${jobId} [Type: ${job.name}] from queue: ${queueName}`);
      await ExecutionService.executeJob(jobId, job);
    },
    {
      connection: createRedisConnection(`worker:${queueName}`) as any,
      concurrency,
    }
  );

  worker.on('error', (err) => {
    logger.error(`[Specialized Worker:${queueName}] Internal error:`, err);
  });

  specializedWorkers.set(queueName, worker);
  logger.info(`BullMQ Specialized Worker initialized for queue: ${queueName} (concurrency: ${concurrency})`);
  return worker;
}

export function getJobWorker(): Worker | null {
  return jobWorker;
}

export function getSpecializedWorkers(): Map<string, Worker> {
  return specializedWorkers;
}

export async function closeJobWorker(): Promise<void> {
  if (jobWorker) {
    await jobWorker.close();
    jobWorker = null;
    logger.info('BullMQ Worker closed');
  }
}

/**
 * Close all specialized workers gracefully.
 */
export async function closeSpecializedWorkers(): Promise<void> {
  const closePromises: Promise<void>[] = [];

  for (const [queueName, worker] of specializedWorkers.entries()) {
    logger.info(`Closing specialized worker for queue: ${queueName}`);
    closePromises.push(worker.close());
  }

  await Promise.all(closePromises);
  specializedWorkers.clear();
  logger.info(`All specialized workers closed (${closePromises.length} total)`);
}
