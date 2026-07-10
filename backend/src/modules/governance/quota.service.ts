import prisma from '../../prisma.js';
import { redisConnection } from '../../config/redis.js';
import { BadRequestError, ForbiddenError } from '../../common/errors/errors.js';
import { logger } from '../../common/logger/logger.js';

export class QuotaService {
  /**
   * Validates if a tenant can start a new workflow based on daily and concurrency limits.
   * Throws a BadRequestError if a limit is exceeded.
   */
  public static async checkWorkflowLimits(tenantId: string | null): Promise<void> {
    if (!tenantId) return;

    // 1. Fetch tenant quota configuration (default if none exists)
    let quota = await prisma.tenantQuota.findUnique({
      where: { tenantId },
    });

    const maxDaily = quota?.maxWorkflowsPerDay ?? 100;
    const maxConcurrent = quota?.maxConcurrent ?? 20;

    // 2. Check Daily Limit
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const dailyCount = await prisma.workflow.count({
      where: {
        tenantId,
        createdAt: { gte: startOfToday },
      },
    });

    if (dailyCount >= maxDaily) {
      const msg = `Quota Exceeded: Tenant daily workflow limit (${maxDaily}) reached. Current usage: ${dailyCount}.`;
      logger.warn(msg);
      throw new BadRequestError(msg);
    }

    // 3. Check Concurrent Limit
    const concurrentCount = await prisma.workflow.count({
      where: {
        tenantId,
        status: 'RUNNING',
      },
    });

    if (concurrentCount >= maxConcurrent) {
      const msg = `Quota Exceeded: Tenant maximum concurrent workflows limit (${maxConcurrent}) reached. Current running: ${concurrentCount}.`;
      logger.warn(msg);
      throw new BadRequestError(msg);
    }

    logger.debug(`Tenant ${tenantId} workflow quotas checked successfully. Daily: ${dailyCount}/${maxDaily}, Concurrent: ${concurrentCount}/${maxConcurrent}`);
  }

  /**
   * Tracks and enforces monthly API call quotas using Redis.
   * Throws a ForbiddenError (or rate limit check failure) if the quota is exceeded.
   */
  public static async checkApiQuota(tenantId: string | null): Promise<void> {
    if (!tenantId) return;

    try {
      // 1. Fetch tenant quota configuration
      const quota = await prisma.tenantQuota.findUnique({
        where: { tenantId },
      });
      const maxApiCalls = quota?.maxApiCallsPerMonth ?? 10000;

      // 2. Increment API usage counter in Redis
      const now = new Date();
      const currentYearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      const redisKey = `quota:tenant:${tenantId}:api-calls:${currentYearMonth}`;

      // Multi-step transaction or script to increment and set TTL
      const countStr = await redisConnection.get(redisKey);
      let count = countStr ? parseInt(countStr, 10) : 0;

      if (count >= maxApiCalls) {
        const msg = `Quota Exceeded: Monthly API call limit (${maxApiCalls}) reached for tenant ${tenantId}.`;
        logger.warn(msg);
        throw new ForbiddenError(msg);
      }

      // Increment count
      const updatedCount = await redisConnection.incr(redisKey);
      if (updatedCount === 1) {
        // Set expiry for 32 days to clean up old keys automatically
        await redisConnection.expire(redisKey, 32 * 24 * 60 * 60);
      }
    } catch (err) {
      if (err instanceof ForbiddenError) {
        throw err;
      }
      logger.error(`Failed to verify tenant API quota: ${(err as Error).message}`);
    }
  }
}
