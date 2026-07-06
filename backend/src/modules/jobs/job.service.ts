import { jobRepository } from './job.repository.js';
import { CreateJobInput, UpdateJobInput, JobFilter, JobPagination, Job, JobStatus } from './job.types.js';
import { ForbiddenError, NotFoundError, BadRequestError } from '../../common/errors/errors.js';

export class JobService {
  static async createJob(data: CreateJobInput): Promise<Job> {
    return jobRepository.create(data);
  }

  static async getJobById(id: string, currentUser: { id: string; role: string }): Promise<Job> {
    const job = await jobRepository.findById(id);
    if (!job) {
      throw new NotFoundError('Job not found');
    }

    // Authorization: User must be owner or admin
    if (currentUser.role !== 'ADMIN' && job.userId !== currentUser.id) {
      throw new ForbiddenError('You are not authorized to access this job');
    }

    return job;
  }

  static async getAllJobs(
    filters: JobFilter,
    pagination: JobPagination,
    currentUser: { id: string; role: string },
    sortBy?: string,
    sortOrder?: 'asc' | 'desc'
  ): Promise<{ jobs: Job[]; total: number; page: number; limit: number }> {
    const activeFilters = { ...filters };

    // Authorization: Enforce ownership for non-admin users
    if (currentUser.role !== 'ADMIN') {
      activeFilters.userId = currentUser.id;
    }

    const result = await jobRepository.findAll(activeFilters, pagination, sortBy, sortOrder);

    return {
      jobs: result.jobs,
      total: result.total,
      page: pagination.page,
      limit: pagination.limit,
    };
  }

  static async updateJob(
    id: string,
    data: UpdateJobInput,
    currentUser: { id: string; role: string }
  ): Promise<Job> {
    const job = await jobRepository.findById(id);
    if (!job) {
      throw new NotFoundError('Job not found');
    }

    // Authorization: User must be owner or admin
    if (currentUser.role !== 'ADMIN' && job.userId !== currentUser.id) {
      throw new ForbiddenError('You are not authorized to update this job');
    }

    return jobRepository.update(id, data);
  }

  static async deleteJob(id: string, currentUser: { id: string; role: string }): Promise<Job> {
    const job = await jobRepository.findById(id);
    if (!job) {
      throw new NotFoundError('Job not found');
    }

    // Authorization: User must be owner or admin
    if (currentUser.role !== 'ADMIN' && job.userId !== currentUser.id) {
      throw new ForbiddenError('You are not authorized to delete this job');
    }

    return jobRepository.delete(id);
  }

  static async cancelJob(id: string, currentUser: { id: string; role: string }): Promise<Job> {
    const job = await jobRepository.findById(id);
    if (!job) {
      throw new NotFoundError('Job not found');
    }

    // Authorization: User must be owner or admin
    if (currentUser.role !== 'ADMIN' && job.userId !== currentUser.id) {
      throw new ForbiddenError('You are not authorized to cancel this job');
    }

    // Only allow cancellation if status is PENDING
    if (job.status !== JobStatus.PENDING) {
      throw new BadRequestError('Only PENDING jobs can be cancelled');
    }

    return jobRepository.updateStatus(id, JobStatus.CANCELLED);
  }
}
export default JobService;
