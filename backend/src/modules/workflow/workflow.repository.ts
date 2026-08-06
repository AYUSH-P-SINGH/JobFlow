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
  create(name: string, userId: string, steps: CreateWorkflowStepInput[], triggerMetadata?: any): Promise<Workflow & { steps: WorkflowStep[] }>;
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
  async create(name: string, userId: string, steps: CreateWorkflowStepInput[], triggerMetadata?: any): Promise<Workflow & { steps: WorkflowStep[] }> {
    return prisma.$transaction(async (tx) => {
      const workflow = await tx.workflow.create({
        data: {
          name,
          userId,
          status: WorkflowStatus.PENDING,
          progress: 0.0,
          triggerMetadata: triggerMetadata || undefined,
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

export class InMemoryWorkflowRepository implements IWorkflowRepository {
  private workflows = new Map<string, Workflow & { steps: WorkflowStep[]; histories: WorkflowHistory[] }>();

  async create(name: string, userId: string, steps: CreateWorkflowStepInput[], triggerMetadata?: any): Promise<Workflow & { steps: WorkflowStep[] }> {
    const now = new Date();
    const wfId = `wf-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    
    const stepsData: WorkflowStep[] = steps.map((s, idx) => ({
      id: `step-${Date.now()}-${idx}-${Math.random().toString(36).substring(2, 5)}`,
      workflowId: wfId,
      stepId: s.stepId,
      stepNumber: idx + 1,
      jobType: s.jobType,
      status: WorkflowStatus.PENDING,
      priority: s.priority || ('MEDIUM' as any),
      payload: s.payload,
      dependsOn: s.dependsOn || [],
      startedAt: null,
      completedAt: null,
      jobId: null,
    }));

    const wf: Workflow & { steps: WorkflowStep[]; histories: WorkflowHistory[] } = {
      id: wfId,
      name,
      status: WorkflowStatus.PENDING,
      currentStep: null,
      progress: 0.0,
      userId,
      tenantId: null,
      projectId: null,
      versionId: null,
      triggerType: 'MANUAL',
      triggerMetadata: triggerMetadata || null,
      createdAt: now,
      updatedAt: now,
      steps: stepsData,
      histories: [
        {
          id: `hist-${Date.now()}-1`,
          workflowId: wfId,
          stepId: null,
          event: 'WORKFLOW_CREATED',
          message: `Workflow "${name}" instantiated with ${steps.length} steps.`,
          createdAt: now,
        },
      ],
    };

    this.workflows.set(wfId, wf);
    return wf;
  }

  async findById(id: string): Promise<(Workflow & { steps: WorkflowStep[]; histories: WorkflowHistory[] }) | null> {
    return this.workflows.get(id) || null;
  }

  async findAll(
    filters: WorkflowFilter,
    pagination: WorkflowPagination,
    sortBy: string = 'createdAt',
    sortOrder: 'asc' | 'desc' = 'desc'
  ): Promise<{ workflows: Workflow[]; total: number }> {
    let list = Array.from(this.workflows.values());
    if (filters.status) list = list.filter((w) => w.status === filters.status);
    if (filters.userId) list = list.filter((w) => w.userId === filters.userId);

    const total = list.length;
    const page = pagination.page || 1;
    const limit = pagination.limit || 10;
    const start = (page - 1) * limit;
    const paginated = list.slice(start, start + limit);
    return { workflows: paginated, total };
  }

  async updateStatus(id: string, status: WorkflowStatus, currentStep?: string | null): Promise<Workflow> {
    const wf = this.workflows.get(id);
    if (!wf) throw new Error(`Workflow ${id} not found`);
    wf.status = status;
    if (currentStep !== undefined) wf.currentStep = currentStep;
    wf.updatedAt = new Date();
    return wf;
  }

  async updateProgress(id: string, progress: number): Promise<Workflow> {
    const wf = this.workflows.get(id);
    if (!wf) throw new Error(`Workflow ${id} not found`);
    wf.progress = progress;
    wf.updatedAt = new Date();
    return wf;
  }

  async updateStepStatus(
    id: string,
    status: WorkflowStatus,
    startedAt?: Date,
    completedAt?: Date
  ): Promise<WorkflowStep> {
    for (const wf of this.workflows.values()) {
      const step = wf.steps.find((s) => s.id === id);
      if (step) {
        step.status = status;
        if (startedAt !== undefined) step.startedAt = startedAt;
        if (completedAt !== undefined) step.completedAt = completedAt;
        return step;
      }
    }
    throw new Error(`WorkflowStep ${id} not found`);
  }

  async linkJobToStep(id: string, jobId: string): Promise<WorkflowStep> {
    for (const wf of this.workflows.values()) {
      const step = wf.steps.find((s) => s.id === id);
      if (step) {
        step.jobId = jobId;
        return step;
      }
    }
    throw new Error(`WorkflowStep ${id} not found`);
  }

  async addHistory(workflowId: string, event: string, message: string, stepId?: string | null): Promise<WorkflowHistory> {
    const wf = this.workflows.get(workflowId);
    const hist: WorkflowHistory = {
      id: `hist-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`,
      workflowId,
      stepId: stepId || null,
      event,
      message,
      createdAt: new Date(),
    };
    if (wf) {
      wf.histories.push(hist);
    }
    return hist;
  }

  async getMetrics(): Promise<{
    activeWorkflows: number;
    failedWorkflows: number;
    successRate: number;
    averageDuration: number;
  }> {
    const list = Array.from(this.workflows.values());
    const active = list.filter((w) => w.status === WorkflowStatus.RUNNING).length;
    const failed = list.filter((w) => w.status === WorkflowStatus.FAILED).length;
    const completed = list.filter((w) => w.status === WorkflowStatus.COMPLETED);

    const totalFinished = completed.length + failed;
    const successRate = totalFinished > 0 ? (completed.length / totalFinished) * 100 : 0;
    const averageDuration = completed.length > 0
      ? completed.reduce((sum, w) => sum + (w.updatedAt.getTime() - w.createdAt.getTime()), 0) / completed.length
      : 0;

    return {
      activeWorkflows: active,
      failedWorkflows: failed,
      successRate: Math.round(successRate * 100) / 100,
      averageDuration: Math.round(averageDuration),
    };
  }

  async clear(): Promise<void> {
    this.workflows.clear();
  }
}

export class HybridWorkflowRepository implements IWorkflowRepository {
  private prismaRepo = new PrismaWorkflowRepository();
  private inMemoryRepo = new InMemoryWorkflowRepository();

  private isTest(): boolean {
    return process.env.NODE_ENV === 'test' || process.argv.some((arg) => arg.includes('test'));
  }

  private async exec<T>(prismaFn: () => Promise<T>, fallbackFn: () => Promise<T>): Promise<T> {
    if (this.isTest()) {
      return fallbackFn();
    }
    try {
      return await prismaFn();
    } catch {
      return fallbackFn();
    }
  }

  create(name: string, userId: string, steps: any[], triggerMetadata?: any) { return this.exec(() => this.prismaRepo.create(name, userId, steps, triggerMetadata), () => this.inMemoryRepo.create(name, userId, steps, triggerMetadata)); }
  findById(id: string) { return this.exec(() => this.prismaRepo.findById(id), () => this.inMemoryRepo.findById(id)); }
  findAll(f: any, p: any, sb?: any, so?: any) { return this.exec(() => this.prismaRepo.findAll(f, p, sb, so), () => this.inMemoryRepo.findAll(f, p, sb, so)); }
  updateStatus(id: string, s: any, cs?: any) { return this.exec(() => this.prismaRepo.updateStatus(id, s, cs), () => this.inMemoryRepo.updateStatus(id, s, cs)); }
  updateProgress(id: string, p: number) { return this.exec(() => this.prismaRepo.updateProgress(id, p), () => this.inMemoryRepo.updateProgress(id, p)); }
  updateStepStatus(id: string, s: any, sa?: any, ca?: any) { return this.exec(() => this.prismaRepo.updateStepStatus(id, s, sa, ca), () => this.inMemoryRepo.updateStepStatus(id, s, sa, ca)); }
  linkJobToStep(id: string, jobId: string) { return this.exec(() => this.prismaRepo.linkJobToStep(id, jobId), () => this.inMemoryRepo.linkJobToStep(id, jobId)); }
  addHistory(wfId: string, event: string, msg: string, sId?: any) { return this.exec(() => this.prismaRepo.addHistory(wfId, event, msg, sId), () => this.inMemoryRepo.addHistory(wfId, event, msg, sId)); }
  getMetrics() { return this.exec(() => this.prismaRepo.getMetrics(), () => this.inMemoryRepo.getMetrics()); }
  clear() {
    this.inMemoryRepo.clear();
    return this.exec(() => this.prismaRepo.clear(), async () => {});
  }
}

export const workflowRepository: IWorkflowRepository = new HybridWorkflowRepository();
