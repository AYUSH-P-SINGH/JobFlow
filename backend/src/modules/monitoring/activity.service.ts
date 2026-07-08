import { workflowRepository } from '../workflow/workflow.repository.js';
import { NotFoundError, ForbiddenError } from '../../common/errors/errors.js';

export interface TimelineEvent {
  timestamp: Date;
  event: string;
  message: string;
  stepId?: string | null;
}

export class ActivityService {
  /**
   * Aggregates workflow history events to construct a clean chronological execution timeline.
   */
  public static async getWorkflowTimeline(
    workflowId: string,
    userId: string,
    role: string
  ): Promise<TimelineEvent[]> {
    const workflow = await workflowRepository.findById(workflowId);
    if (!workflow) {
      throw new NotFoundError('Workflow not found');
    }

    // Authorization check
    if (role !== 'ADMIN' && workflow.userId !== userId) {
      throw new ForbiddenError('You are not authorized to view this timeline');
    }

    return workflow.histories.map((history) => ({
      timestamp: history.createdAt,
      event: history.event,
      message: history.message,
      stepId: history.stepId,
    }));
  }
}
