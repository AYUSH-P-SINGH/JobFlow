import { Request, Response, NextFunction } from 'express';
import { JobService } from './job.service.js';
import { logger } from '../../common/logger/logger.js';
import { createJobSchema, updateJobSchema, queryJobsSchema } from './job.validation.js';
import { UnauthorizedError } from '../../common/errors/errors.js';

export class JobController {
  static async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const currentUser = req.user;
      if (!currentUser) {
        throw new UnauthorizedError('Unauthorized');
      }

      // Parse schema to get properly typed inputs
      const parsed = await createJobSchema.parseAsync({ body: req.body });
      const { title, description, type, priority, payload, scheduledAt } = parsed.body;

      const job = await JobService.createJob({
        title,
        description,
        type,
        priority,
        payload,
        userId: currentUser.id,
        scheduledAt,
      });

      logger.info(`Job Created: ID ${job.id}, Type ${job.type}, User ID ${currentUser.id}`);

      res.status(201).json({
        success: true,
        data: job,
      });
    } catch (error) {
      next(error);
    }
  }

  static async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const currentUser = req.user;
      if (!currentUser) {
        throw new UnauthorizedError('Unauthorized');
      }

      const { id } = req.params;
      const job = await JobService.getJobById(id, currentUser);

      res.status(200).json({
        success: true,
        data: job,
      });
    } catch (error) {
      next(error);
    }
  }

  static async getAll(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const currentUser = req.user;
      if (!currentUser) {
        throw new UnauthorizedError('Unauthorized');
      }

      // Parse and coerce query parameters
      const parsed = await queryJobsSchema.parseAsync({ query: req.query });
      const { page, limit, status, priority, type, startDate, endDate, sortBy, sortOrder } = parsed.query;

      const result = await JobService.getAllJobs(
        { status, priority, type, startDate, endDate },
        { page, limit },
        currentUser,
        sortBy,
        sortOrder
      );

      res.status(200).json({
        jobs: result.jobs,
        page: result.page,
        limit: result.limit,
        total: result.total,
      });
    } catch (error) {
      next(error);
    }
  }

  static async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const currentUser = req.user;
      if (!currentUser) {
        throw new UnauthorizedError('Unauthorized');
      }

      const { id } = req.params;
      const parsed = await updateJobSchema.parseAsync({ body: req.body });
      const { title, description, priority } = parsed.body;

      const job = await JobService.updateJob(id, { title, description, priority }, currentUser);

      logger.info(`Job Updated: ID ${job.id}, User ID ${currentUser.id}`);

      res.status(200).json({
        success: true,
        data: job,
      });
    } catch (error) {
      next(error);
    }
  }

  static async delete(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const currentUser = req.user;
      if (!currentUser) {
        throw new UnauthorizedError('Unauthorized');
      }

      const { id } = req.params;
      await JobService.deleteJob(id, currentUser);

      logger.info(`Job Deleted: ID ${id}, User ID ${currentUser.id}`);

      res.status(200).json({
        success: true,
        message: 'Job deleted successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  static async cancel(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const currentUser = req.user;
      if (!currentUser) {
        throw new UnauthorizedError('Unauthorized');
      }

      const { id } = req.params;
      const job = await JobService.cancelJob(id, currentUser);

      logger.info(`Job Cancelled: ID ${job.id}, User ID ${currentUser.id}`);

      res.status(200).json({
        success: true,
        data: job,
      });
    } catch (error) {
      next(error);
    }
  }
}
export default JobController;
