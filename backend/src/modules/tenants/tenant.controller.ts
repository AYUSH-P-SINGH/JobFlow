import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import prisma from '../../prisma.js';
import { logger } from '../../common/logger/logger.js';
import { ForbiddenError, NotFoundError } from '../../common/errors/errors.js';

export class TenantController {
  /**
   * Create a new tenant (organization)
   */
  public static async createTenant(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { name } = req.body;
      if (!name) {
        res.status(400).json({ error: 'Tenant name is required' });
        return;
      }

      const tenant = await prisma.tenant.create({
        data: { name },
      });

      // Create a default project for this tenant
      const defaultProject = await prisma.project.create({
        data: {
          name: 'Default Project',
          tenantId: tenant.id,
        },
      });

      logger.info(`Tenant created: ${tenant.name} (${tenant.id})`);
      res.status(201).json({
        message: 'Tenant and default project created successfully',
        data: {
          tenant,
          project: defaultProject,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Generate an API Key for the authenticated user's tenant or specified tenant
   */
  public static async generateApiKey(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { tenantId } = req.params;
      const { name, expiresDays } = req.body;

      if (!name) {
        res.status(400).json({ error: 'Key name is required' });
        return;
      }

      // Ensure the user has access to this tenant (RBAC / Tenancy check)
      if (req.user?.role !== 'ADMIN' && req.tenantId !== tenantId) {
        throw new ForbiddenError('You do not have access to this tenant');
      }

      const rawKey = 'jf_' + crypto.randomBytes(32).toString('hex');
      const hashedKey = crypto.createHash('sha256').update(rawKey).digest('hex');

      let expiresAt: Date | null = null;
      if (expiresDays) {
        expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + parseInt(expiresDays, 10));
      }

      const apiKey = await prisma.apiKey.create({
        data: {
          name,
          hashedKey,
          tenantId,
          expiresAt,
        },
      });

      logger.info(`API Key generated: "${name}" for Tenant ${tenantId}`);
      res.status(201).json({
        message: 'API Key generated successfully. Save this key as it will not be shown again.',
        data: {
          id: apiKey.id,
          name: apiKey.name,
          apiKey: rawKey,
          expiresAt: apiKey.expiresAt,
          createdAt: apiKey.createdAt,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * List API Keys for a tenant
   */
  public static async listApiKeys(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { tenantId } = req.params;

      if (req.user?.role !== 'ADMIN' && req.tenantId !== tenantId) {
        throw new ForbiddenError('You do not have access to this tenant');
      }

      const keys = await prisma.apiKey.findMany({
        where: { tenantId },
        select: {
          id: true,
          name: true,
          expiresAt: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
      });

      res.status(200).json({
        data: keys,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Revoke/delete an API Key
   */
  public static async revokeApiKey(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { tenantId, keyId } = req.params;

      if (req.user?.role !== 'ADMIN' && req.tenantId !== tenantId) {
        throw new ForbiddenError('You do not have access to this tenant');
      }

      const key = await prisma.apiKey.findFirst({
        where: { id: keyId, tenantId },
      });

      if (!key) {
        throw new NotFoundError('API Key not found');
      }

      await prisma.apiKey.delete({
        where: { id: keyId },
      });

      logger.info(`API Key revoked: ${key.name} (${keyId})`);
      res.status(200).json({
        message: 'API Key revoked successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Rotate an API Key by revoking the old one and creating a new one with same name
   */
  public static async rotateApiKey(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { tenantId, keyId } = req.params;
      const { expiresDays } = req.body;

      if (req.user?.role !== 'ADMIN' && req.tenantId !== tenantId) {
        throw new ForbiddenError('You do not have access to this tenant');
      }

      const oldKey = await prisma.apiKey.findFirst({
        where: { id: keyId, tenantId },
      });

      if (!oldKey) {
        throw new NotFoundError('API Key not found');
      }

      // Revoke the old key
      await prisma.apiKey.delete({
        where: { id: keyId },
      });

      // Generate the new key
      const rawKey = 'jf_' + crypto.randomBytes(32).toString('hex');
      const hashedKey = crypto.createHash('sha256').update(rawKey).digest('hex');

      let expiresAt: Date | null = null;
      if (expiresDays) {
        expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + parseInt(expiresDays, 10));
      } else if (oldKey.expiresAt) {
        // Carry over old expiration if not customized in rotation request
        expiresAt = oldKey.expiresAt;
      }

      const newKey = await prisma.apiKey.create({
        data: {
          name: oldKey.name + ' (Rotated)',
          hashedKey,
          tenantId,
          expiresAt,
        },
      });

      logger.info(`API Key rotated successfully for Tenant ${tenantId}. Old: ${oldKey.name}, New: ${newKey.name}`);
      res.status(200).json({
        message: 'API Key rotated successfully. Save this new key as it will not be shown again.',
        data: {
          id: newKey.id,
          name: newKey.name,
          apiKey: rawKey,
          expiresAt: newKey.expiresAt,
          createdAt: newKey.createdAt,
        },
      });
    } catch (error) {
      next(error);
    }
  }
}
