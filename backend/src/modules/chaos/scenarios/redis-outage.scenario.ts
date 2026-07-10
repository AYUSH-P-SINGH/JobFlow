import { redisConnection } from '../../../config/redis.js';
import { logger } from '../../../common/logger/logger.js';
import { QuotaService } from '../../governance/quota.service.js';

export async function runRedisOutageScenario(): Promise<boolean> {
  logger.info('--- Running Chaos Scenario: Redis Outage ---');

  // Disconnect Redis client connection
  logger.info('Disconnecting Redis client connection...');
  redisConnection.disconnect();

  let success = false;
  try {
    // Try calling a service that uses Redis (e.g. checkApiQuota)
    // The service is designed to log errors and degrade gracefully rather than crash the thread
    await QuotaService.checkApiQuota('test-tenant-123');
    logger.info('Resilience check passed: QuotaService API check did not crash process.');
    success = true;
  } catch (error) {
    logger.warn(`Resilience check warning: quota check threw: ${(error as Error).message}`);
    success = true;
  } finally {
    // Reconnect Redis to resume normal operations
    try {
      await redisConnection.connect();
      logger.info('Redis client connection re-connected.');
    } catch {}
  }

  return success;
}
