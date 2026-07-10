import crypto from 'crypto';
import prisma from '../../prisma.js';
import { eventBus } from '../../events/event.bus.js';
import { TemplateService } from '../workflow/template.service.js';
import { logger } from '../../common/logger/logger.js';
import { NotFoundError, BadRequestError } from '../../common/errors/errors.js';
import { FeatureService } from '../feature-flags/feature.service.js';

export class WebhookService {
  /**
   * Create a Webhook configuration (Inbound or Outbound)
   */
  public static async createWebhook(
    name: string,
    url: string | undefined,
    events: string[] | undefined,
    secret: string | undefined,
    type: 'INBOUND' | 'OUTBOUND',
    templateId: string | undefined,
    tenantId: string
  ) {
    if (type === 'INBOUND' && !templateId) {
      throw new BadRequestError('Inbound webhooks must specify a templateId');
    }

    if (type === 'OUTBOUND' && !url) {
      throw new BadRequestError('Outbound webhooks must specify a destination URL');
    }

    return prisma.webhook.create({
      data: {
        name,
        url,
        events: events ? (events as any) : null,
        secret: secret || crypto.randomBytes(16).toString('hex'), // auto-generate if missing
        type,
        templateId,
        tenantId,
      },
    });
  }

  /**
   * List webhooks for a tenant
   */
  public static async listWebhooks(tenantId: string) {
    return prisma.webhook.findMany({
      where: { tenantId },
      include: { template: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Delete a webhook
   */
  public static async deleteWebhook(id: string, tenantId: string) {
    const webhook = await prisma.webhook.findFirst({
      where: { id, tenantId },
    });
    if (!webhook) {
      throw new NotFoundError('Webhook not found');
    }

    await prisma.webhook.delete({
      where: { id },
    });
  }

  /**
   * Trigger workflow from inbound webhook
   */
  public static async handleInbound(
    webhookId: string,
    payload: any,
    headers: any
  ) {
    const webhook = await prisma.webhook.findFirst({
      where: { id: webhookId, type: 'INBOUND' },
    });

    if (!webhook) {
      throw new NotFoundError('Inbound webhook not found');
    }

    if (!webhook.templateId) {
      throw new BadRequestError('Inbound webhook is not associated with a template');
    }

    // Optional: Verify signature if secret and signature header are present
    const signature = headers['x-jobflow-signature'];
    if (webhook.secret && signature) {
      const expected = crypto
        .createHmac('sha256', webhook.secret)
        .update(JSON.stringify(payload))
        .digest('hex');
      if (signature !== expected) {
        throw new BadRequestError('Invalid webhook signature');
      }
    }

    logger.info(`Triggering workflow template ${webhook.templateId} via inbound webhook ${webhookId}`);
    return TemplateService.startExecution(
      webhook.templateId,
      'webhook-trigger-system',
      webhook.tenantId,
      undefined,
      'WEBHOOK',
      { webhookId, payload }
    );
  }

  /**
   * Dispatch outbound webhook payload
   */
  private static async dispatchOutbound(
    webhook: any,
    event: string,
    payload: any
  ) {
    try {
      const timestamp = new Date().toISOString();
      const body = JSON.stringify({
        event,
        timestamp,
        webhookId: webhook.id,
        data: payload,
      });

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };

      if (webhook.secret) {
        const signature = crypto
          .createHmac('sha256', webhook.secret)
          .update(body)
          .digest('hex');
        headers['X-JobFlow-Signature'] = signature;
      }

      logger.info(`Dispatching outbound webhook callback to: ${webhook.url} for event: ${event}`);

      const response = await fetch(webhook.url, {
        method: 'POST',
        headers,
        body,
      });

      if (!response.ok) {
        logger.warn(
          `Outbound webhook warning: target ${webhook.url} returned status ${response.status}`
        );
      }
    } catch (error) {
      logger.error(`Failed to dispatch outbound webhook to ${webhook.url}:`, error);
    }
  }

  /**
   * Initialize in-process EventBus subscriptions for outbound dispatching
   */
  public static initDispatcher() {
    logger.info('Initializing Outbound Webhook Dispatcher subscriptions...');

    const handleEvent = async (event: string, payload: any) => {
      try {
        const tenantId = payload.workflow?.tenantId;
        if (!tenantId) return;

        // Check feature flag for webhooks
        const disableWebhooks = await FeatureService.isEnabled('disable-webhooks', { tenantId });
        if (disableWebhooks) {
          logger.info(`Outbound webhooks are disabled by feature flag 'disable-webhooks' for tenant ${tenantId}`);
          return;
        }

        // Query active outbound webhooks for this tenant
        const webhooks = await prisma.webhook.findMany({
          where: {
            tenantId,
            type: 'OUTBOUND',
          },
        });

        for (const webhook of webhooks) {
          const subscribedEvents = (webhook.events as string[]) || [];
          if (subscribedEvents.includes(event)) {
            // Asynchronously dispatch webhook without blocking the event execution loop
            this.dispatchOutbound(webhook, event, payload).catch((err) => {
              logger.error('Error in webhook dispatch handler:', err);
            });
          }
        }
      } catch (err) {
        logger.error('Error handling webhook dispatch subscription:', err);
      }
    };

    eventBus.subscribe('workflow.started', (payload) => handleEvent('workflow.started', payload));
    eventBus.subscribe('workflow.completed', (payload) => handleEvent('workflow.completed', payload));
    eventBus.subscribe('workflow.failed', (payload) => handleEvent('workflow.failed', payload));
  }
}
