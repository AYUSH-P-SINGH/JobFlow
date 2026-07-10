import { Request, Response, NextFunction } from 'express';
import { WorkflowGeneratorService } from './workflow-generator.service.js';

export class WorkflowGeneratorController {
  /**
   * Post endpoint to compile a natural language description into workflow steps.
   */
  public static async generateWorkflow(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { prompt } = req.body;

      if (!prompt || typeof prompt !== 'string') {
        res.status(400).json({
          success: false,
          error: 'Parameter "prompt" is required and must be a string.',
        });
        return;
      }

      const result = await WorkflowGeneratorService.generate(prompt);
      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }
}
