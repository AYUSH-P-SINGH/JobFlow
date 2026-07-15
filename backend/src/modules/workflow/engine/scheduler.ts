import { Queue } from 'bullmq';
import { jobRepository } from '../../jobs/job.repository.js';
import { EnqueueService } from '../../jobs/enqueue.service.js';
import { workflowRepository } from '../workflow.repository.js';
import { JobStatus } from '../../jobs/job.types.js';
import { Workflow, WorkflowStep, WorkflowStatus } from '../workflow.types.js';
import { WORKFLOW_EVENTS } from '../workflow.constants.js';
import { logger } from '../../../common/logger/logger.js';
import { IntelligentScheduler } from '../../../modules/workers/scheduler/worker.scheduler.js';
import { createQueue } from '../../../queues/queue.factory.js';
import { QueueNames, PriorityMap } from '../../../queues/queue.constants.js';
import { getCorrelationId } from '../../../common/tracing/context.js';
import { context, propagation } from '@opentelemetry/api';
import { JobPriority } from '@prisma/client';

export class WorkflowScheduler {
  /**
   * Schedules a ready WorkflowStep by creating a Job, enqueuing it via
   * the Intelligent Scheduler, and linking it to the step.
   *
   * Phase 16 Enhancement:
   * Instead of always enqueuing to the default JOB_QUEUE, the scheduler
   * now consults the IntelligentScheduler to find the best worker and
   * route the job to a specialized queue.
   */
  public static async scheduleStep(workflow: Workflow, step: WorkflowStep): Promise<void> {
    logger.info(`[WorkflowScheduler] Scheduling step "${step.stepId}" of Workflow "${workflow.id}"`);

    // 1. Create a job record in DB
    const job = await jobRepository.create({
      title: `Workflow Step: ${workflow.name} - ${step.stepId}`,
      description: `Belongs to Workflow: ${workflow.name} (ID: ${workflow.id}), Step ID: ${step.stepId}`,
      type: step.jobType,
      priority: step.priority,
      payload: step.payload as Record<string, any>,
      userId: workflow.userId,
    });

    // 2. Link job to step and update step status to RUNNING
    await workflowRepository.linkJobToStep(step.id, job.id);
    await workflowRepository.updateStepStatus(step.id, WorkflowStatus.RUNNING, new Date());

    // 3. Use Intelligent Scheduler to find best worker/queue
    try {
      const schedulerResult = await IntelligentScheduler.scheduleJob(step.jobType);

      logger.info(
        `[WorkflowScheduler] Intelligent Scheduler result for step "${step.stepId}": ` +
        `queue=${schedulerResult.queueName}, worker=${schedulerResult.workerId || 'none'}, ` +
        `policy=${schedulerResult.policy}, candidates=${schedulerResult.candidateCount}`
      );

      // 4. Enqueue to the target queue (specialized or default)
      if (schedulerResult.queueName === QueueNames.JOB_QUEUE) {
        // Fallback: use the standard enqueue path
        await EnqueueService.enqueueJob(job);
      } else {
        // Route to specialized queue
        await this.enqueueToSpecializedQueue(job, schedulerResult.queueName);
      }

      await jobRepository.updateStatus(job.id, JobStatus.QUEUED);
    } catch (error) {
      logger.error(
        `[WorkflowScheduler] Failed to enqueue Job ${job.id} for Step ${step.stepId}: ${(error as Error).message}`
      );
      // Fail the step immediately if we can't enqueue the job
      await workflowRepository.updateStepStatus(step.id, WorkflowStatus.FAILED, undefined, new Date());
      throw error;
    }

    // 5. Record history event
    await workflowRepository.addHistory(
      workflow.id,
      WORKFLOW_EVENTS.STEP_STARTED,
      `Step "${step.stepId}" (${step.jobType}) has been scheduled and queued.`,
      step.stepId
    );
  }

  /**
   * Enqueue a job to a specialized BullMQ queue.
   */
  private static async enqueueToSpecializedQueue(
    job: { id: string; userId: string; type: string; priority: JobPriority; scheduledAt?: Date | null },
    queueName: string
  ): Promise<void> {
    // Get or create the specialized queue
    const queue = createQueue(queueName as QueueNames);

    const payload = {
      jobId: job.id,
      userId: job.userId,
      type: job.type,
      priority: job.priority,
      correlationId: getCorrelationId(),
      traceContext: {} as Record<string, string>,
    };

    // Inject OpenTelemetry trace context
    propagation.inject(context.active(), payload.traceContext);

    // Calculate delay for scheduled jobs
    let delay: number | undefined;
    if (job.scheduledAt) {
      const scheduledTime = new Date(job.scheduledAt).getTime();
      const now = Date.now();
      if (scheduledTime > now) {
        delay = scheduledTime - now;
      }
    }

    await queue.add(job.type, payload, {
      jobId: job.id,
      priority: PriorityMap[job.priority],
      delay,
    });

    logger.info(
      `[WorkflowScheduler] Job ${job.id} enqueued to specialized queue: ${queueName}`
    );
  }
}
