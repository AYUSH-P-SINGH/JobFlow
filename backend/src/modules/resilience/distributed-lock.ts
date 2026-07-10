import { redisConnection } from '../../config/redis.js';
import { randomUUID } from 'crypto';
import { logger } from '../../common/logger/logger.js';

export class DistributedLock {
  /**
   * Attempts to acquire a distributed lock using Redis.
   * Returns a unique token string if the lock is acquired, or null if it fails.
   */
  public static async acquire(
    lockKey: string,
    ttlMs = 10000
  ): Promise<string | null> {
    try {
      const token = randomUUID();
      // SET key value NX PX ttlMs
      const result = await (redisConnection as any).set(lockKey, token, 'NX', 'PX', ttlMs);
      
      if (result === 'OK') {
        logger.debug(`[DistributedLock] Acquired lock: ${lockKey} (token: ${token})`);
        return token;
      }
      
      logger.debug(`[DistributedLock] Failed to acquire lock: ${lockKey}`);
      return null;
    } catch (error) {
      logger.error(`Error acquiring distributed lock for key ${lockKey}: ${(error as Error).message}`);
      return null;
    }
  }

  /**
   * Releases a distributed lock using a safe Lua script to prevent releasing locks owned by others.
   */
  public static async release(
    lockKey: string,
    token: string
  ): Promise<boolean> {
    try {
      const releaseScript = `
        if redis.call("get", KEYS[1]) == ARGV[1] then
          return redis.call("del", KEYS[1])
        else
          return 0
        end
      `;

      const result = await redisConnection.eval(releaseScript, 1, lockKey, token);
      const released = result === 1;

      if (released) {
        logger.debug(`[DistributedLock] Released lock: ${lockKey}`);
      } else {
        logger.warn(`[DistributedLock] Release failed or lock expired for: ${lockKey}`);
      }

      return released;
    } catch (error) {
      logger.error(`Error releasing distributed lock for key ${lockKey}: ${(error as Error).message}`);
      return false;
    }
  }
}
