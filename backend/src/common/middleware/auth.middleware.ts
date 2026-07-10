import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { verifyAccessToken } from '../utils/jwt.js';
import { userRepository } from '../../modules/auth/auth.repository.js';
import { UnauthorizedError } from '../errors/errors.js';
import { logger } from '../logger/logger.js';
import prisma from '../../prisma.js';
import { QuotaService } from '../../modules/governance/quota.service.js';
import { ComplianceService } from '../../modules/governance/compliance.service.js';

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
        role: string;
        tenantId?: string;
      };
      tenantId?: string;
    }
  }
}

export const authMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // 1. Try API Key Authentication first
    const apiKey = req.headers['x-api-key'];
    if (apiKey && typeof apiKey === 'string') {
      const hashedKey = crypto.createHash('sha256').update(apiKey).digest('hex');
      const apiKeyRecord = await prisma.apiKey.findUnique({
        where: { hashedKey },
        include: { tenant: true },
      });

      if (!apiKeyRecord) {
        logger.warn(`Unauthorized Access: Invalid API Key on ${req.method} ${req.path}`);
        throw new UnauthorizedError('Invalid API Key');
      }

      if (apiKeyRecord.expiresAt && apiKeyRecord.expiresAt < new Date()) {
        logger.warn(`Unauthorized Access: Expired API Key on ${req.method} ${req.path}`);
        throw new UnauthorizedError('API Key has expired');
      }

      req.tenantId = apiKeyRecord.tenantId;
      req.user = {
        id: 'api-key-actor',
        email: `api-key@${apiKeyRecord.tenantId}.local`,
        role: 'ADMIN', // API key acts as tenant admin
        tenantId: apiKeyRecord.tenantId,
      };

      // Enforce API Quotas for API Key usage
      await QuotaService.checkApiQuota(apiKeyRecord.tenantId);

      // Log API key usage for compliance audit
      await ComplianceService.logApiKeyUsage(apiKeyRecord.id, apiKeyRecord.tenantId, req.path, req.method).catch((err) => {
        logger.error(`Failed to log compliance API Key usage: ${err.message}`);
      });

      return next();
    }

    // 2. Try JWT Bearer Authentication
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      logger.warn(`Unauthorized Access: Missing or malformed Authorization header on ${req.method} ${req.path}`);
      throw new UnauthorizedError('Access token or API key is missing or invalid');
    }

    const token = authHeader.split(' ')[1];
    let decoded: any;
    try {
      decoded = verifyAccessToken(token);
    } catch (err) {
      logger.warn(`Unauthorized Access: Invalid token signature/expiry on ${req.method} ${req.path}`);
      throw new UnauthorizedError('Access token is invalid or expired');
    }

    const user = await userRepository.findById(decoded.userId);
    if (!user) {
      logger.warn(`Unauthorized Access: User ID ${decoded.userId} not found on ${req.method} ${req.path}`);
      throw new UnauthorizedError('User not found');
    }

    const tenantId = user.tenantId || 'default-tenant-id';
    req.user = {
      id: user.id,
      email: user.email,
      role: user.role,
      tenantId,
    };
    req.tenantId = tenantId;

    // Enforce API Quotas for JWT User session
    await QuotaService.checkApiQuota(tenantId);

    next();
  } catch (error) {
    next(error);
  }
};
