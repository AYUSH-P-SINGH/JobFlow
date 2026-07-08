import { Workflow, Job } from '@prisma/client';
import { eventBus } from './event.bus.js';
import { getCorrelationId } from '../common/tracing/context.js';

/**
 * Convenience methods to publish lifecycle events with correlation IDs.
 */
export class EventPublisher {
  /**
   * Publishes a workflow event with correlation ID from context.
   */
  public static publishWorkflowEvent(
    event: 'workflow.started' | 'workflow.updated' | 'workflow.completed' | 'workflow.failed' | 'workflow.cancelled',
    workflow: Workflow,
    error?: any
  ): void {
    eventBus.publish(event, {
      workflow,
      correlationId: getCorrelationId(),
      error,
    });
  }

  /**
   * Publishes a job event with correlation ID from context.
   */
  public static publishJobEvent(
    event: 'job.started' | 'job.progress' | 'job.completed' | 'job.failed' | 'job.cancelled',
    job: Job,
    progress?: number,
    result?: any,
    error?: any
  ): void {
    eventBus.publish(event, {
      job,
      correlationId: getCorrelationId(),
      progress,
      result,
      error,
    });
  }
}
