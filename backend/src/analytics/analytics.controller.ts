import { Request, Response, NextFunction } from 'express';
import { AnalyticsService } from './analytics.service.js';

export class AnalyticsController {
  /**
   * GET /api/v1/analytics
   * Exposes structured workflow performance and SRE host metrics.
   */
  public static async getAnalytics(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const data = await AnalyticsService.getAnalytics();
      res.status(200).json({
        success: true,
        data,
      });
    } catch (error) {
      next(error);
    }
  }
}
