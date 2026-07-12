import { workflowRepository } from '../workflow.repository.js';
import { DependencyResolver } from './dependency.resolver.js';
import { WorkflowScheduler } from './scheduler.js';
import { WorkflowStatus, WorkflowStep, Workflow } from '../workflow.types.js';
import { WORKFLOW_EVENTS } from '../workflow.constants.js';
import { logger } from '../../../common/logger/logger.js';
import prisma from '../../../prisma.js';
import { EventPublisher } from '../../../events/event.publisher.js';
import { CheckpointService } from '../../recovery/checkpoint.service.js';
import { DistributedLock } from '../../../modules/resilience/distributed-lock.js';
import { context, propagation } from '@opentelemetry/api';

export class WorkflowEngine {
  /**
   * Main entrypoint for workflow evaluation, protected by a distributed lock.
   */
  public static async tick(workflowId: string): Promise<void> {
    const lockKey = `lock:workflow:tick:${workflowId}`;
    const token = await DistributedLock.acquire(lockKey, 15000);
    if (!token) {
      logger.info(`[WorkflowEngine] Could not acquire lock for workflow: ${workflowId}. Skipping execution tick.`);
      return;
    }

    try {
      await this.doTick(workflowId);
    } finally {
      await DistributedLock.release(lockKey, token);
    }
  }

  /**
   * Internal state evaluation tick for a workflow.
   */
  private static async doTick(workflowId: string): Promise<void> {
    logger.info(`[WorkflowEngine] Ticking workflow: ${workflowId}`);

    const workflow = await prisma.workflow.findUnique({
      where: { id: workflowId },
      include: {
        steps: {
          include: { job: true },
          orderBy: { stepNumber: 'asc' },
        },
      },
    });

    if (!workflow) {
      logger.error(`[WorkflowEngine] Workflow ${workflowId} not found.`);
      return;
    }

    // Extract OpenTelemetry context from triggerMetadata
    const triggerMeta = workflow.triggerMetadata as any;
    const traceContext = triggerMeta?.traceContext;
    const parentContext = traceContext
      ? propagation.extract(context.active(), traceContext)
      : context.active();

    await context.with(parentContext, async () => {
      // If workflow is already in a terminal state, do not tick
      if (
        workflow.status === WorkflowStatus.COMPLETED ||
        workflow.status === WorkflowStatus.FAILED ||
        workflow.status === WorkflowStatus.CANCELLED
      ) {
        logger.warn(`[WorkflowEngine] Workflow ${workflowId} is in terminal state "${workflow.status}". Skipping tick.`);
        return;
      }

      const steps = workflow.steps;
      const totalSteps = steps.length;

      // 1. Find steps that are ready to run
      const readySteps = DependencyResolver.findReadySteps(steps);

      if (readySteps.length > 0) {
        // If the workflow is PENDING, transition it to RUNNING
        if (workflow.status === WorkflowStatus.PENDING) {
          const updatedWf = await workflowRepository.updateStatus(workflowId, WorkflowStatus.RUNNING);
          EventPublisher.publishWorkflowEvent('workflow.started', updatedWf);
          await workflowRepository.addHistory(
            workflowId,
            WORKFLOW_EVENTS.STARTED,
            `Workflow "${workflow.name}" started.`
          );
        }

        for (const step of readySteps) {
          const condition = step.payload && (step.payload as any).condition;

          if (condition) {
            const conditionMet = DependencyResolver.evaluateCondition(condition, steps);

            if (!conditionMet) {
              logger.info(
                `[WorkflowEngine] Step "${step.stepId}" condition "${condition}" failed. Skipping/Cancelling step.`
              );

              // Mark step as CANCELLED (skipped)
              await workflowRepository.updateStepStatus(
                step.id,
                WorkflowStatus.CANCELLED,
                undefined,
                new Date()
              );

              await workflowRepository.addHistory(
                workflowId,
                WORKFLOW_EVENTS.STEP_CANCELLED,
                `Step "${step.stepId}" skipped because its condition "${condition}" was not met.`,
                step.stepId
              );

              // Resolve cascading cancellations for downstream dependencies
              const cascadingStepIds = DependencyResolver.resolveCascadingCancellations(steps, [step.stepId]);
              for (const stepId of cascadingStepIds) {
                const dbStep = steps.find((s) => s.stepId === stepId);
                if (dbStep) {
                  await workflowRepository.updateStepStatus(
                    dbStep.id,
                    WorkflowStatus.CANCELLED,
                    undefined,
                    new Date()
                  );
                  await workflowRepository.addHistory(
                    workflowId,
                    WORKFLOW_EVENTS.STEP_CANCELLED,
                    `Step "${stepId}" cancelled due to dependency cancellation.`,
                    stepId
                  );
                }
              }

              // Re-tick to process newly ready branches or workflow completion
              return this.doTick(workflowId);
            }
          }

          // Schedule the step job
          try {
            await WorkflowScheduler.scheduleStep(workflow, step);
            // Update workflow currentStep with the scheduled step name/id
            const updatedWf = await workflowRepository.updateStatus(workflowId, WorkflowStatus.RUNNING, step.stepId);
            EventPublisher.publishWorkflowEvent('workflow.updated', updatedWf);
          } catch (error) {
            logger.error(
              `[WorkflowEngine] Failed to schedule step "${step.stepId}" of Workflow ${workflowId}: ${(error as Error).message}`
            );
            // Mark step as failed
            await workflowRepository.updateStepStatus(step.id, WorkflowStatus.FAILED, undefined, new Date());
            await workflowRepository.addHistory(
              workflowId,
              WORKFLOW_EVENTS.STEP_FAILED,
              `Step "${step.stepId}" execution failed: ${(error as Error).message}`,
              step.stepId
            );
            // Re-tick to process failure state transitions
            return this.doTick(workflowId);
          }
        }
      }

      // 2. Refresh steps list from database for accurate progress and completion check
      const refreshedSteps = await prisma.workflowStep.findMany({
        where: { workflowId },
      });

      const finishedSteps = refreshedSteps.filter(
        (s) =>
          s.status === WorkflowStatus.COMPLETED ||
          s.status === WorkflowStatus.FAILED ||
          s.status === WorkflowStatus.CANCELLED
      );

      // Update progress
      const progress = Math.round((finishedSteps.length / totalSteps) * 100);
      const updatedWf = await workflowRepository.updateProgress(workflowId, progress);
      EventPublisher.publishWorkflowEvent('workflow.updated', updatedWf);

      // 3. Check for workflow completion
      if (finishedSteps.length === totalSteps) {
        const hasFailedSteps = refreshedSteps.some((s) => s.status === WorkflowStatus.FAILED);

        if (hasFailedSteps) {
          // Transition workflow to FAILED
          const finalWf = await workflowRepository.updateStatus(workflowId, WorkflowStatus.FAILED, null);
          EventPublisher.publishWorkflowEvent('workflow.failed', finalWf, new Error('Workflow failed due to step failures.'));
          await workflowRepository.addHistory(
            workflowId,
            WORKFLOW_EVENTS.FAILED,
            `Workflow "${workflow.name}" failed.`
          );
        } else {
          // Transition workflow to COMPLETED
          const finalWf = await workflowRepository.updateStatus(workflowId, WorkflowStatus.COMPLETED, null);
          EventPublisher.publishWorkflowEvent('workflow.completed', finalWf);
          await workflowRepository.addHistory(
            workflowId,
            WORKFLOW_EVENTS.COMPLETED,
            `Workflow "${workflow.name}" completed successfully.`
          );
        }
      }
    });
  }

  /**
   * Worker callback when a step job completes successfully.
   */
  public static async handleStepCompletion(jobId: string, result: any): Promise<void> {
    const step = await prisma.workflowStep.findUnique({
      where: { jobId },
    });

    if (!step) {
      // Not a workflow job, ignore
      return;
    }

    logger.info(`[WorkflowEngine] Step "${step.stepId}" completed for Job ${jobId}`);

    // Update step status to COMPLETED
    await workflowRepository.updateStepStatus(step.id, WorkflowStatus.COMPLETED, undefined, new Date());

    // Record history
    await workflowRepository.addHistory(
      step.workflowId,
      WORKFLOW_EVENTS.STEP_COMPLETED,
      `Step "${step.stepId}" completed successfully.`,
      step.stepId
    );

    // Save checkpoint
    await CheckpointService.saveCheckpoint(
      step.workflowId,
      step.stepId,
      step.stepNumber,
      'COMPLETED',
      result
    );

    // Trigger next workflow steps
    await this.tick(step.workflowId);
  }

  /**
   * Worker callback when a step job fails.
   */
  public static async handleStepFailure(jobId: string, errorPayload: any): Promise<void> {
    const step = await prisma.workflowStep.findUnique({
      where: { jobId },
    });

    if (!step) {
      // Not a workflow job, ignore
      return;
    }

    logger.error(`[WorkflowEngine] Step "${step.stepId}" failed for Job ${jobId}: ${errorPayload?.message}`);

    // Update step status to FAILED
    await workflowRepository.updateStepStatus(step.id, WorkflowStatus.FAILED, undefined, new Date());

    // Record step history
    await workflowRepository.addHistory(
      step.workflowId,
      WORKFLOW_EVENTS.STEP_FAILED,
      `Step "${step.stepId}" failed: ${errorPayload?.message || 'Unknown error'}`,
      step.stepId
    );

    // Cancel all remaining pending downstream steps due to cascading failure
    const workflow = await prisma.workflow.findUnique({
      where: { id: step.workflowId },
      include: { steps: true },
    });

    if (workflow) {
      const cascadingStepIds = DependencyResolver.resolveCascadingCancellations(workflow.steps, [step.stepId]);
      for (const stepId of cascadingStepIds) {
        const dbStep = workflow.steps.find((s) => s.stepId === stepId);
        if (dbStep) {
          await workflowRepository.updateStepStatus(
            dbStep.id,
            WorkflowStatus.CANCELLED,
            undefined,
            new Date()
          );
          await workflowRepository.addHistory(
            workflow.id,
            WORKFLOW_EVENTS.STEP_CANCELLED,
            `Step "${stepId}" cancelled due to dependency failure of "${step.stepId}".`,
            stepId
          );
        }
      }
    }

    // Trigger tick to finalize workflow failure status and progress
    await this.tick(step.workflowId);
  }
}
