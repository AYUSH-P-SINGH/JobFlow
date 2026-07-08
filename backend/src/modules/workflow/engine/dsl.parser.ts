import { z } from 'zod';
import { JobPriority } from '../workflow.types.js';
import { BadRequestError } from '../../../common/errors/errors.js';

export const dslStepSchema = z.object({
  stepId: z.string().min(1, 'Step ID is required'),
  jobType: z.string().min(1, 'Job Type is required'),
  priority: z.nativeEnum(JobPriority).default(JobPriority.MEDIUM),
  payload: z.record(z.string(), z.any()).default({}),
  dependsOn: z.array(z.string()).default([]),
});

export const workflowDslSchema = z.object({
  name: z.string().min(1, 'Workflow name is required'),
  description: z.string().optional(),
  steps: z
    .array(dslStepSchema)
    .min(1, 'Workflow must contain at least one step')
    .refine(
      (steps) => {
        const stepIds = steps.map((s) => s.stepId);
        return new Set(stepIds).size === stepIds.length;
      },
      { message: 'Step IDs must be unique within the workflow' }
    )
    .refine(
      (steps) => {
        const stepIds = new Set(steps.map((s) => s.stepId));
        for (const step of steps) {
          for (const dep of step.dependsOn) {
            if (!stepIds.has(dep)) {
              return false;
            }
          }
        }
        return true;
      },
      { message: 'Dependencies must reference existing step IDs' }
    )
    .refine(
      (steps) => {
        const adj = new Map<string, string[]>();
        for (const s of steps) {
          adj.set(s.stepId, s.dependsOn);
        }
        const visited = new Map<string, number>();
        const dfs = (node: string): boolean => {
          visited.set(node, 1);
          const neighbors = adj.get(node) || [];
          for (const neighbor of neighbors) {
            if (visited.get(neighbor) === 1) return true;
            if ((visited.get(neighbor) || 0) === 0) {
              if (dfs(neighbor)) return true;
            }
          }
          visited.set(node, 2);
          return false;
        };
        for (const s of steps) {
          if ((visited.get(s.stepId) || 0) === 0) {
            if (dfs(s.stepId)) return false;
          }
        }
        return true;
      },
      { message: 'Circular dependencies detected in workflow steps' }
    ),
});

export type WorkflowDsl = z.infer<typeof workflowDslSchema>;

export class DslParser {
  public static parse(dslContent: unknown): WorkflowDsl {
    const parsed = workflowDslSchema.safeParse(dslContent);
    if (!parsed.success) {
      const errorMsg = parsed.error.issues.map((e: any) => `${e.path.join('.')}: ${e.message}`).join(', ');
      throw new BadRequestError(`Invalid JSON DSL: ${errorMsg}`);
    }
    return parsed.data;
  }
}
