import type { QueueOptions, DefaultJobOptions } from 'bullmq';
import { createRedisConnection } from './redis.js';

/**
 * Default job options applied to every job added to any BullMQ queue.
 * Individual queues or jobs can override these at add-time.
 */
export const defaultJobOptions: DefaultJobOptions = {
  attempts: 3,
  backoff: {
    type: 'exponential',
    delay: 1000,
  },
  removeOnComplete: {
    count: 1000, // Keep last 1000 completed jobs for debugging
  },
  removeOnFail: {
    count: 5000, // Keep last 5000 failed jobs for analysis
  },
};

/**
 * Creates BullMQ QueueOptions with a fresh Redis connection.
 * Each queue gets its own connection as recommended by BullMQ docs.
 */
export function createQueueOptions(queueName: string): QueueOptions {
  return {
    connection: createRedisConnection(`queue:${queueName}`) as any,
    defaultJobOptions,
  };
}
