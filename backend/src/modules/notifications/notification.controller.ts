import { Request, Response, NextFunction } from 'express';
import { NotificationService } from './notification.service.js';

export class NotificationController {
  /**
   * Fetch paginated notifications for the logged-in user.
   */
  public static async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;
      
      let read: boolean | undefined;
      if (req.query.read === 'true') read = true;
      if (req.query.read === 'false') read = false;

      const result = await NotificationService.getNotifications(
        userId,
        { read },
        { page, limit }
      );

      res.status(200).json({
        success: true,
        data: result.notifications,
        pagination: {
          page,
          limit,
          total: result.total,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Mark a notification as read.
   */
  public static async markRead(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const { id } = req.params;

      const notification = await NotificationService.markAsRead(id, userId);

      res.status(200).json({
        success: true,
        message: 'Notification marked as read',
        data: notification,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Delete a notification.
   */
  public static async delete(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const { id } = req.params;

      await NotificationService.deleteNotification(id, userId);

      res.status(200).json({
        success: true,
        message: 'Notification deleted successfully',
      });
    } catch (error) {
      next(error);
    }
  }
}
