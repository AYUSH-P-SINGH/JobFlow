import prisma from '../../prisma.js';
import { Notification, NotificationType, NotificationFilter, NotificationPagination } from './notification.types.js';

export interface INotificationRepository {
  create(userId: string, type: NotificationType, title: string, message: string): Promise<Notification>;
  findById(id: string): Promise<Notification | null>;
  findAll(filters: NotificationFilter, pagination: NotificationPagination): Promise<{ notifications: Notification[]; total: number }>;
  updateRead(id: string, read: boolean): Promise<Notification>;
  delete(id: string): Promise<Notification>;
  clear(): Promise<void>;
}

export class PrismaNotificationRepository implements INotificationRepository {
  async create(userId: string, type: NotificationType, title: string, message: string): Promise<Notification> {
    return prisma.notification.create({
      data: {
        userId,
        type,
        title,
        message,
        read: false,
      },
    });
  }

  async findById(id: string): Promise<Notification | null> {
    return prisma.notification.findUnique({
      where: { id },
    });
  }

  async findAll(
    filters: NotificationFilter,
    pagination: NotificationPagination
  ): Promise<{ notifications: Notification[]; total: number }> {
    const where: any = { userId: filters.userId };
    if (filters.read !== undefined) {
      where.read = filters.read;
    }

    const page = pagination.page > 0 ? pagination.page : 1;
    const limit = pagination.limit > 0 ? pagination.limit : 10;
    const skip = (page - 1) * limit;

    const [notifications, total] = await Promise.all([
      prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.notification.count({ where }),
    ]);

    return { notifications, total };
  }

  async updateRead(id: string, read: boolean): Promise<Notification> {
    return prisma.notification.update({
      where: { id },
      data: { read },
    });
  }

  async delete(id: string): Promise<Notification> {
    return prisma.notification.delete({
      where: { id },
    });
  }

  async clear(): Promise<void> {
    await prisma.notification.deleteMany({});
  }
}

export const notificationRepository = new PrismaNotificationRepository();
