import { Request, Response, NextFunction } from 'express';
import { WorkflowService } from './workflow.service.js';
import { workflowRepository } from './workflow.repository.js';
import { createWorkflowSchema, queryWorkflowsSchema } from './workflow.validation.js';
import { WORKFLOW_TEMPLATES } from './templates/registry.js';
import { UnauthorizedError } from '../../common/errors/errors.js';
import { logger } from '../../common/logger/logger.js';

export class WorkflowController {
  static async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const currentUser = req.user;
      if (!currentUser) {
        throw new UnauthorizedError('Unauthorized');
      }

      // Convert visual representation to linear steps if nodes and edges are provided
      if (req.body.nodes && req.body.edges) {
        const { VisualWorkflowConverter } = await import('./visual-converter.js');
        req.body.steps = VisualWorkflowConverter.toDAGSteps({
          nodes: req.body.nodes,
          edges: req.body.edges,
        });
      }

      const parsed = await createWorkflowSchema.parseAsync({ body: req.body });
      const { name, steps } = parsed.body;

      const workflow = await WorkflowService.createWorkflow(name, steps, currentUser.id);

      logger.info(`Workflow Created: ID ${workflow.id}, Name ${workflow.name}, User ID ${currentUser.id}`);

      res.status(201).json({
        success: true,
        data: workflow,
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
      const workflow = await WorkflowService.getWorkflowById(id, currentUser);

      res.status(200).json({
        success: true,
        data: workflow,
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

      const parsed = await queryWorkflowsSchema.parseAsync({ query: req.query });
      const { page, limit, status } = parsed.query;
      const sortBy = req.query.sortBy as string | undefined;
      const sortOrder = req.query.sortOrder as 'asc' | 'desc' | undefined;

      const result = await WorkflowService.getAllWorkflows(
        { status },
        { page, limit },
        currentUser,
        sortBy,
        sortOrder
      );

      res.status(200).json({
        success: true,
        workflows: result.workflows,
        page: result.page,
        limit: result.limit,
        total: result.total,
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
      const workflow = await WorkflowService.cancelWorkflow(id, currentUser);

      logger.info(`Workflow Cancelled: ID ${workflow.id}, User ID ${currentUser.id}`);

      res.status(200).json({
        success: true,
        data: workflow,
      });
    } catch (error) {
      next(error);
    }
  }

  static async retry(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const currentUser = req.user;
      if (!currentUser) {
        throw new UnauthorizedError('Unauthorized');
      }

      const { id } = req.params;
      const workflow = await WorkflowService.retryWorkflow(id, currentUser);

      logger.info(`Workflow Retried: ID ${workflow.id}, User ID ${currentUser.id}`);

      res.status(200).json({
        success: true,
        data: workflow,
      });
    } catch (error) {
      next(error);
    }
  }

  static async getMetrics(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const currentUser = req.user;
      if (!currentUser) {
        throw new UnauthorizedError('Unauthorized');
      }

      const metrics = await workflowRepository.getMetrics();

      res.status(200).json({
        success: true,
        data: metrics,
      });
    } catch (error) {
      next(error);
    }
  }

  static async getTemplates(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const currentUser = req.user;
      if (!currentUser) {
        throw new UnauthorizedError('Unauthorized');
      }

      res.status(200).json({
        success: true,
        data: WORKFLOW_TEMPLATES,
      });
    } catch (error) {
      next(error);
    }
  }

  static async compare(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const currentUser = req.user;
      if (!currentUser) {
        throw new UnauthorizedError('Unauthorized');
      }

      const { workflowIdA, workflowIdB } = req.query;

      if (!workflowIdA || !workflowIdB) {
        res.status(400).json({
          success: false,
          error: 'Query parameters "workflowIdA" and "workflowIdB" are required.',
        });
        return;
      }

      const diff = await WorkflowService.compareWorkflows(workflowIdA as string, workflowIdB as string);

      res.status(200).json({
        success: true,
        data: diff,
      });
    } catch (error) {
      next(error);
    }
  }
}
