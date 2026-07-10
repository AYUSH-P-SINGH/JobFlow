import prisma from '../prisma.js';
import { WorkflowEngine } from '../modules/workflow/engine/workflow.engine.js';
import { workflowRepository } from '../modules/workflow/workflow.repository.js';
import { WorkflowStatus } from '../modules/workflow/workflow.types.js';
import { WORKFLOW_EVENTS } from '../modules/workflow/workflow.constants.js';
import { logger } from '../common/logger/logger.js';
import { BadRequestError, NotFoundError } from '../common/errors/errors.js';

export class ReplayService {
  /**
   * Replays a failed or cancelled workflow, resuming execution only from steps that did not succeed.
   * Keeps already COMPLETED steps intact and preserves their checkpoints.
   */
  public static async replayWorkflow(workflowId: string, actorId: string): Promise<void> {
    logger.info(`[ReplayService] Initiating replay for workflow: ${workflowId}`);

    // 1. Fetch workflow and its steps
    const workflow = await prisma.workflow.findUnique({
      where: { id: workflowId },
      include: { steps: true },
    });

    if (!workflow) {
      throw new NotFoundError('Workflow not found');
    }

    // Only allow replay for finished workflows (FAILED or CANCELLED)
    if (workflow.status !== 'FAILED' && workflow.status !== 'CANCELLED') {
      throw new BadRequestError(`Only workflows in FAILED or CANCELLED status can be replayed. Current status: ${workflow.status}`);
    }

    // 2. Prepare steps for replay
    // Reset FAILED and CANCELLED steps back to PENDING. Clear their job reference so a new job is spawned.
    let resetCount = 0;

    for (const step of workflow.steps) {
      if (step.status === 'FAILED' || step.status === 'CANCELLED' || step.status === 'RUNNING') {
        await prisma.workflowStep.update({
          where: { id: step.id },
          data: {
            status: 'PENDING',
            jobId: null,
            startedAt: null,
            completedAt: null,
          },
        });
        resetCount++;
      }
    }

    logger.info(`[ReplayService] Reset ${resetCount} steps to PENDING for workflow ${workflowId}`);

    // 3. Update workflow status back to RUNNING
    await prisma.workflow.update({
      where: { id: workflowId },
      data: {
        status: 'RUNNING',
        updatedAt: new Date(),
      },
    });

    // 4. Log replay action in compliance and audit history
    await workflowRepository.addHistory(
      workflowId,
      WORKFLOW_EVENTS.STARTED,
      `Workflow execution replayed from last checkpoint by actor ${actorId}.`,
      null
    );

    await prisma.recoveryLog.create({
      data: {
        workflowId,
        action: 'REPLAYED',
        details: `Workflow replayed. Reset ${resetCount} failed/cancelled steps to PENDING.`,
      },
    });

    // 5. Trigger Workflow Engine tick to resume evaluation loop
    logger.info(`[ReplayService] Resuming workflow engine tick for: ${workflowId}`);
    // Run asynchronously to return response immediately
    WorkflowEngine.tick(workflowId).catch((err) => {
      logger.error(`[ReplayService] Failed to resume workflow ${workflowId} execution tick: ${err.message}`);
    });
  }
}
