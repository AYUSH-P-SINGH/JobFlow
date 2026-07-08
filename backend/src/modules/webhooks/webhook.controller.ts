import { Request, Response, NextFunction } from 'express';
import { WebhookService } from './webhook.service.js';

export class WebhookController {
  /**
   * Create a Webhook configuration
   */
  public static async createWebhook(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { name, url, events, secret, type, templateId } = req.body;
      const tenantId = req.tenantId || 'default-tenant-id';

      if (!name || !type) {
        res.status(400).json({ error: 'name and type are required' });
        return;
      }

      const webhook = await WebhookService.createWebhook(
        name,
        url,
        events,
        secret,
        type,
        templateId,
        tenantId
      );

      res.status(201).json({
        message: 'Webhook configuration created successfully',
        data: webhook,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * List all webhooks for the tenant
   */
  public static async listWebhooks(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const tenantId = req.tenantId || 'default-tenant-id';
      const webhooks = await WebhookService.listWebhooks(tenantId);
      res.status(200).json({
        data: webhooks,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Delete a webhook configuration
   */
  public static async deleteWebhook(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const tenantId = req.tenantId || 'default-tenant-id';

      await WebhookService.deleteWebhook(id, tenantId);
      res.status(200).json({
        message: 'Webhook configuration deleted successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Handle public Inbound Webhook execution triggers
   */
  public static async handleInboundWebhook(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { webhookId } = req.params;
      const run = await WebhookService.handleInbound(webhookId, req.body, req.headers);

      res.status(201).json({
        message: 'Workflow execution triggered successfully via inbound webhook',
        data: {
          id: run?.id,
          name: run?.name,
          status: run?.status,
        },
      });
    } catch (error) {
      next(error);
    }
  }
}
