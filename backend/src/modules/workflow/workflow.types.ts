import { WorkflowStatus, JobPriority, Workflow as PrismaWorkflow, WorkflowStep as PrismaWorkflowStep, WorkflowHistory as PrismaWorkflowHistory } from '@prisma/client';

export { WorkflowStatus, JobPriority };
export type Workflow = PrismaWorkflow;
export type WorkflowStep = PrismaWorkflowStep;
export type WorkflowHistory = PrismaWorkflowHistory;

export interface CreateWorkflowStepInput {
  stepId: string;
  jobType: string;
  priority?: JobPriority;
  payload: Record<string, any>;
  dependsOn: string[];
}

export interface CreateWorkflowInput {
  name: string;
  steps: CreateWorkflowStepInput[];
}

export interface WorkflowFilter {
  userId?: string;
  status?: WorkflowStatus;
}

export interface WorkflowPagination {
  page: number;
  limit: number;
}
