import { QueueNames } from './queue.constants.js';
import { logger } from '../common/logger/logger.js';

/**
 * Queue Partitioner
 *
 * Maps job types to their specialized BullMQ queues.
 * Workers subscribe only to queues matching their capabilities.
 */

/** Mapping from job type (uppercase) to specialized queue name */
const JOB_TYPE_QUEUE_MAP: Record<string, QueueNames> = {
  EMAIL: QueueNames.EMAIL_PROCESSING,
  PDF: QueueNames.PDF_PROCESSING,
  IMAGE: QueueNames.IMAGE_PROCESSING,
  AI: QueueNames.AI_PROCESSING,
  REPORT: QueueNames.REPORT_PROCESSING,
  NOTIFICATION: QueueNames.NOTIFICATION_PROCESSING,
  VIDEO: QueueNames.VIDEO_PROCESSING,
};

export class QueuePartitioner {
  /**
   * Get the specialized queue name for a given job type.
   * Falls back to the default processing queue if no mapping exists.
   */
  static getQueueForJobType(jobType: string): string {
    const normalized = jobType.toUpperCase();
    const queue = JOB_TYPE_QUEUE_MAP[normalized];

    if (queue) {
      return queue;
    }

    // Fallback to the legacy job-processing queue for backward compatibility
    return QueueNames.JOB_QUEUE;
  }

  /**
   * Get all specialized queue names that a worker should subscribe to,
   * based on its supported job types.
   */
  static getQueuesForJobTypes(supportedJobs: string[]): string[] {
    const queues = new Set<string>();

    for (const jobType of supportedJobs) {
      queues.add(this.getQueueForJobType(jobType));
    }

    // Always include the default queue as a fallback
    queues.add(QueueNames.JOB_QUEUE);

    return Array.from(queues);
  }

  /**
   * Get all known specialized queue names.
   */
  static getAllSpecializedQueues(): QueueNames[] {
    return Object.values(JOB_TYPE_QUEUE_MAP);
  }

  /**
   * Get the job types that map to a given queue.
   */
  static getJobTypesForQueue(queueName: string): string[] {
    return Object.entries(JOB_TYPE_QUEUE_MAP)
      .filter(([_, queue]) => queue === queueName)
      .map(([jobType]) => jobType);
  }
}
