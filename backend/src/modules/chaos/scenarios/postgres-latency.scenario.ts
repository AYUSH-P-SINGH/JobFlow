import prisma from '../../../prisma.js';
import { logger } from '../../../common/logger/logger.js';

export async function runPostgresLatencyScenario(): Promise<boolean> {
  logger.info('--- Running Chaos Scenario: PostgreSQL Latency ---');

  const startTime = Date.now();
  try {
    logger.info('Injecting a 2-second SELECT pg_sleep(2) delay query...');
    await prisma.$queryRaw`SELECT pg_sleep(2)`;
    const duration = Date.now() - startTime;
    logger.info(`Database response received after ${duration}ms.`);
    
    const success = duration >= 2000;
    if (success) {
      logger.info('SUCCESS: Database latency injected and handled successfully.');
    }
    return success;
  } catch (error) {
    logger.error(`Database query failed during latency simulation: ${(error as Error).message}`);
    return false;
  }
}
