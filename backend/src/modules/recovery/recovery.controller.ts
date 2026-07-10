import { Request, Response, NextFunction } from 'express';
import { DLQService } from './dlq.service.js';
import prisma from '../../prisma.js';
import { logger } from '../../common/logger/logger.js';

export class RecoveryController {
  /**
   * Replays a failed job from the Dead Letter Queue.
   */
  public static async replayJob(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { jobId } = req.params;
      if (!jobId) {
        res.status(400).json({ error: 'Job ID is required' });
        return;
      }

      await DLQService.replayJob(jobId);

      // If the job belongs to a workflow step, let's restore the workflow status so it runs again
      const step = await prisma.workflowStep.findUnique({
        where: { jobId },
      });

      if (step) {
        logger.info(`Restoring status of Workflow ${step.workflowId} and Step ${step.stepId} to RUNNING/PENDING for replay`);
        await prisma.workflowStep.update({
          where: { id: step.id },
          data: { status: 'PENDING' },
        });

        await prisma.workflow.update({
          where: { id: step.workflowId },
          data: { status: 'RUNNING' },
        });
      }

      res.status(200).json({
        success: true,
        message: `Job ${jobId} replayed successfully`,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Discards a failed job from the Dead Letter Queue.
   */
  public static async discardJob(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { jobId } = req.params;
      if (!jobId) {
        res.status(400).json({ error: 'Job ID is required' });
        return;
      }

      await DLQService.discardJob(jobId);

      res.status(200).json({
        success: true,
        message: `Job ${jobId} discarded successfully from DLQ`,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Exposes recovery dashboard data: DLQ jobs, running workflows, checkpoints, and recovery logs.
   */
  public static async getDashboardStats(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const dlqJobs = await prisma.deadLetterJob.findMany({
        orderBy: { failedAt: 'desc' },
      });

      const runningWorkflows = await prisma.workflow.findMany({
        where: { status: 'RUNNING' },
        include: { steps: true },
        orderBy: { updatedAt: 'desc' },
      });

      const checkpoints = await prisma.workflowCheckpoint.findMany({
        orderBy: { updatedAt: 'desc' },
      });

      const recoveryLogs = await prisma.recoveryLog.findMany({
        orderBy: { createdAt: 'desc' },
      });

      res.status(200).json({
        success: true,
        data: {
          dlqJobs,
          runningWorkflows,
          checkpoints,
          recoveryLogs,
        },
      });
    } catch (error) {
      next(error);
    }
  }
}
