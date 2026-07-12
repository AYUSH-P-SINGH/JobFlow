import { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';
import { logger } from '../common/logger/logger.js';
import { redisConnection } from '../config/redis.js';

export class GatewayMiddleware {
  /**
   * Centralized gateway middleware managing Correlation ID trace propagation,
   * gateway-level rate limiting, and request auditing.
   */
  public static async execute(req: Request, res: Response, next: NextFunction): Promise<void> {
    // 1. Trace Propagation (Correlation ID)
    const correlationId = (req.headers['x-correlation-id'] as string) || randomUUID();
    res.setHeader('x-correlation-id', correlationId);
    req.headers['x-correlation-id'] = correlationId;

    // Attach correlation ID to request context
    (req as any).correlationId = correlationId;

    // 2. Gateway Request Auditing
    const tenantLogStr = req.tenantId ? `Tenant: ${req.tenantId}` : 'Public / Unauth';
    logger.debug(`[APIGateway] Routing request: ${req.method} ${req.path} (${tenantLogStr}) [CID: ${correlationId}]`);

    // 3. Centralized Rate Limiting (Redis-backed window)
    // Bypass rate limiting in testing mode
    if (
      process.env.NODE_ENV === 'test' ||
      process.env.NODE_ENV === 'testing' ||
      process.argv.some((arg) => arg.includes('test'))
    ) {
      return next();
    }

    // Limits callers to 100 requests per 10 seconds to prevent denial of service at gateway
    const ip = req.ip || 'unknown-ip';
    const rateLimitKey = `gateway:ratelimit:${req.tenantId || ip}`;
    const windowSeconds = 10;
    const maxRequests = 100;

    try {
      const currentCountStr = await redisConnection.get(rateLimitKey);
      const currentCount = currentCountStr ? parseInt(currentCountStr, 10) : 0;

      if (currentCount >= maxRequests) {
        logger.warn(`[APIGateway] Rate limit exceeded for identifier: ${req.tenantId || ip} [CID: ${correlationId}]`);
        res.status(429).json({
          success: false,
          error: 'Gateway Rate Limit Exceeded. Max 100 requests per 10s.',
          correlationId,
        });
        return;
      }

      // Increment count
      const updatedCount = await redisConnection.incr(rateLimitKey);
      if (updatedCount === 1) {
        await redisConnection.expire(rateLimitKey, windowSeconds);
      }
    } catch (err) {
      // Degrade gracefully if Redis fails
      logger.warn(`[APIGateway] Redis rate limiter failed: ${(err as Error).message}. Bypassing check.`);
    }

    next();
  }
}
