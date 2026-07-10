import { BaseHandler } from './base.handler.js';
import { EmailHandler } from './email.handler.js';
import { ReportHandler } from './report.handler.js';
import { NotificationHandler } from './notification.handler.js';
import { ImageHandler } from './image.handler.js';

export class HandlerFactory {
  private static handlers = new Map<string, BaseHandler>();

  /**
   * Registers a job handler.
   */
  public static register(type: string, handler: BaseHandler) {
    this.handlers.set(type.toUpperCase(), handler);
  }

  /**
   * Retrieves a job handler for a given job type.
   * Throws an error if no handler is registered for the type.
   */
  public static getHandler(type: string): BaseHandler {
    const handler = this.handlers.get(type.toUpperCase());
    if (!handler) {
      throw new Error(`Unsupported job type: "${type}". No handler registered.`);
    }
    return handler;
  }

  /**
   * Retrieves all registered handlers.
   */
  public static getRegisteredTypes(): string[] {
    return Array.from(this.handlers.keys());
  }
}

// Automatically register default core handlers
HandlerFactory.register('EMAIL', new EmailHandler());
HandlerFactory.register('REPORT', new ReportHandler());
HandlerFactory.register('NOTIFICATION', new NotificationHandler());
HandlerFactory.register('IMAGE', new ImageHandler());

// Default core handlers are registered on module load. Plugins register themselves dynamically.
