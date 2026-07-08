import { Notification, NotificationType } from '@prisma/client';

export { Notification, NotificationType };

export interface NotificationFilter {
  userId: string;
  read?: boolean;
}

export interface NotificationPagination {
  page: number;
  limit: number;
}
