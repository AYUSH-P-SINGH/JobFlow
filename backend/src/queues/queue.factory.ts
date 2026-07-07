import { Queue } from 'bullmq';
import type { QueueOptions } from 'bullmq';
import { createQueueOptions } from '../config/bullmq.js';
import { QueueNames } from './queue.constants.js';
import { logger } from '../common/logger/logger.js';

/**
 * Internal registry of all queue instances.
 * Prevents creating duplicate Queue objects for the same queue name.
 */
const queueRegistry = new Map<string, Queue>();

/**
 * Creates (or retrieves) a BullMQ Queue instance for the given queue name.
 * Uses the default BullMQ configuration from config/bullmq.ts,
 * merged with any provided overrides.
 */
export function createQueue(name: QueueNames, opts?: Partial<QueueOptions>): Queue {
  if (queueRegistry.has(name)) {
    return queueRegistry.get(name)!;
  }

  const defaultOpts = createQueueOptions(name);
  const mergedOpts: QueueOptions = {
    ...defaultOpts,
    ...opts,
    connection: opts?.connection ?? defaultOpts.connection,
  };

  const queue = new Queue(name, mergedOpts);
  queueRegistry.set(name, queue);

  logger.info(`Queue created: ${name}`);
  return queue;
}

/**
 * Retrieves an existing queue instance from the registry.
 * Throws if the queue has not been created yet.
 */
export function getQueue(name: QueueNames): Queue {
  const queue = queueRegistry.get(name);
  if (!queue) {
    throw new Error(`Queue "${name}" has not been initialized. Call createQueue() first.`);
  }
  return queue;
}

/**
 * Returns all registered queue instances.
 * Useful for admin dashboards (Bull Board) and health checks.
 */
export function getAllQueues(): Queue[] {
  return Array.from(queueRegistry.values());
}

/**
 * Gracefully closes all registered queue instances and clears the registry.
 */
export async function closeAllQueues(): Promise<void> {
  const closePromises: Promise<void>[] = [];

  for (const [name, queue] of queueRegistry.entries()) {
    logger.info(`Closing queue: ${name}`);
    closePromises.push(queue.close());
  }

  await Promise.all(closePromises);
  queueRegistry.clear();
  logger.info('All queues closed');
}
