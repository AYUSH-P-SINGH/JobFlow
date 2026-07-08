import { Request, Response, NextFunction } from 'express';
import prisma from '../../prisma.js';
import { TemplateService } from './template.service.js';
import { ForbiddenError, NotFoundError, BadRequestError } from '../../common/errors/errors.js';
import { logger } from '../../common/logger/logger.js';

export class TemplateController {
  /**
   * Create a new Workflow Template
   */
  public static async createTemplate(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { name, description, projectId } = req.body;
      const tenantId = req.tenantId || 'default-tenant-id';

      if (!name) {
        res.status(400).json({ error: 'Template name is required' });
        return;
      }

      const template = await TemplateService.createTemplate(name, description, tenantId, projectId);
      res.status(201).json({
        message: 'Workflow template created successfully',
        data: template,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Create a new version under a template
   */
  public static async createVersion(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const { dsl } = req.body;
      const tenantId = req.tenantId || 'default-tenant-id';

      if (!dsl) {
        res.status(400).json({ error: 'DSL content is required' });
        return;
      }

      const version = await TemplateService.createVersion(id, dsl, tenantId);
      res.status(201).json({
        message: 'Workflow version created successfully',
        data: version,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Execute/Start a workflow run from template
   */
  public static async runTemplate(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const { version, triggerType, triggerMetadata } = req.body;
      const userId = req.user?.id || 'default-user-id';
      const tenantId = req.tenantId || 'default-tenant-id';

      const execution = await TemplateService.startExecution(
        id,
        userId,
        tenantId,
        version ? parseInt(version, 10) : undefined,
        triggerType || 'MANUAL',
        triggerMetadata
      );

      res.status(201).json({
        message: 'Workflow execution started successfully',
        data: execution,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * List templates for the active tenant
   */
  public static async listTemplates(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const tenantId = req.tenantId || 'default-tenant-id';
      const templates = await prisma.workflowTemplate.findMany({
        where: { tenantId },
        include: {
          versions: {
            orderBy: { version: 'desc' },
            take: 1, // include latest version overview
          },
        },
        orderBy: { updatedAt: 'desc' },
      });

      res.status(200).json({
        data: templates,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Export a template and its active version configuration
   */
  public static async exportTemplate(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const tenantId = req.tenantId || 'default-tenant-id';

      const template = await prisma.workflowTemplate.findFirst({
        where: { id, tenantId },
        include: {
          versions: {
            where: { isActive: true },
          },
        },
      });

      if (!template) {
        throw new NotFoundError('Workflow Template not found');
      }

      const activeVersion = template.versions[0];
      const exportData = {
        template: {
          name: template.name,
          description: template.description,
        },
        dsl: activeVersion ? activeVersion.dsl : null,
      };

      res.status(200).json({
        data: exportData,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Import a template configuration and create new template/version
   */
  public static async importTemplate(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { template, dsl } = req.body;
      const tenantId = req.tenantId || 'default-tenant-id';

      if (!template || !template.name) {
        throw new BadRequestError('Invalid import structure: template name is required');
      }

      const newTemplate = await TemplateService.createTemplate(
        template.name,
        template.description,
        tenantId
      );

      let version = null;
      if (dsl) {
        version = await TemplateService.createVersion(newTemplate.id, dsl, tenantId);
      }

      res.status(201).json({
        message: 'Workflow template imported successfully',
        data: {
          template: newTemplate,
          version,
        },
      });
    } catch (error) {
      next(error);
    }
  }
}
