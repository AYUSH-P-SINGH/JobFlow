import { notificationRepository } from './notification.repository.js';
import { Notification, NotificationType, NotificationFilter, NotificationPagination } from './notification.types.js';
import { eventBus } from '../../events/event.bus.js';
import { getSocketServer } from '../../socket/socket.server.js';
import { logger } from '../../common/logger/logger.js';
import { NotFoundError } from '../../common/errors/errors.js';

export class NotificationService {
  /**
   * Initializes automatic event bus subscriptions to generate notifications.
   */
  public static initSubscriptions(): void {
    // 1. Notify on Workflow Completion
    eventBus.subscribe('workflow.completed', async ({ workflow }) => {
      await NotificationService.createNotification(
        workflow.userId,
        'SUCCESS',
        'Workflow Completed',
        `Your workflow "${workflow.name}" has completed successfully.`
      );
    });

    // 2. Notify on Workflow Failure
    eventBus.subscribe('workflow.failed', async ({ workflow, error }) => {
      await NotificationService.createNotification(
        workflow.userId,
        'ERROR',
        'Workflow Failed',
        `Your workflow "${workflow.name}" has failed: ${error?.message || 'Step execution failure'}.`
      );
    });

    // 3. Notify on Job Failure
    eventBus.subscribe('job.failed', async ({ job, error }) => {
      // If it's a stand-alone job, or we want to notify anyway
      await NotificationService.createNotification(
        job.userId,
        'WARNING',
        'Job Execution Failed',
        `Job "${job.title}" (${job.type}) failed: ${error?.message || 'Handler execution error'}.`
      );
    });

    logger.info('Notification event subscriptions initialized');
  }

  /**
   * Creates a notification, persists it, and streams it to the user's socket room.
   */
  public static async createNotification(
    userId: string,
    type: NotificationType,
    title: string,
    message: string
  ): Promise<Notification> {
    const notification = await notificationRepository.create(userId, type, title, message);
    logger.info(`[Notification] Created notification "${title}" for user ${userId}`);

    // Stream live notification to the user's WebSocket room
    try {
      const io = getSocketServer();
      io.to(`room:user:${userId}`).emit('notification.created', notification);
    } catch (error) {
      // Socket server might not be initialized in some integration tests/scripts
    }

    return notification;
  }

  /**
   * Lists paginated notifications for a user.
   */
  public static async getNotifications(
    userId: string,
    filters: Omit<NotificationFilter, 'userId'>,
    pagination: NotificationPagination
  ): Promise<{ notifications: Notification[]; total: number }> {
    return notificationRepository.findAll({ userId, ...filters }, pagination);
  }

  /**
   * Marks a notification as read.
   */
  public static async markAsRead(id: string, userId: string): Promise<Notification> {
    const notification = await notificationRepository.findById(id);
    if (!notification || notification.userId !== userId) {
      throw new NotFoundError('Notification not found');
    }
    return notificationRepository.updateRead(id, true);
  }

  /**
   * Deletes a notification.
   */
  public static async deleteNotification(id: string, userId: string): Promise<Notification> {
    const notification = await notificationRepository.findById(id);
    if (!notification || notification.userId !== userId) {
      throw new NotFoundError('Notification not found');
    }
    return notificationRepository.delete(id);
  }
}
