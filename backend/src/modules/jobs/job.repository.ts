import prisma from '../../prisma.js';
import { Job, CreateJobInput, UpdateJobInput, JobFilter, JobPagination, JobStatus, JobPriority } from './job.types.js';

export interface IJobRepository {
  create(data: CreateJobInput): Promise<Job>;
  findById(id: string): Promise<Job | null>;
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

export const jobRepository = new PrismaJobRepository();
