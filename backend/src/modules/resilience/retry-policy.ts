import { logger } from '../../common/logger/logger.js';

export class RetryPolicy {
  /**
   * Executes a callback function with custom retries, exponential backoff, and jitter.
   */
  public static async execute<T>(
    fn: () => Promise<T>,
    maxRetries = 3,
    initialDelayMs = 1000,
    backoffFactor = 2
  ): Promise<T> {
    let attempt = 0;
    let delay = initialDelayMs;

    while (true) {
      try {
        return await fn();
      } catch (error) {
        attempt++;
        if (attempt > maxRetries) {
          logger.error(`[RetryPolicy] Executed max retries (${maxRetries}). Operation failed permanently: ${(error as Error).message}`);
          throw error;
        }

        // Apply exponential backoff with a simple random jitter
        const jitter = Math.random() * 200;
        const sleepTime = delay + jitter;
        logger.warn(`[RetryPolicy] Attempt ${attempt} failed. Retrying in ${Math.round(sleepTime)}ms... Error: ${(error as Error).message}`);

        await new Promise((resolve) => setTimeout(resolve, sleepTime));
        delay *= backoffFactor;
      }
    }
  }
}
