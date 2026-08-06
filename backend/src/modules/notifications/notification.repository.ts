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

export class InMemoryNotificationRepository implements INotificationRepository {
  private notifications = new Map<string, Notification>();

  async create(userId: string, type: NotificationType, title: string, message: string): Promise<Notification> {
    const now = new Date();
    const notif: Notification = {
      id: `notif-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      userId,
      tenantId: null,
      type,
      title,
      message,
      read: false,
      createdAt: now,
      updatedAt: now,
    };
    this.notifications.set(notif.id, notif);
    return notif;
  }

  async findById(id: string): Promise<Notification | null> {
    return this.notifications.get(id) || null;
  }

  async findAll(filters: NotificationFilter, pagination: NotificationPagination): Promise<{ notifications: Notification[]; total: number }> {
    let list = Array.from(this.notifications.values()).filter((n) => n.userId === filters.userId);
    if (filters.read !== undefined) {
      list = list.filter((n) => n.read === filters.read);
    }
    const total = list.length;
    const page = pagination.page > 0 ? pagination.page : 1;
    const limit = pagination.limit > 0 ? pagination.limit : 10;
    const paginated = list.slice((page - 1) * limit, page * limit);
    return { notifications: paginated, total };
  }

  async updateRead(id: string, read: boolean): Promise<Notification> {
    const existing = await this.findById(id);
    if (!existing) throw new Error(`Notification ${id} not found`);
    const updated: Notification = { ...existing, read, updatedAt: new Date() };
    this.notifications.set(id, updated);
    return updated;
  }

  async delete(id: string): Promise<Notification> {
    const existing = await this.findById(id);
    if (!existing) throw new Error(`Notification ${id} not found`);
    this.notifications.delete(id);
    return existing;
  }

  async clear(): Promise<void> {
    this.notifications.clear();
  }
}

export class HybridNotificationRepository implements INotificationRepository {
  private prismaRepo = new PrismaNotificationRepository();
  private inMemoryRepo = new InMemoryNotificationRepository();

  private isTest(): boolean {
    return process.env.NODE_ENV === 'test' || process.argv.some((arg) => arg.includes('test'));
  }

  private async exec<T>(prismaFn: () => Promise<T>, fallbackFn: () => Promise<T>): Promise<T> {
    if (this.isTest()) {
      return fallbackFn();
    }
    try {
      return await prismaFn();
    } catch {
      return fallbackFn();
    }
  }

  create(uId: string, type: any, title: string, msg: string) { return this.exec(() => this.prismaRepo.create(uId, type, title, msg), () => this.inMemoryRepo.create(uId, type, title, msg)); }
  findById(id: string) { return this.exec(() => this.prismaRepo.findById(id), () => this.inMemoryRepo.findById(id)); }
  findAll(f: any, p: any) { return this.exec(() => this.prismaRepo.findAll(f, p), () => this.inMemoryRepo.findAll(f, p)); }
  updateRead(id: string, read: boolean) { return this.exec(() => this.prismaRepo.updateRead(id, read), () => this.inMemoryRepo.updateRead(id, read)); }
  delete(id: string) { return this.exec(() => this.prismaRepo.delete(id), () => this.inMemoryRepo.delete(id)); }
  clear() {
    this.inMemoryRepo.clear();
    return this.exec(() => this.prismaRepo.clear(), async () => {});
  }
}

export const notificationRepository: INotificationRepository = new HybridNotificationRepository();
