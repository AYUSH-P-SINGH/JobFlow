import { WorkflowStep, WorkflowStatus } from '../workflow.types.js';

export class DependencyResolver {
  /**
   * Finds steps that are PENDING and have all their dependencies COMPLETED.
   */
  public static findReadySteps(steps: (WorkflowStep & { job?: any })[]): (WorkflowStep & { job?: any })[] {
    const completedStepIds = new Set(
      steps.filter((s) => s.status === WorkflowStatus.COMPLETED).map((s) => s.stepId)
    );

    const failedOrCancelledStepIds = new Set(
      steps
        .filter((s) => s.status === WorkflowStatus.FAILED || s.status === WorkflowStatus.CANCELLED)
        .map((s) => s.stepId)
    );

    return steps.filter((step) => {
      // Step must be PENDING
      if (step.status !== WorkflowStatus.PENDING) {
        return false;
      }

      // Check dependsOn array
      const deps = (step.dependsOn as string[]) || [];

      // If any dependency has failed/cancelled, this step cannot run (will be handled as cascading cancellation)
      const hasFailedDeps = deps.some((depId) => failedOrCancelledStepIds.has(depId));
      if (hasFailedDeps) {
        return false;
      }

      // All dependencies must be completed
      return deps.every((depId) => completedStepIds.has(depId));
    });
  }

  /**
   * Safely evaluates a simple JavaScript expression for step conditions against the workflow context.
   * Format supported: "steps.<stepId>.<field> === <value>" or "steps.<stepId>.result.<field> === <value>"
   * Operators: ==, ===, !=, !==, >, <, >=, <=
   */
  public static evaluateCondition(condition: string, steps: (WorkflowStep & { job?: any })[]): boolean {
    if (!condition) return true;
    try {
      const context: any = { steps: {} };
      for (const s of steps) {
        context.steps[s.stepId] = {
          status: s.status,
          result: s.job?.result || {},
        };
      }

      const parts = condition.trim().split(/\s+/);
      if (parts.length !== 3) {
        throw new Error(`Invalid condition format: "${condition}". Expected: variable operator value`);
      }

      const [leftHand, operator, rightHand] = parts;

      const getValueAtPath = (obj: any, path: string) => {
        return path.split('.').reduce((acc, part) => {
          return acc && acc[part] !== undefined ? acc[part] : undefined;
        }, obj);
      };

      const leftVal = getValueAtPath(context, leftHand);

      let rightVal: any = rightHand;
      if (rightHand === 'true') rightVal = true;
      else if (rightHand === 'false') rightVal = false;
      else if (rightHand === 'null') rightVal = null;
      else if (rightHand.startsWith("'") && rightHand.endsWith("'")) {
        rightVal = rightHand.slice(1, -1);
      } else if (rightHand.startsWith('"') && rightHand.endsWith('"')) {
        rightVal = rightHand.slice(1, -1);
      } else if (!isNaN(Number(rightHand))) {
        rightVal = Number(rightHand);
      }

      switch (operator) {
        case '===':
        case '==':
          return leftVal === rightVal;
        case '!==':
        case '!=':
          return leftVal !== rightVal;
        case '>':
          return Number(leftVal) > Number(rightVal);
        case '<':
          return Number(leftVal) < Number(rightVal);
        case '>=':
          return Number(leftVal) >= Number(rightVal);
        case '<=':
          return Number(leftVal) <= Number(rightVal);
        default:
          return false;
      }
    } catch (err) {
      return false;
    }
  }

  /**
   * Helper to perform cascading cancellation.
   * If a step is cancelled or fails, all downstream steps that depend on it are cancelled.
   */
  public static resolveCascadingCancellations(
    steps: (WorkflowStep & { job?: any })[],
    changedStepIds: string[]
  ): string[] {
    const cancelledStepIds = new Set(changedStepIds);
    let added = true;

    while (added) {
      added = false;
      for (const step of steps) {
        if (step.status === WorkflowStatus.PENDING && !cancelledStepIds.has(step.stepId)) {
          const deps = (step.dependsOn as string[]) || [];
          const hasCancelledDeps = deps.some((depId) => cancelledStepIds.has(depId));
          if (hasCancelledDeps) {
            cancelledStepIds.add(step.stepId);
            added = true;
          }
        }
      }
    }

    return Array.from(cancelledStepIds).filter((id) => !changedStepIds.includes(id));
  }
}
