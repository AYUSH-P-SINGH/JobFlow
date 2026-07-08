import { Job as BullMQJob } from 'bullmq';
import { jobRepository } from './job.repository.js';
import { JobStatus } from './job.types.js';
import { HandlerFactory } from '../../workers/handlers/handler.factory.js';
import { WorkerHealthTracker } from '../../workers/worker.health.js';
import { logger } from '../../common/logger/logger.js';
import { WorkflowEngine } from '../workflow/engine/workflow.engine.js';

export class ExecutionService {
  /**
   * Executes a job retrieved from the BullMQ queue.
   *
   * 1. Fetches full job details from PostgreSQL
   * 2. Transitions job status to RUNNING in database
   * 3. Selects the appropriate handler using HandlerFactory
   * 4. Validates payload and executes business logic (reporting progress)
   * 5. Transitions job status to COMPLETED (saving results) or FAILED (saving errors)
   * 6. Re-throws any execution error to allow BullMQ to handle retry/failure state internally
   */
  public static async executeJob(jobId: string, bullJob: BullMQJob): Promise<any> {
    const healthTracker = WorkerHealthTracker.getInstance();
    healthTracker.startJob(jobId);

    // 1. Fetch full job details from DB
    const dbJob = await jobRepository.findById(jobId);
    if (!dbJob) {
      logger.error(`[ExecutionService] Job ${jobId} not found in database. Skipping.`);
      healthTracker.failJob(jobId);
      return;
    }

    // Skip if job is already in a terminal state
    if (
      dbJob.status === JobStatus.COMPLETED ||
      dbJob.status === JobStatus.FAILED ||
      dbJob.status === JobStatus.CANCELLED
    ) {
      logger.warn(`[ExecutionService] Job ${jobId} is already in terminal state "${dbJob.status}". Skipping.`);
      return;
    }

    // 2. Transition DB state to RUNNING (and record startedAt time)
    await jobRepository.updateStatus(jobId, JobStatus.RUNNING, undefined, new Date());
    logger.info(`[ExecutionService] Job ${jobId} status transitioned to RUNNING`);

    let handler;
    try {
      // 3. Resolve handler strategy
      handler = HandlerFactory.getHandler(dbJob.type);
    } catch (error) {
      const err = error as Error;
      logger.error(`[ExecutionService] Failed to resolve handler for Job ${jobId}: ${err.message}`);

      const attempts = bullJob.attemptsMade + 1;
      const errorPayload = {
        message: err.message,
        stack: err.stack,
        attempts,
      };

      await jobRepository.updateStatus(jobId, JobStatus.FAILED, errorPayload, undefined, new Date());
      
      WorkflowEngine.handleStepFailure(jobId, errorPayload).catch((wfErr) => {
        logger.error(`[ExecutionService] Error notifying WorkflowEngine of handler failure for job ${jobId}: ${wfErr.message}`);
      });

      healthTracker.failJob(jobId);
      throw err;
    }

    try {
      // 4. Validate payload
      await handler.validate(dbJob.payload);

      // 5. Execute handler business logic
      const result = await handler.execute(dbJob.payload, async (percent: number) => {
        logger.info(`[ExecutionService] Job ${jobId} progress: ${percent}%`);
        await bullJob.updateProgress(percent);
      });

      // 6. Complete Job in DB (and record completedAt time)
      await jobRepository.updateStatus(
        jobId,
        JobStatus.COMPLETED,
        result || { success: true },
        undefined,
        new Date()
      );

      WorkflowEngine.handleStepCompletion(jobId, result || { success: true }).catch((wfErr) => {
        logger.error(`[ExecutionService] Error notifying WorkflowEngine of step completion for job ${jobId}: ${wfErr.message}`);
      });

      logger.info(`[ExecutionService] Job ${jobId} COMPLETED successfully.`);
      healthTracker.completeJob(jobId);
      return result;

    } catch (error) {
      const err = error as Error;
      logger.error(`[ExecutionService] Job ${jobId} failed during execution: ${err.message}`);

      const attempts = bullJob.attemptsMade + 1;
      const errorPayload = {
        message: err.message,
        stack: err.stack,
        attempts,
      };

      // Save failure metrics to database
      await jobRepository.updateStatus(
        jobId,
        JobStatus.FAILED,
        errorPayload,
        undefined,
        new Date()
      );

      WorkflowEngine.handleStepFailure(jobId, errorPayload).catch((wfErr) => {
        logger.error(`[ExecutionService] Error notifying WorkflowEngine of step failure for job ${jobId}: ${wfErr.message}`);
      });

      // Execute handler rollback if available
      if (handler.rollback) {
        try {
          await handler.rollback(dbJob.payload, err);
        } catch (rollbackError) {
          logger.error(`[ExecutionService] Rollback for Job ${jobId} failed: ${(rollbackError as Error).message}`);
        }
      }

      healthTracker.failJob(jobId);

      // Re-throw to inform BullMQ of failure (triggers attempts/retries)
      throw err;
    }
  }
}
