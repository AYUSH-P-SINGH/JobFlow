import { Queue } from 'bullmq';
import { createQueue } from './queue.factory.js';
import { QueueNames } from './queue.constants.js';

/**
 * The primary job processing queue.
 * All jobs created via the API are enqueued here.
 * Workers (Phase 6) will consume from this queue.
 */
let jobQueue: Queue;

/**
 * Initializes the job queue instance.
 * Must be called once during application startup (in server.ts).
 */
export function initJobQueue(): Queue {
  jobQueue = createQueue(QueueNames.JOB_QUEUE);
  return jobQueue;
}

/**
 * Returns the initialized job queue instance.
 * Throws if initJobQueue() has not been called.
 */
export function getJobQueue(): Queue {
  if (!jobQueue) {
    throw new Error('Job queue has not been initialized. Call initJobQueue() first.');
  }
  return jobQueue;
}
