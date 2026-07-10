import { EmailHandler } from '../../../workers/handlers/email.handler.js';
import { logger } from '../../../common/logger/logger.js';
import { CircuitBreakerOpenException } from '../../resilience/circuit-breaker.js';

export async function runNetworkFailureScenario(): Promise<boolean> {
  logger.info('--- Running Chaos Scenario: External Service Network Failure ---');

  const emailHandler = new EmailHandler();
  const progressMock = async (percent: number) => {
    logger.debug(`Progress callback: ${percent}%`);
  };

  let failureCount = 0;
  let tripped = false;

  logger.info('Executing calls with simulated SMTP service failure to trip circuit breaker...');

  // Try executing the handler 4 times.
  // The first 3 should fail with the SMTP error.
  // The 4th should fail instantly with a CircuitBreakerOpenException.
  for (let i = 1; i <= 4; i++) {
    try {
      logger.info(`Sending email attempt #${i}...`);
      await emailHandler.execute(
        {
          to: 'customer@enterprise.com',
          subject: 'Outage Test',
          body: 'Simulating email SMTP failures',
          simulateFailure: true,
        },
        progressMock
      );
    } catch (error) {
      if (error instanceof CircuitBreakerOpenException) {
        logger.info(`SUCCESS: Attempt #${i} blocked by Circuit Breaker! State: OPEN`);
        tripped = true;
      } else {
        logger.warn(`Attempt #${i} failed as expected: ${(error as Error).message}`);
        failureCount++;
      }
    }
  }

  const success = failureCount === 3 && tripped;
  if (success) {
    logger.info('SUCCESS: Circuit Breaker successfully intercepted SMTP failure cascade.');
  } else {
    logger.error(`FAILURE: Expected 3 SMTP failures and 1 CircuitBreaker block, got ${failureCount} failures and tripped=${tripped}`);
  }

  return success;
}
