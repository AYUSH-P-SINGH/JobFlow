import { z } from 'zod';
import { BaseHandler } from './base.handler.js';
import { logger } from '../../common/logger/logger.js';

const notificationPayloadSchema = z.object({
  recipientId: z.string().min(1, 'Recipient ID cannot be empty'),
  message: z.string().min(1, 'Notification message cannot be empty'),
});

export type NotificationPayload = z.infer<typeof notificationPayloadSchema>;

export interface NotificationResult {
  delivered: boolean;
  recipientId: string;
  channel: 'SMS' | 'PUSH' | 'IN_APP';
}

export class NotificationHandler extends BaseHandler<NotificationPayload, NotificationResult> {
  readonly type = 'NOTIFICATION';

  async validate(payload: NotificationPayload): Promise<void> {
    await notificationPayloadSchema.parseAsync(payload);
  }

  async execute(
    payload: NotificationPayload,
    progress: (percent: number) => Promise<void>
  ): Promise<NotificationResult> {
    logger.info(`[NotificationHandler] Dispatching notification to user ${payload.recipientId}...`);

    await progress(0);
    await new Promise((resolve) => setTimeout(resolve, 100));

    await progress(100);

    logger.info(`[NotificationHandler] Notification delivered to user ${payload.recipientId}`);
    return {
      delivered: true,
      recipientId: payload.recipientId,
      channel: 'SMS',
    };
  }

  async rollback(payload: NotificationPayload, error: Error): Promise<void> {
    logger.warn(`[NotificationHandler] Rollback notification dispatch for user ${payload.recipientId}: ${error.message}`);
  }
}
