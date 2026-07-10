import prisma from '../../prisma.js';
import { getJobQueue } from '../../queues/job.queue.js';
import { jobRepository } from '../jobs/job.repository.js';
import { JobStatus } from '../jobs/job.types.js';
import { logger } from '../../common/logger/logger.js';

export class DLQService {
  /**
   * Moves a failed job to the Dead Letter Queue database table.
   */
  public static async moveToDLQ(
    jobId: string,
    queueName: string,
    payload: any,
    error: any,
    attemptsMade: number
  ): Promise<void> {
    try {
      const existing = await prisma.deadLetterJob.findUnique({
        where: { jobId },
      });

      const errorData = error instanceof Error ? { message: error.message, stack: error.stack } : error;

      if (existing) {
        await prisma.deadLetterJob.update({
          where: { jobId },
          data: {
            error: errorData || {},
            attemptsMade,
            status: 'FAILED',
            failedAt: new Date(),
          },
        });
      } else {
        await prisma.deadLetterJob.create({
          data: {
            jobId,
            queueName,
            payload: payload || {},
            error: errorData || {},
            attemptsMade,
            status: 'FAILED',
          },
        });
      }

      logger.info(`Job ${jobId} moved to Dead Letter Queue (DLQ).`);
    } catch (err) {
      logger.error(`Failed to move job ${jobId} to DLQ: ${(err as Error).message}`);
    }
  }

  /**
   * Replays a failed job from the Dead Letter Queue.
   */
  public static async replayJob(jobId: string): Promise<void> {
    const dlqJob = await prisma.deadLetterJob.findUnique({
      where: { jobId },
    });

    if (!dlqJob) {
      throw new Error(`Job ${jobId} not found in DLQ`);
    }

    const dbJob = await jobRepository.findById(jobId);
    if (!dbJob) {
      throw new Error(`Job ${jobId} not found in database`);
    }

    logger.info(`Replaying Job ${jobId} from DLQ...`);

    // Reset status to QUEUED in DB
    await jobRepository.updateStatus(jobId, JobStatus.QUEUED);

    // Enqueue back into BullMQ
    const queue = getJobQueue();
    const payload = {
      jobId: dbJob.id,
      userId: dbJob.userId,
      type: dbJob.type,
      priority: dbJob.priority,
    };

    // Re-add to BullMQ queue
    await queue.add(dbJob.type, payload, {
      jobId: dbJob.id,
      attempts: 3, // reset attempts
    });

    // Update DLQ status to REPLAYED
    await prisma.deadLetterJob.update({
      where: { jobId },
      data: {
        status: 'REPLAYED',
      },
    });

    logger.info(`Job ${jobId} successfully re-enqueued for replay.`);
  }

  /**
   * Permanently discards a failed job from the Dead Letter Queue.
   */
  public static async discardJob(jobId: string): Promise<void> {
    const dlqJob = await prisma.deadLetterJob.findUnique({
      where: { jobId },
    });

    if (!dlqJob) {
      throw new Error(`Job ${jobId} not found in DLQ`);
    }

    // Update DLQ status to DISCARDED
    await prisma.deadLetterJob.update({
      where: { jobId },
      data: {
        status: 'DISCARDED',
      },
    });

    logger.info(`Job ${jobId} discarded from DLQ.`);
  }
}
