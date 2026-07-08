import { Request, Response, NextFunction } from 'express';
import { CronService } from './cron.service.js';

export class SchedulerController {
  /**
   * Create a new cron schedule
   */
  public static async createSchedule(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { name, cron, templateId } = req.body;
      const tenantId = req.tenantId || 'default-tenant-id';

      if (!name || !cron || !templateId) {
        res.status(400).json({ error: 'name, cron, and templateId are required' });
        return;
      }

      const schedule = await CronService.createSchedule(name, cron, templateId, tenantId);
      res.status(201).json({
        message: 'Cron schedule created successfully',
        data: schedule,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * List all schedules for the tenant
   */
  public static async listSchedules(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const tenantId = req.tenantId || 'default-tenant-id';
      const schedules = await CronService.listSchedules(tenantId);
      res.status(200).json({
        data: schedules,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Delete/Remove a cron schedule
   */
  public static async deleteSchedule(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const tenantId = req.tenantId || 'default-tenant-id';

      await CronService.deleteSchedule(id, tenantId);
      res.status(200).json({
        message: 'Cron schedule deleted successfully',
      });
    } catch (error) {
      next(error);
    }
  }
}
