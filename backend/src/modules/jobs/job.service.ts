import { jobRepository } from './job.repository.js';
import { EnqueueService } from './enqueue.service.js';
import { CreateJobInput, UpdateJobInput, JobFilter, JobPagination, Job, JobStatus } from './job.types.js';
import { ForbiddenError, NotFoundError, BadRequestError } from '../../common/errors/errors.js';
import { logger } from '../../common/logger/logger.js';

export class JobService {
  /**
   * Creates a job, persists it to PostgreSQL, enqueues it in BullMQ,
   * and updates the status from PENDING → QUEUED.
   */
  static async createJob(data: CreateJobInput): Promise<Job> {
    // Step 1: Save to PostgreSQL (status defaults to PENDING)
    const job = await jobRepository.create(data);

    try {
      // Step 2: Enqueue in BullMQ
      await EnqueueService.enqueueJob(job);

      // Step 3: Update status to QUEUED
      const queuedJob = await jobRepository.updateStatus(job.id, JobStatus.QUEUED);

      return queuedJob;
    } catch (error) {
      // If enqueueing fails, the job remains PENDING in the database.
      // This is intentional — a retry mechanism or manual re-enqueue can handle it.
      logger.error(`Failed to enqueue job ${job.id}: ${(error as Error).message}`);
      return job;
    }
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

    // Allow cancellation if status is PENDING or QUEUED
    if (job.status !== JobStatus.PENDING && job.status !== JobStatus.QUEUED) {
      throw new BadRequestError('Only PENDING or QUEUED jobs can be cancelled');
    }

    return jobRepository.updateStatus(id, JobStatus.CANCELLED);
  }
}
export default JobService;
