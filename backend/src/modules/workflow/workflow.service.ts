import { workflowRepository } from './workflow.repository.js';
import { WorkflowEngine } from './engine/workflow.engine.js';
import { WorkflowStateMachine } from './engine/state.machine.js';
import {
  CreateWorkflowStepInput,
  Workflow,
  WorkflowStep,
  WorkflowFilter,
  WorkflowPagination,
  WorkflowStatus,
} from './workflow.types.js';
import { WORKFLOW_EVENTS } from './workflow.constants.js';
import { ForbiddenError, NotFoundError, BadRequestError } from '../../common/errors/errors.js';
import { logger } from '../../common/logger/logger.js';
import { getJobQueue } from '../../queues/job.queue.js';
import prisma from '../../prisma.js';
import { EventPublisher } from '../../events/event.publisher.js';

export class WorkflowService {
  /**
   * Creates a workflow, validates the DAG, logs history, and triggers the execution engine.
   */
  static async createWorkflow(
    name: string,
    steps: CreateWorkflowStepInput[],
    userId: string
  ): Promise<Workflow & { steps: WorkflowStep[] }> {
    const workflow = await workflowRepository.create(name, userId, steps);

    await workflowRepository.addHistory(
      workflow.id,
      WORKFLOW_EVENTS.CREATED,
      `Workflow "${name}" created with ${steps.length} steps.`
    );

    // Trigger initial execution step evaluation in background
    WorkflowEngine.tick(workflow.id).catch((err) => {
      logger.error(`[WorkflowService] Error starting workflow ${workflow.id}: ${err.message}`);
    });

    return workflow;
  }

  /**
   * Retrieves a workflow by ID and checks user permissions.
   */
  static async getWorkflowById(id: string, currentUser: { id: string; role: string }) {
    const workflow = await workflowRepository.findById(id);
    if (!workflow) {
      throw new NotFoundError('Workflow not found');
    }

    if (currentUser.role !== 'ADMIN' && workflow.userId !== currentUser.id) {
      throw new ForbiddenError('You are not authorized to access this workflow');
    }

    return workflow;
  }

  /**
   * Returns a paginated list of workflows, enforcing ownership for standard users.
   */
  static async getAllWorkflows(
    filters: WorkflowFilter,
    pagination: WorkflowPagination,
    currentUser: { id: string; role: string },
    sortBy?: string,
    sortOrder?: 'asc' | 'desc'
  ) {
    const activeFilters = { ...filters };

    if (currentUser.role !== 'ADMIN') {
      activeFilters.userId = currentUser.id;
    }

    const { workflows, total } = await workflowRepository.findAll(
      activeFilters,
      pagination,
      sortBy,
      sortOrder
    );

    return {
      workflows,
      page: pagination.page,
      limit: pagination.limit,
      total,
    };
  }

  /**
   * Cancels a pending/running workflow, removes any queued jobs, and transitions state to CANCELLED.
   */
  static async cancelWorkflow(id: string, currentUser: { id: string; role: string }): Promise<Workflow> {
    const workflow = await workflowRepository.findById(id);
    if (!workflow) {
      throw new NotFoundError('Workflow not found');
    }

    if (currentUser.role !== 'ADMIN' && workflow.userId !== currentUser.id) {
      throw new ForbiddenError('You are not authorized to cancel this workflow');
    }

    // Validate state transition
    WorkflowStateMachine.validateTransition(workflow.status, WorkflowStatus.CANCELLED);

    // Cancel all steps that are not already finished
    const queue = getJobQueue();
    for (const step of workflow.steps) {
      if (
        step.status !== WorkflowStatus.COMPLETED &&
        step.status !== WorkflowStatus.FAILED &&
        step.status !== WorkflowStatus.CANCELLED
      ) {
        // If there is a scheduled job associated, try to remove it from BullMQ
        if (step.jobId) {
          try {
            const bullJob = await queue.getJob(step.jobId);
            if (bullJob) {
              await bullJob.remove();
            }
          } catch (err) {
            logger.warn(
              `[WorkflowService] Could not remove BullMQ Job ${step.jobId} for step ${step.stepId}: ${(err as Error).message}`
            );
          }
        }

        // Transition step to CANCELLED
        await workflowRepository.updateStepStatus(
          step.id,
          WorkflowStatus.CANCELLED,
          undefined,
          new Date()
        );

        await workflowRepository.addHistory(
          workflow.id,
          WORKFLOW_EVENTS.STEP_CANCELLED,
          `Step "${step.stepId}" cancelled by workflow termination.`,
          step.stepId
        );
      }
    }

    // Update overall status to CANCELLED
    const updated = await workflowRepository.updateStatus(id, WorkflowStatus.CANCELLED, null);
    await workflowRepository.addHistory(id, WORKFLOW_EVENTS.CANCELLED, 'Workflow cancelled by user.');

    // Calculate final progress
    const finishedCount = workflow.steps.length; // All steps cancelled or finished
    const progress = workflow.steps.length > 0 ? 100 : 0;
    const finalWf = await workflowRepository.updateProgress(id, progress);
    EventPublisher.publishWorkflowEvent('workflow.cancelled', finalWf);

    return updated;
  }

  /**
   * Retries a failed or cancelled workflow. Resets failed/cancelled steps to PENDING and triggers engine.
   */
  static async retryWorkflow(id: string, currentUser: { id: string; role: string }): Promise<Workflow> {
    const workflow = await workflowRepository.findById(id);
    if (!workflow) {
      throw new NotFoundError('Workflow not found');
    }

    if (currentUser.role !== 'ADMIN' && workflow.userId !== currentUser.id) {
      throw new ForbiddenError('You are not authorized to retry this workflow');
    }

    // Validate state transition
    WorkflowStateMachine.validateTransition(workflow.status, WorkflowStatus.PENDING);

    const stepsToReset = workflow.steps.filter(
      (s) => s.status === WorkflowStatus.FAILED || s.status === WorkflowStatus.CANCELLED
    );

    if (stepsToReset.length === 0) {
      throw new BadRequestError('No failed or cancelled steps to retry.');
    }

    // Reset database fields for these steps in a transaction
    await prisma.$transaction(
      stepsToReset.map((step) =>
        prisma.workflowStep.update({
          where: { id: step.id },
          data: {
            status: WorkflowStatus.PENDING,
            startedAt: null,
            completedAt: null,
            jobId: null,
          },
        })
      )
    );

    // Transition workflow back to PENDING and trigger evaluation
    const updatedWorkflow = await workflowRepository.updateStatus(id, WorkflowStatus.PENDING, null);
    EventPublisher.publishWorkflowEvent('workflow.updated', updatedWorkflow);

    await workflowRepository.addHistory(
      id,
      WORKFLOW_EVENTS.STARTED,
      'Workflow retried from failed and cancelled steps.'
    );

    WorkflowEngine.tick(id).catch((err) => {
      logger.error(`[WorkflowService] Error retrying workflow ${id}: ${err.message}`);
    });

    return updatedWorkflow;
  }
}
