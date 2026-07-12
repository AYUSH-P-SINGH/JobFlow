import { Job as BullMQJob } from 'bullmq';
import { getJobQueue } from '../../queues/job.queue.js';
import { PriorityMap } from '../../queues/queue.constants.js';
import { logger } from '../../common/logger/logger.js';
import type { Job } from './job.types.js';
import { getCorrelationId } from '../../common/tracing/context.js';
import { context, propagation } from '@opentelemetry/api';

/**
 * Minimal payload pushed to the BullMQ queue.
 * Workers (Phase 6) will fetch full job details from the database using the jobId.
 */
export interface JobQueuePayload {
  jobId: string;
  userId: string;
  type: string;
  priority: string;
  correlationId?: string;
  traceContext?: Record<string, string>;
}

export class EnqueueService {
  /**
   * Adds a job to the BullMQ job processing queue.
   *
   * - Constructs a minimal payload (ID references only, not full data)
   * - Maps application priority to BullMQ numeric priority
   * - Calculates delay from scheduledAt if the job is scheduled for the future
   */
  static async enqueueJob(job: Job): Promise<BullMQJob> {
    const queue = getJobQueue();

    const payload: JobQueuePayload = {
      jobId: job.id,
      userId: job.userId,
      type: job.type,
      priority: job.priority,
    };

    const correlationId = getCorrelationId();
    if (correlationId) {
      payload.correlationId = correlationId;
    }

    // Inject active OpenTelemetry context
    const traceContext: Record<string, string> = {};
    propagation.inject(context.active(), traceContext);
    payload.traceContext = traceContext;

    // Calculate delay for scheduled jobs
    let delay: number | undefined;
    if (job.scheduledAt) {
      const scheduledTime = new Date(job.scheduledAt).getTime();
      const now = Date.now();
      if (scheduledTime > now) {
        delay = scheduledTime - now;
      }
    }

    const bullJob = await queue.add(job.type, payload, {
      jobId: job.id, // Use the database job ID as the BullMQ job ID for traceability
      priority: PriorityMap[job.priority],
      delay,
    });

    logger.info(
      `Job enqueued: ID ${job.id}, Type ${job.type}, Priority ${job.priority}` +
        (delay ? `, Delay ${delay}ms` : '')
    );

    return bullJob;
  }
}
