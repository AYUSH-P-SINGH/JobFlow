import { Request, Response, NextFunction } from 'express';
import { SimulatorService } from './simulator.service.js';

export class SimulatorController {
  /**
   * Post endpoint to simulate execution logic and perform static checks on a workflow.
   */
  public static async simulateWorkflow(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { steps } = req.body;
      const userId = req.user?.id || 'anonymous-user';
      const tenantId = req.tenantId || null;

      if (!steps || !Array.isArray(steps)) {
        res.status(400).json({
          success: false,
          error: 'Parameter "steps" is required and must be a steps array.',
        });
        return;
      }

      const report = await SimulatorService.simulate(steps, userId, tenantId);
      res.status(200).json({
        success: true,
        data: report,
      });
    } catch (error) {
      next(error);
    }
  }
}
