import { Request, Response, NextFunction } from 'express';
import { MetricsService } from './metrics.service.js';
import { AuditService } from './audit.service.js';
import { ActivityService } from './activity.service.js';

export class MetricsController {
  /**
   * GET /api/v1/monitoring/dashboard
   */
  public static async dashboard(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const stats = await MetricsService.getDashboardStats();
      res.status(200).json({ success: true, data: stats });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/monitoring/queues
   */
  public static async queues(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const stats = await MetricsService.getQueueStats();
      res.status(200).json({ success: true, data: stats });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/monitoring/workflows
   */
  public static async workflows(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const stats = await MetricsService.getWorkflowStats();
      res.status(200).json({ success: true, data: stats });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/monitoring/workers
   */
  public static async workers(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const stats = await MetricsService.getWorkerStats();
      res.status(200).json({ success: true, data: stats });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/monitoring/logs
   */
  public static async logs(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const actor = req.query.actor as string;
      const resource = req.query.resource as string;
      const action = req.query.action as string;
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;

      const result = await AuditService.getLogs({ actor, resource, action }, { page, limit });
      res.status(200).json({
        success: true,
        data: result.auditLogs,
        pagination: { page, limit, total: result.total },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/monitoring/workflows/:id/timeline
   */
  public static async timeline(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const userId = req.user!.id;
      const role = req.user!.role;

      const timeline = await ActivityService.getWorkflowTimeline(id, userId, role);
      res.status(200).json({ success: true, data: timeline });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /metrics
   */
  public static async prometheus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const metrics = await MetricsService.getPrometheusMetrics();
      res.setHeader('Content-Type', 'text/plain; version=0.0.4; charset=utf-8');
      res.end(metrics);
    } catch (error) {
      next(error);
    }
  }
}
