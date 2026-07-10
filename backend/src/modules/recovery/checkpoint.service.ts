import prisma from '../../prisma.js';
import { logger } from '../../common/logger/logger.js';

export class CheckpointService {
  /**
   * Saves or updates a workflow execution step checkpoint in the database.
   */
  public static async saveCheckpoint(
    workflowId: string,
    stepId: string,
    stepNumber: number,
    status: string,
    result?: any
  ): Promise<void> {
    try {
      const existing = await prisma.workflowCheckpoint.findUnique({
        where: {
          workflowId_stepId: {
            workflowId,
            stepId,
          },
        },
      });

      if (existing) {
        await prisma.workflowCheckpoint.update({
          where: { id: existing.id },
          data: {
            status,
            result: result || {},
            updatedAt: new Date(),
          },
        });
      } else {
        await prisma.workflowCheckpoint.create({
          data: {
            workflowId,
            stepId,
            stepNumber,
            status,
            result: result || {},
          },
        });
      }

      logger.info(`Saved execution checkpoint for Workflow ${workflowId}, Step: ${stepId} (Step #${stepNumber})`);
    } catch (error) {
      logger.error(`Failed to save checkpoint for workflow ${workflowId}: ${(error as Error).message}`);
    }
  }

  /**
   * Retrieves the highest numbered checkpoint for a workflow (the latest progress).
   */
  public static async getLatestCheckpoint(workflowId: string) {
    try {
      return await prisma.workflowCheckpoint.findFirst({
        where: { workflowId },
        orderBy: { stepNumber: 'desc' },
      });
    } catch (error) {
      logger.error(`Failed to fetch latest checkpoint for workflow ${workflowId}: ${(error as Error).message}`);
      return null;
    }
  }

  /**
   * Clears all checkpoints for a completed/failed/cancelled workflow.
   */
  public static async clearCheckpoints(workflowId: string): Promise<void> {
    try {
      await prisma.workflowCheckpoint.deleteMany({
        where: { workflowId },
      });
      logger.info(`Cleared all checkpoints for Workflow ${workflowId}`);
    } catch (error) {
      logger.error(`Failed to clear checkpoints for workflow ${workflowId}: ${(error as Error).message}`);
    }
  }
}
