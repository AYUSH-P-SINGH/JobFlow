import { runWorkerCrashScenario } from './scenarios/worker-crash.scenario.js';
import { runRedisOutageScenario } from './scenarios/redis-outage.scenario.js';
import { runPostgresLatencyScenario } from './scenarios/postgres-latency.scenario.js';
import { runNetworkFailureScenario } from './scenarios/network-failure.scenario.js';
import { logger } from '../../common/logger/logger.js';

async function runChaosSuite() {
  logger.info('=============================================');
  logger.info('      STARTING JOBFLOW CHAOS TESTING SUITE   ');
  logger.info('=============================================');

  const results = {
    workerCrash: false,
    redisOutage: false,
    postgresLatency: false,
    networkFailure: false,
  };

  try {
    results.workerCrash = await runWorkerCrashScenario();
  } catch (err) {
    logger.error(`Error in Worker Crash scenario: ${(err as Error).message}`);
  }

  try {
    results.redisOutage = await runRedisOutageScenario();
  } catch (err) {
    logger.error(`Error in Redis Outage scenario: ${(err as Error).message}`);
  }

  try {
    results.postgresLatency = await runPostgresLatencyScenario();
  } catch (err) {
    logger.error(`Error in Postgres Latency scenario: ${(err as Error).message}`);
  }

  try {
    results.networkFailure = await runNetworkFailureScenario();
  } catch (err) {
    logger.error(`Error in Network Failure scenario: ${(err as Error).message}`);
  }

  logger.info('=============================================');
  logger.info('             CHAOS RUN SUMMARY               ');
  logger.info('=============================================');
  logger.info(`1. Worker Crash Recovery:   ${results.workerCrash ? 'PASSED' : 'FAILED'}`);
  logger.info(`2. Redis Outage Resilience:  ${results.redisOutage ? 'PASSED' : 'FAILED'}`);
  logger.info(`3. Postgres Latency Check:   ${results.postgresLatency ? 'PASSED' : 'FAILED'}`);
  logger.info(`4. External Network Failure:  ${results.networkFailure ? 'PASSED' : 'FAILED'}`);
  logger.info('=============================================');

  const allPassed = Object.values(results).every((v) => v === true);
  process.exit(allPassed ? 0 : 1);
}

runChaosSuite().catch((err) => {
  logger.error(`Chaos testing suite failed to run: ${err.message}`);
  process.exit(1);
});
