import prisma from '../../prisma.js';
import { getJobQueue } from '../../queues/job.queue.js';
import { WorkflowEngine } from '../workflow/engine/workflow.engine.js';
import { logger } from '../../common/logger/logger.js';

export class RecoveryService {
  /**
   * Scans for running workflows, checks if their active steps are still in BullMQ,
   * resets lost/stalled steps to PENDING, and calls WorkflowEngine.tick() to resume them.
   */
  public static async recoverRunningWorkflows(): Promise<void> {
    logger.info('=== Starting Workflow Recovery Scan ===');

    try {
      const runningWorkflows = await prisma.workflow.findMany({
        where: {
          status: {
            in: ['RUNNING', 'PENDING'],
          },
        },
        include: {
          steps: true,
        },
      });

      logger.info(`Found ${runningWorkflows.length} workflows in RUNNING or PENDING state.`);

      const queue = getJobQueue();

      for (const workflow of runningWorkflows) {
        let needsTick = false;
        const runningSteps = workflow.steps.filter((s) => s.status === 'RUNNING');

        if (runningSteps.length === 0) {
          // Workflow is RUNNING but has no steps marked as RUNNING. It's stalled.
          logger.warn(`Workflow ${workflow.id} is RUNNING but has no RUNNING steps. Scheduling tick.`);
          needsTick = true;
        } else {
          for (const step of runningSteps) {
            if (!step.jobId) {
              // Mark step as PENDING so it gets rescheduled
              logger.warn(`Step ${step.stepId} of Workflow ${workflow.id} is RUNNING but has no jobId. Resetting to PENDING.`);
              await prisma.workflowStep.update({
                where: { id: step.id },
                data: { status: 'PENDING', startedAt: null },
              });
              needsTick = true;
              continue;
            }

            // Check if job is still active/queued in BullMQ
            const bullJob = await queue.getJob(step.jobId).catch(() => null);
            
            // If the job is missing from BullMQ, the worker crashed while executing it
            if (!bullJob) {
              logger.warn(`Job ${step.jobId} for Step ${step.stepId} of Workflow ${workflow.id} is missing from BullMQ. Resetting to PENDING.`);
              
              await prisma.workflowStep.update({
                where: { id: step.id },
                data: { status: 'PENDING', startedAt: null, jobId: null },
              });

              // Log recovery action
              await prisma.recoveryLog.create({
                data: {
                  workflowId: workflow.id,
                  stepId: step.stepId,
                  action: 'RESET',
                  details: `Reset running step ${step.stepId} (Job ${step.jobId}) because its BullMQ job was lost.`,
                },
              });

              needsTick = true;
            }
          }
        }

        if (needsTick) {
          logger.info(`Resuming Workflow ${workflow.id} from latest checkpoint/progress...`);
          // Record recovery history log
          await prisma.recoveryLog.create({
            data: {
              workflowId: workflow.id,
              action: 'RESUMED',
              details: `Resumed workflow execution from latest checkpoints.`,
            },
          });

          // Trigger tick in background to resume workflow step schedule
          WorkflowEngine.tick(workflow.id).catch((err) => {
            logger.error(`Failed to resume Workflow ${workflow.id}: ${err.message}`);
          });
        }
      }

      logger.info('=== Workflow Recovery Scan Completed ===');
    } catch (error) {
      logger.error(`Workflow recovery scan failed: ${(error as Error).message}`);
    }
  }
}
