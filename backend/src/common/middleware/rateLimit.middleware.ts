import { Request, Response, NextFunction } from 'express';
import { redisConnection } from '../../config/redis.js';
import { logger } from '../logger/logger.js';

export const rateLimitMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const apiKey = req.headers['x-api-key'];
    const keyIdentifier = apiKey || req.ip || 'global';
    const redisKey = `ratelimit:${keyIdentifier}`;

    // Skip rate limiting if in test environment or if redis is mock-configured
    if (
      process.env.NODE_ENV === 'test' ||
      !redisConnection ||
      typeof redisConnection.multi !== 'function'
    ) {
      return next();
    }

    let currentRequests = 0;
    try {
      const result = await redisConnection
        .multi()
        .incr(redisKey)
        .expire(redisKey, 60, 'NX') // Set expire only if key does not have an expiry
        .exec();

      if (result && result[0]) {
        currentRequests = (result[0][1] as number) || 1;
      }
    } catch (err) {
      logger.warn(`Redis rate limiter failed: ${(err as Error).message}. Bypassing check.`);
      return next();
    }

    // Set rate limit headers in response
    res.setHeader('X-RateLimit-Limit', 100);
    res.setHeader('X-RateLimit-Remaining', Math.max(0, 100 - currentRequests));

    if (currentRequests > 100) {
      res.status(429).json({
        error: 'Too Many Requests',
        message: 'Rate limit exceeded. Maximum 100 requests per minute per API key/IP.',
      });
      return;
    }

    next();
  } catch (error) {
    next(error);
  }
};
