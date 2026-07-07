import { z } from 'zod';
import { BaseHandler } from './base.handler.js';
import { logger } from '../../common/logger/logger.js';

const emailPayloadSchema = z.object({
  to: z.string().email('Invalid recipient email address'),
  subject: z.string().min(1, 'Subject cannot be empty'),
  body: z.string().min(1, 'Body cannot be empty'),
});

export type EmailPayload = z.infer<typeof emailPayloadSchema>;

export class EmailHandler extends BaseHandler<EmailPayload, { sent: boolean; recipient: string; timestamp: Date }> {
  readonly type = 'EMAIL';

  async validate(payload: EmailPayload): Promise<void> {
    await emailPayloadSchema.parseAsync(payload);
  }

  async execute(
    payload: EmailPayload,
    progress: (percent: number) => Promise<void>
  ): Promise<{ sent: boolean; recipient: string; timestamp: Date }> {
    logger.info(`[EmailHandler] Simulating sending email to ${payload.to}...`);

    await progress(0);
    // Simulate delay
    await new Promise((resolve) => setTimeout(resolve, 200));

    await progress(50);
    await new Promise((resolve) => setTimeout(resolve, 200));

    await progress(100);

    logger.info(`[EmailHandler] Email sent to ${payload.to}`);
    return {
      sent: true,
      recipient: payload.to,
      timestamp: new Date(),
    };
  }

  async rollback(payload: EmailPayload, error: Error): Promise<void> {
    logger.warn(`[EmailHandler] Executing rollback for email to ${payload.to}. Reason: ${error.message}`);
  }
}
