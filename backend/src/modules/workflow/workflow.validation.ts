import { z } from 'zod';
import { JobPriority, WorkflowStatus } from './workflow.types.js';

export const createWorkflowStepSchema = z.object({
  stepId: z.string().min(1, 'Step ID is required'),
  jobType: z.string().min(1, 'Job Type is required'),
  priority: z.nativeEnum(JobPriority).optional(),
  payload: z.record(z.string(), z.any()),
  dependsOn: z.array(z.string()),
});

export const createWorkflowSchema = z.object({
  body: z.object({
    name: z.string().min(1, 'Workflow name is required'),
    steps: z
      .array(createWorkflowStepSchema)
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
  }),
});

export const queryWorkflowsSchema = z.object({
  query: z.object({
    page: z.string().optional().transform((val) => (val ? parseInt(val, 10) : 1)),
    limit: z.string().optional().transform((val) => (val ? parseInt(val, 10) : 10)),
    status: z.nativeEnum(WorkflowStatus).optional(),
  }),
});

export const workflowIdParamSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid workflow ID format'),
  }),
});
