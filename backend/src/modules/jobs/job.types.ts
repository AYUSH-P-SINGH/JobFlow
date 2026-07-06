import { JobStatus, JobPriority, Job as PrismaJob } from '@prisma/client';

export { JobStatus, JobPriority };
export type Job = PrismaJob;

export interface CreateJobInput {
  title: string;
  description?: string | null;
  type: string;
  priority?: JobPriority;
  payload: Record<string, any>;
  userId: string;
}

export interface UpdateJobInput {
  title?: string;
  description?: string | null;
  priority?: JobPriority;
}

export interface JobFilter {
  userId?: string;
  status?: JobStatus;
  priority?: JobPriority;
  type?: string;
  startDate?: Date;
  endDate?: Date;
}

export interface JobPagination {
  page: number;
  limit: number;
}
