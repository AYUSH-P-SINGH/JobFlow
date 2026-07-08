import { auditRepository } from './audit.repository.js';
import { AuditLog } from '@prisma/client';
import { eventBus } from '../../events/event.bus.js';
import { logger } from '../../common/logger/logger.js';

export class AuditService {
  /**
   * Initializes automatic event bus subscriptions to generate audit logs.
   */
  public static initSubscriptions(): void {
    // 1. Workflow Started
    eventBus.subscribe('workflow.started', async ({ workflow }) => {
      await AuditService.log(
        workflow.userId,
        'Workflow Started',
        'Workflow',
        { workflowId: workflow.id, name: workflow.name }
      );
    });

    // 2. Workflow Completed
    eventBus.subscribe('workflow.completed', async ({ workflow }) => {
      await AuditService.log(
        workflow.userId,
        'Workflow Completed',
        'Workflow',
        { workflowId: workflow.id, name: workflow.name }
      );
    });

    // 3. Workflow Failed
    eventBus.subscribe('workflow.failed', async ({ workflow, error }) => {
      await AuditService.log(
        workflow.userId,
        'Workflow Failed',
        'Workflow',
        { workflowId: workflow.id, name: workflow.name, error: error?.message }
      );
    });

    // 4. Workflow Cancelled
    eventBus.subscribe('workflow.cancelled', async ({ workflow }) => {
      await AuditService.log(
        workflow.userId,
        'Workflow Cancelled',
        'Workflow',
        { workflowId: workflow.id, name: workflow.name }
      );
    });

    // 5. Job Cancelled
    eventBus.subscribe('job.cancelled', async ({ job }) => {
      await AuditService.log(
        job.userId,
        'Job Cancelled',
        'Job',
        { jobId: job.id, title: job.title }
      );
    });

    logger.info('Audit log event subscriptions initialized');
  }

  /**
   * Record a new audit log.
   */
  public static async log(
    actor: string,
    action: string,
    resource: string,
    metadata?: any
  ): Promise<AuditLog> {
    const logEntry = await auditRepository.create(actor, action, resource, metadata);
    logger.debug(`[Audit] Action "${action}" on "${resource}" performed by actor "${actor}"`);
    return logEntry;
  }

  /**
   * Retrieves all audit logs.
   */
  public static async getLogs(
    filters?: { actor?: string; resource?: string; action?: string },
    pagination?: { page: number; limit: number }
  ): Promise<{ auditLogs: AuditLog[]; total: number }> {
    return auditRepository.findAll(filters, pagination);
  }
}
