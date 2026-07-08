import prisma from '../../prisma.js';
import {
  Workflow,
  WorkflowStep,
  WorkflowHistory,
  WorkflowStatus,
  CreateWorkflowInput,
  WorkflowFilter,
  WorkflowPagination,
  CreateWorkflowStepInput,
} from './workflow.types.js';

export interface IWorkflowRepository {
  create(name: string, userId: string, steps: CreateWorkflowStepInput[]): Promise<Workflow & { steps: WorkflowStep[] }>;
  findById(id: string): Promise<(Workflow & { steps: WorkflowStep[]; histories: WorkflowHistory[] }) | null>;
  findAll(
    filters: WorkflowFilter,
    pagination: WorkflowPagination,
    sortBy?: string,
    sortOrder?: 'asc' | 'desc'
  ): Promise<{ workflows: Workflow[]; total: number }>;
  updateStatus(id: string, status: WorkflowStatus, currentStep?: string | null): Promise<Workflow>;
  updateProgress(id: string, progress: number): Promise<Workflow>;
  updateStepStatus(
    id: string,
    status: WorkflowStatus,
    startedAt?: Date,
    completedAt?: Date
  ): Promise<WorkflowStep>;
  linkJobToStep(id: string, jobId: string): Promise<WorkflowStep>;
  addHistory(workflowId: string, event: string, message: string, stepId?: string | null): Promise<WorkflowHistory>;
  getMetrics(): Promise<{
    activeWorkflows: number;
    failedWorkflows: number;
    successRate: number;
    averageDuration: number;
  }>;
  clear(): Promise<void>;
}

export class PrismaWorkflowRepository implements IWorkflowRepository {
  async create(name: string, userId: string, steps: CreateWorkflowStepInput[]): Promise<Workflow & { steps: WorkflowStep[] }> {
    return prisma.$transaction(async (tx) => {
      const workflow = await tx.workflow.create({
        data: {
          name,
          userId,
          status: WorkflowStatus.PENDING,
          progress: 0.0,
        },
      });

      const stepsData = steps.map((step, idx) => ({
        workflowId: workflow.id,
        stepId: step.stepId,
        stepNumber: idx + 1,
        jobType: step.jobType,
        priority: step.priority || 'MEDIUM',
        payload: step.payload,
        dependsOn: step.dependsOn,
        status: WorkflowStatus.PENDING,
      }));

      await tx.workflowStep.createMany({
        data: stepsData,
      });

      const createdSteps = await tx.workflowStep.findMany({
        where: { workflowId: workflow.id },
        orderBy: { stepNumber: 'asc' },
      });

      return {
        ...workflow,
        steps: createdSteps,
      };
    });
  }

  async findById(id: string): Promise<(Workflow & { steps: WorkflowStep[]; histories: WorkflowHistory[] }) | null> {
    return prisma.workflow.findUnique({
      where: { id },
      include: {
        steps: {
          orderBy: { stepNumber: 'asc' },
        },
        histories: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });
  }

  async findAll(
    filters: WorkflowFilter,
    pagination: WorkflowPagination,
    sortBy: string = 'createdAt',
    sortOrder: 'asc' | 'desc' = 'desc'
  ): Promise<{ workflows: Workflow[]; total: number }> {
    const where: any = {};

    if (filters.userId) {
      where.userId = filters.userId;
    }
    if (filters.status) {
      where.status = filters.status;
    }

    const page = pagination.page > 0 ? pagination.page : 1;
    const limit = pagination.limit > 0 ? pagination.limit : 10;
    const skip = (page - 1) * limit;

    const allowedSortFields = ['createdAt', 'updatedAt', 'name', 'status', 'progress'];
    const orderField = allowedSortFields.includes(sortBy) ? sortBy : 'createdAt';

    const [workflows, total] = await Promise.all([
      prisma.workflow.findMany({
        where,
        orderBy: {
          [orderField]: sortOrder,
        },
        skip,
        take: limit,
      }),
      prisma.workflow.count({
        where,
      }),
    ]);

    return { workflows, total };
  }

  async updateStatus(id: string, status: WorkflowStatus, currentStep?: string | null): Promise<Workflow> {
    const data: any = { status };
    if (currentStep !== undefined) {
      data.currentStep = currentStep;
    }
    return prisma.workflow.update({
      where: { id },
      data,
    });
  }

  async updateProgress(id: string, progress: number): Promise<Workflow> {
    return prisma.workflow.update({
      where: { id },
      data: { progress },
    });
  }

  async updateStepStatus(
    id: string,
    status: WorkflowStatus,
    startedAt?: Date,
    completedAt?: Date
  ): Promise<WorkflowStep> {
    const data: any = { status };
    if (startedAt !== undefined) {
      data.startedAt = startedAt;
    }
    if (completedAt !== undefined) {
      data.completedAt = completedAt;
    }
    return prisma.workflowStep.update({
      where: { id },
      data,
    });
  }

  async linkJobToStep(id: string, jobId: string): Promise<WorkflowStep> {
    return prisma.workflowStep.update({
      where: { id },
      data: { jobId },
    });
  }

  async addHistory(workflowId: string, event: string, message: string, stepId?: string | null): Promise<WorkflowHistory> {
    return prisma.workflowHistory.create({
      data: {
        workflowId,
        stepId: stepId || null,
        event,
        message,
      },
    });
  }

  async getMetrics(): Promise<{
    activeWorkflows: number;
    failedWorkflows: number;
    successRate: number;
    averageDuration: number;
  }> {
    const [active, failed, completed] = await Promise.all([
      prisma.workflow.count({ where: { status: WorkflowStatus.RUNNING } }),
      prisma.workflow.count({ where: { status: WorkflowStatus.FAILED } }),
      prisma.workflow.findMany({
        where: { status: WorkflowStatus.COMPLETED },
        select: { createdAt: true, updatedAt: true },
      }),
    ]);

    const totalFinished = completed.length + failed;
    const successRate = totalFinished > 0 ? (completed.length / totalFinished) * 100 : 0;

    let averageDuration = 0;
    if (completed.length > 0) {
      const totalDuration = completed.reduce((sum, w) => {
        return sum + (w.updatedAt.getTime() - w.createdAt.getTime());
      }, 0);
      averageDuration = totalDuration / completed.length;
    }

    return {
      activeWorkflows: active,
      failedWorkflows: failed,
      successRate: Math.round(successRate * 100) / 100,
      averageDuration: Math.round(averageDuration),
    };
  }

  async clear(): Promise<void> {
    await prisma.workflowHistory.deleteMany({});
    await prisma.workflowStep.deleteMany({});
    await prisma.workflow.deleteMany({});
  }
}

export const workflowRepository = new PrismaWorkflowRepository();
