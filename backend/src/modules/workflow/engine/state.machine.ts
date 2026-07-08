import { WorkflowStatus } from '../workflow.types.js';
import { BadRequestError } from '../../../common/errors/errors.js';

export class WorkflowStateMachine {
  private static transitions: Record<WorkflowStatus, WorkflowStatus[]> = {
    [WorkflowStatus.PENDING]: [WorkflowStatus.RUNNING, WorkflowStatus.CANCELLED],
    [WorkflowStatus.RUNNING]: [WorkflowStatus.COMPLETED, WorkflowStatus.FAILED, WorkflowStatus.CANCELLED],
    [WorkflowStatus.COMPLETED]: [],
    [WorkflowStatus.FAILED]: [WorkflowStatus.PENDING, WorkflowStatus.RUNNING],
    [WorkflowStatus.CANCELLED]: [WorkflowStatus.PENDING, WorkflowStatus.RUNNING],
  };

  public static validateTransition(from: WorkflowStatus, to: WorkflowStatus): void {
    if (from === to) return;
    const allowed = this.transitions[from];
    if (!allowed || !allowed.includes(to)) {
      throw new BadRequestError(`Illegal workflow status transition from ${from} to ${to}`);
    }
  }
}
