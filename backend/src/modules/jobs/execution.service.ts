import { Job as BullMQJob } from 'bullmq';
import { jobRepository } from './job.repository.js';
import { JobStatus } from './job.types.js';
import { HandlerFactory } from '../../workers/handlers/handler.factory.js';
import { WorkerHealthTracker } from '../../workers/worker.health.js';
import { logger } from '../../common/logger/logger.js';
import { WorkflowEngine } from '../workflow/engine/workflow.engine.js';
import { runWithCorrelationId } from '../../common/tracing/context.js';
import { randomUUID } from 'crypto';
import { EventPublisher } from '../../events/event.publisher.js';
import { DLQService } from '../recovery/dlq.service.js';
import { context, propagation, trace, SpanStatusCode } from '@opentelemetry/api';

export class ExecutionService {
  /**
   * Executes a job retrieved from the BullMQ queue.
   */
  public static async executeJob(jobId: string, bullJob: BullMQJob): Promise<any> {
    const correlationId = (bullJob.data as any)?.correlationId || randomUUID();
    const traceContext = (bullJob.data as any)?.traceContext;
    const parentContext = traceContext
      ? propagation.extract(context.active(), traceContext)
      : context.active();

    return context.with(parentContext, async () => {
      const tracer = trace.getTracer('jobflow-worker');
      return tracer.startActiveSpan(`job.execute: ${bullJob.name}`, async (span) => {
        try {
          const result = await runWithCorrelationId(correlationId, async () => {
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
            const runningJob = await jobRepository.updateStatus(jobId, JobStatus.RUNNING, undefined, new Date());
            EventPublisher.publishJobEvent('job.started', runningJob);
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

              const failedJob = await jobRepository.updateStatus(jobId, JobStatus.FAILED, errorPayload, undefined, new Date());
              EventPublisher.publishJobEvent('job.failed', failedJob, undefined, undefined, errorPayload);
              
              const maxAttempts = bullJob.opts.attempts || 3;
              if (attempts >= maxAttempts) {
                await DLQService.moveToDLQ(jobId, (bullJob as any).queue.name, dbJob.payload, errorPayload, attempts).catch((dlqErr) => {
                  logger.error(`[ExecutionService] Failed to move job ${jobId} to DLQ: ${dlqErr.message}`);
                });
              }

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
                EventPublisher.publishJobEvent('job.progress', dbJob, percent);
              });

              // 6. Complete Job in DB (and record completedAt time)
              const completedJob = await jobRepository.updateStatus(
                jobId,
                JobStatus.COMPLETED,
                result || { success: true },
                undefined,
                new Date()
              );

              EventPublisher.publishJobEvent('job.completed', completedJob, undefined, result || { success: true });

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
              const failedJob2 = await jobRepository.updateStatus(
                jobId,
                JobStatus.FAILED,
                errorPayload,
                undefined,
                new Date()
              );

              EventPublisher.publishJobEvent('job.failed', failedJob2, undefined, undefined, errorPayload);

              const maxAttempts = bullJob.opts.attempts || 3;
              if (attempts >= maxAttempts) {
                await DLQService.moveToDLQ(jobId, (bullJob as any).queue.name, dbJob.payload, errorPayload, attempts).catch((dlqErr) => {
                  logger.error(`[ExecutionService] Failed to move job ${jobId} to DLQ: ${dlqErr.message}`);
                });
              }

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
          });
          span.setStatus({ code: SpanStatusCode.OK });
          return result;
        } catch (error) {
          span.recordException(error as Error);
          span.setStatus({ code: SpanStatusCode.ERROR, message: (error as Error).message });
          throw error;
        } finally {
          span.end();
        }
      });
    });
  }
}
