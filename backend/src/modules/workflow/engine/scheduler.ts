import { jobRepository } from '../../jobs/job.repository.js';
import { EnqueueService } from '../../jobs/enqueue.service.js';
import { workflowRepository } from '../workflow.repository.js';
import { JobStatus } from '../../jobs/job.types.js';
import { Workflow, WorkflowStep, WorkflowStatus } from '../workflow.types.js';
import { WORKFLOW_EVENTS } from '../workflow.constants.js';
import { logger } from '../../../common/logger/logger.js';

export class WorkflowScheduler {
  /**
   * Schedules a ready WorkflowStep by creating a Job, enqueuing it in BullMQ, and linking it to the step.
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

    // 3. Enqueue in BullMQ and transition Job to QUEUED
    try {
      await EnqueueService.enqueueJob(job);
      await jobRepository.updateStatus(job.id, JobStatus.QUEUED);
    } catch (error) {
      logger.error(
        `[WorkflowScheduler] Failed to enqueue Job ${job.id} for Step ${step.stepId}: ${(error as Error).message}`
      );
      // Fail the step immediately if we can't enqueue the job
      await workflowRepository.updateStepStatus(step.id, WorkflowStatus.FAILED, undefined, new Date());
      throw error;
    }

    // 4. Record history event
    await workflowRepository.addHistory(
      workflow.id,
      WORKFLOW_EVENTS.STEP_STARTED,
      `Step "${step.stepId}" (${step.jobType}) has been scheduled and queued.`,
      step.stepId
    );
  }
}
