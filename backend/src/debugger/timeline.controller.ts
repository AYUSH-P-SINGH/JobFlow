import { Request, Response, NextFunction } from 'express';
import prisma from '../prisma.js';
import { NotFoundError } from '../common/errors/errors.js';

export class TimelineController {
  /**
   * GET /api/v1/workflows/:id/timeline
   * Returns step-level execution duration timeline data suitable for Gantt chart rendering.
   */
  public static async getTimeline(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;

      const workflow = await prisma.workflow.findUnique({
        where: { id },
        include: { steps: true },
      });

      if (!workflow) {
        throw new NotFoundError('Workflow not found');
      }

      // Format Gantt-chart-friendly timeline data
      const timeline = workflow.steps.map((step) => {
        const start = step.startedAt ? new Date(step.startedAt).getTime() : null;
        const end = step.completedAt ? new Date(step.completedAt).getTime() : null;
        const durationMs = start && end ? end - start : null;

        return {
          stepId: step.stepId,
          name: step.stepId,
          status: step.status,
          jobType: step.jobType,
          startedAt: step.startedAt,
          completedAt: step.completedAt,
          durationMs,
        };
      });

      res.status(200).json({
        success: true,
        data: {
          workflowId: workflow.id,
          workflowName: workflow.name,
          status: workflow.status,
          progress: workflow.progress,
          timeline,
        },
      });
    } catch (error) {
      next(error);
    }
  }
}
