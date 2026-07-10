import { Request, Response, NextFunction } from 'express';
import { ReplayService } from './replay.service.js';

export class ReplayController {
  /**
   * Post endpoint to replay and resume execution of a failed/cancelled workflow.
   */
  public static async replay(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const actorId = req.user?.id || 'anonymous-actor';

      await ReplayService.replayWorkflow(id, actorId);

      res.status(200).json({
        success: true,
        message: 'Workflow execution replay has been successfully triggered.',
      });
    } catch (error) {
      next(error);
    }
  }
}
