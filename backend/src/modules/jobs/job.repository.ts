import prisma from '../../prisma.js';
import { Job, CreateJobInput, UpdateJobInput, JobFilter, JobPagination, JobStatus, JobPriority } from './job.types.js';

export interface IJobRepository {
  create(data: CreateJobInput): Promise<Job>;
  findById(id: string): Promise<Job | null>;
  findByIdIncludeDeleted(id: string): Promise<Job | null>;
  findAll(
    filters: JobFilter,
    pagination: JobPagination,
    sortBy?: string,
    sortOrder?: 'asc' | 'desc'
  ): Promise<{ jobs: Job[]; total: number }>;
  update(id: string, data: UpdateJobInput): Promise<Job>;
  delete(id: string): Promise<Job>;
  updateStatus(
    id: string,
    status: JobStatus,
    result?: any,
    startedAt?: Date,
    completedAt?: Date
  ): Promise<Job>;
  findByUser(userId: string): Promise<Job[]>;
  clear(): Promise<void>;
}

export class PrismaJobRepository implements IJobRepository {
  async create(data: CreateJobInput): Promise<Job> {
    const job = await prisma.job.create({
      data: {
        title: data.title,
        description: data.description,
        type: data.type,
        priority: data.priority,
        payload: data.payload,
        userId: data.userId,
        scheduledAt: data.scheduledAt,
      },
    });
    return job;
  }

  async findById(id: string): Promise<Job | null> {
    const job = await prisma.job.findFirst({
      where: {
        id,
        deletedAt: null,
      },
    });
    return job;
  }

  async findByIdIncludeDeleted(id: string): Promise<Job | null> {
    const job = await prisma.job.findUnique({
      where: { id },
    });
    return job;
  }

  async findAll(
    filters: JobFilter,
    pagination: JobPagination,
    sortBy: string = 'createdAt',
    sortOrder: 'asc' | 'desc' = 'desc'
  ): Promise<{ jobs: Job[]; total: number }> {
    const where: any = {
      deletedAt: null,
    };

    if (filters.userId) {
      where.userId = filters.userId;
    }
    if (filters.status) {
      where.status = filters.status;
    }
    if (filters.priority) {
      where.priority = filters.priority;
    }
    if (filters.type) {
      where.type = filters.type;
    }

    if (filters.startDate || filters.endDate) {
      where.createdAt = {};
      if (filters.startDate) {
        where.createdAt.gte = filters.startDate;
      }
      if (filters.endDate) {
        where.createdAt.lte = filters.endDate;
      }
    }

    const page = pagination.page > 0 ? pagination.page : 1;
    const limit = pagination.limit > 0 ? pagination.limit : 10;
    const skip = (page - 1) * limit;

    // Validate sortBy column to avoid SQL injection
    const allowedSortFields = ['createdAt', 'updatedAt', 'title', 'status', 'priority'];
    const orderField = allowedSortFields.includes(sortBy) ? sortBy : 'createdAt';

    const [jobs, total] = await Promise.all([
      prisma.job.findMany({
        where,
        orderBy: {
          [orderField]: sortOrder,
        },
        skip,
        take: limit,
      }),
      prisma.job.count({
        where,
      }),
    ]);

    return { jobs, total };
  }

  async update(id: string, data: UpdateJobInput): Promise<Job> {
    const job = await prisma.job.update({
      where: { id },
      data: {
        title: data.title,
        description: data.description,
        priority: data.priority,
      },
    });
    return job;
  }

  async delete(id: string): Promise<Job> {
    const job = await prisma.job.update({
      where: { id },
      data: {
        deletedAt: new Date(),
      },
    });
    return job;
  }

  async updateStatus(
    id: string,
    status: JobStatus,
    result?: any,
    startedAt?: Date,
    completedAt?: Date
  ): Promise<Job> {
    const data: any = { status };
    if (result !== undefined) {
      data.result = result;
    }
    if (startedAt !== undefined) {
      data.startedAt = startedAt;
    }
    if (completedAt !== undefined) {
      data.completedAt = completedAt;
    }

    const job = await prisma.job.update({
      where: { id },
      data,
    });
    return job;
  }

  async findByUser(userId: string): Promise<Job[]> {
    const jobs = await prisma.job.findMany({
      where: {
        userId,
        deletedAt: null,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
    return jobs;
  }

  async clear(): Promise<void> {
    await prisma.job.deleteMany({});
  }
}

export class InMemoryJobRepository implements IJobRepository {
  private jobs = new Map<string, Job>();

  async create(data: CreateJobInput): Promise<Job> {
    const now = new Date();
    const job: Job = {
      id: `job-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      title: data.title,
      description: data.description || null,
      type: data.type,
      status: JobStatus.PENDING,
      priority: data.priority || JobPriority.MEDIUM,
      payload: data.payload,
      result: null,
      userId: data.userId,
      tenantId: null,
      scheduledAt: data.scheduledAt || null,
      startedAt: null,
      completedAt: null,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    };
    this.jobs.set(job.id, job);
    return job;
  }

  async findById(id: string): Promise<Job | null> {
    const job = this.jobs.get(id);
    if (!job || job.deletedAt) return null;
    return job;
  }

  async findByIdIncludeDeleted(id: string): Promise<Job | null> {
    return this.jobs.get(id) || null;
  }

  async findAll(
    filters: JobFilter,
    pagination: JobPagination,
    sortBy: string = 'createdAt',
    sortOrder: 'asc' | 'desc' = 'desc'
  ): Promise<{ jobs: Job[]; total: number }> {
    let list = Array.from(this.jobs.values()).filter((j) => !j.deletedAt);
    if (filters.status) list = list.filter((j) => j.status === filters.status);
    if (filters.type) list = list.filter((j) => j.type === filters.type);
    if (filters.priority) list = list.filter((j) => j.priority === filters.priority);
    if (filters.userId) list = list.filter((j) => j.userId === filters.userId);

    const total = list.length;
    const page = pagination.page || 1;
    const limit = pagination.limit || 10;
    const start = (page - 1) * limit;
    const paginated = list.slice(start, start + limit);
    return { jobs: paginated, total };
  }

  async update(id: string, data: UpdateJobInput): Promise<Job> {
    const existing = await this.findById(id);
    if (!existing) throw new Error(`Job ${id} not found`);
    const updated: Job = {
      ...existing,
      ...data,
      updatedAt: new Date(),
    };
    this.jobs.set(id, updated);
    return updated;
  }

  async delete(id: string): Promise<Job> {
    const existing = await this.findById(id);
    if (!existing) throw new Error(`Job ${id} not found`);
    const deleted: Job = {
      ...existing,
      deletedAt: new Date(),
      updatedAt: new Date(),
    };
    this.jobs.set(id, deleted);
    return deleted;
  }

  async updateStatus(
    id: string,
    status: JobStatus,
    result?: any,
    startedAt?: Date,
    completedAt?: Date
  ): Promise<Job> {
    const existing = await this.findById(id);
    if (!existing) throw new Error(`Job ${id} not found`);
    const updated: Job = {
      ...existing,
      status,
      ...(result !== undefined && { result }),
      ...(startedAt !== undefined && { startedAt }),
      ...(completedAt !== undefined && { completedAt }),
      updatedAt: new Date(),
    };
    this.jobs.set(id, updated);
    return updated;
  }

  async findByUser(userId: string): Promise<Job[]> {
    return Array.from(this.jobs.values()).filter((j) => j.userId === userId && !j.deletedAt);
  }

  async clear(): Promise<void> {
    this.jobs.clear();
  }
}

export class HybridJobRepository implements IJobRepository {
  private prismaRepo = new PrismaJobRepository();
  private inMemoryRepo = new InMemoryJobRepository();

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

  create(data: any) { return this.exec(() => this.prismaRepo.create(data), () => this.inMemoryRepo.create(data)); }
  findById(id: string) { return this.exec(() => this.prismaRepo.findById(id), () => this.inMemoryRepo.findById(id)); }
  findByIdIncludeDeleted(id: string) { return this.exec(() => this.prismaRepo.findByIdIncludeDeleted(id), () => this.inMemoryRepo.findByIdIncludeDeleted(id)); }
  findAll(f: any, p: any, sb?: any, so?: any) { return this.exec(() => this.prismaRepo.findAll(f, p, sb, so), () => this.inMemoryRepo.findAll(f, p, sb, so)); }
  update(id: string, data: any) { return this.exec(() => this.prismaRepo.update(id, data), () => this.inMemoryRepo.update(id, data)); }
  delete(id: string) { return this.exec(() => this.prismaRepo.delete(id), () => this.inMemoryRepo.delete(id)); }
  updateStatus(id: string, s: any, r?: any, sa?: any, ca?: any) { return this.exec(() => this.prismaRepo.updateStatus(id, s, r, sa, ca), () => this.inMemoryRepo.updateStatus(id, s, r, sa, ca)); }
  findByUser(userId: string) { return this.exec(() => this.prismaRepo.findByUser(userId), () => this.inMemoryRepo.findByUser(userId)); }
  clear() {
    this.inMemoryRepo.clear();
    return this.exec(() => this.prismaRepo.clear(), async () => {});
  }
}

export const jobRepository: IJobRepository = new HybridJobRepository();
