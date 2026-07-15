import { createJobWorker, closeJobWorker, createSpecializedWorker, closeSpecializedWorkers } from './worker.factory.js';
import { startCronWorker, stopCronWorker } from '../modules/scheduler/cron.runner.js';
import prisma from '../prisma.js';
import { redisConnection } from '../config/redis.js';
import { logger } from '../common/logger/logger.js';
import { RecoveryService } from '../modules/recovery/recovery.service.js';
import { RetentionService } from '../modules/governance/retention.service.js';
import { WorkerHealthTracker } from './worker.health.js';
import { QueuePartitioner } from '../queues/queue.partitioner.js';
import { HEARTBEAT_INTERVAL_MS } from '../modules/workers/worker.constants.js';
import '../modules/plugins/plugin.manager.js';

/** The API server URL for worker self-registration */
const API_SERVER_URL = process.env.API_SERVER_URL || 'http://localhost:5000';

/** Supported job types from environment (comma-separated, e.g. "EMAIL,PDF") */
const WORKER_SUPPORTED_JOBS = (process.env.WORKER_SUPPORTED_JOBS || '')
  .split(',')
  .map((s) => s.trim().toUpperCase())
  .filter(Boolean);

/** Worker concurrency from environment */
const WORKER_CONCURRENCY = parseInt(process.env.WORKER_CONCURRENCY || '5', 10);

/** Worker region from environment */
const WORKER_REGION = process.env.WORKER_REGION || 'default';

/** Worker tags from environment (comma-separated) */
const WORKER_TAGS = (process.env.WORKER_TAGS || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

let heartbeatTimer: ReturnType<typeof setInterval> | null = null;

/**
 * Register this worker with the API server.
 */
async function selfRegister(): Promise<void> {
  const tracker = WorkerHealthTracker.getInstance();

  if (WORKER_SUPPORTED_JOBS.length === 0) {
    logger.info('[WorkerLifecycle] No WORKER_SUPPORTED_JOBS configured. Skipping registration (using default queue only).');
    return;
  }

  const hostname = process.env.HOSTNAME || require('os').hostname();
  const port = parseInt(process.env.WORKER_PORT || '5001', 10);

  const registrationPayload = {
    hostname,
    port,
    region: WORKER_REGION,
    tags: WORKER_TAGS,
    cpu: require('os').cpus().length,
    memory: Math.round(require('os').totalmem() / 1024 / 1024),
    gpu: process.env.WORKER_GPU === 'true',
    supportedJobs: WORKER_SUPPORTED_JOBS,
    concurrency: WORKER_CONCURRENCY,
  };

  try {
    const response = await fetch(`${API_SERVER_URL}/api/v1/workers/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(registrationPayload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      logger.error(`[WorkerLifecycle] Registration failed (${response.status}): ${errorText}`);
      return;
    }

    const data = await response.json() as any;
    const registeredId = data.worker?.id;

    if (registeredId) {
      tracker.setRegisteredWorkerId(registeredId);
      tracker.setSupportedJobs(WORKER_SUPPORTED_JOBS);
      logger.info(`[WorkerLifecycle] Worker registered with API server: ${registeredId}`);
    }
  } catch (err) {
    logger.warn(`[WorkerLifecycle] Could not register with API server: ${(err as Error).message}. Will operate in standalone mode.`);
  }
}

/**
 * Start sending heartbeats to the API server.
 */
function startHeartbeat(): void {
  const tracker = WorkerHealthTracker.getInstance();

  heartbeatTimer = setInterval(async () => {
    const registeredId = tracker.getRegisteredWorkerId();
    if (!registeredId) return;

    try {
      const payload = tracker.buildHeartbeatPayload();
      const response = await fetch(`${API_SERVER_URL}/api/v1/workers/${registeredId}/heartbeat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        logger.warn(`[WorkerLifecycle] Heartbeat failed (${response.status})`);
      }
    } catch (err) {
      logger.warn(`[WorkerLifecycle] Heartbeat error: ${(err as Error).message}`);
    }
  }, HEARTBEAT_INTERVAL_MS);

  logger.info(`[WorkerLifecycle] Heartbeat started (every ${HEARTBEAT_INTERVAL_MS / 1000}s)`);
}

/**
 * Deregister this worker from the API server.
 */
async function selfDeregister(): Promise<void> {
  const tracker = WorkerHealthTracker.getInstance();
  const registeredId = tracker.getRegisteredWorkerId();

  if (!registeredId) return;

  try {
    await fetch(`${API_SERVER_URL}/api/v1/workers/${registeredId}`, {
      method: 'DELETE',
    });
    logger.info(`[WorkerLifecycle] Worker deregistered: ${registeredId}`);
  } catch (err) {
    logger.warn(`[WorkerLifecycle] Deregistration failed: ${(err as Error).message}`);
  }
}

export async function initializeWorker(): Promise<void> {
  const tracker = WorkerHealthTracker.getInstance();

  // Always create the default job worker for backward compatibility
  createJobWorker();

  // Phase 16: Create specialized workers based on supported job types
  if (WORKER_SUPPORTED_JOBS.length > 0) {
    const queues = QueuePartitioner.getQueuesForJobTypes(WORKER_SUPPORTED_JOBS);
    tracker.setQueueNames(queues);

    for (const queueName of queues) {
      // Skip the default queue — already created above
      if (queueName === 'job-processing') continue;
      createSpecializedWorker(queueName, WORKER_CONCURRENCY);
    }

    logger.info(
      `[WorkerLifecycle] Specialized workers created for queues: ${queues.join(', ')}`
    );
  }

  startCronWorker();
  logger.info('Worker lifecycle initialized');

  // Phase 16: Self-register and start heartbeat
  await selfRegister();
  startHeartbeat();

  // Run database-backed workflow recovery scan on startup
  RecoveryService.recoverRunningWorkflows().catch((err) => {
    logger.error('Error running startup recovery scan:', err);
  });

  // Run data retention cleanup once on startup
  RetentionService.runCleanup().catch((err) => {
    logger.error('Error running startup data retention cleanup:', err);
  });

  // Run data retention cleanup periodically every 24 hours
  setInterval(() => {
    RetentionService.runCleanup().catch((err) => {
      logger.error('Error running periodic data retention cleanup:', err);
    });
  }, 24 * 60 * 60 * 1000);
}

export async function shutdownWorker(): Promise<void> {
  logger.info('Starting worker graceful shutdown sequence...');

  // Phase 16: Stop heartbeat
  if (heartbeatTimer) {
    clearInterval(heartbeatTimer);
    heartbeatTimer = null;
    logger.info('Heartbeat timer stopped');
  }

  // Phase 16: Deregister from API server
  await selfDeregister();

  // 1. Close BullMQ Workers
  try {
    await closeJobWorker();
  } catch (error) {
    logger.error('Error closing BullMQ worker:', error);
  }

  // Phase 16: Close specialized workers
  try {
    await closeSpecializedWorkers();
  } catch (error) {
    logger.error('Error closing specialized workers:', error);
  }

  try {
    await stopCronWorker();
  } catch (error) {
    logger.error('Error closing Cron scheduler worker:', error);
  }

  // 2. Disconnect database client
  try {
    await prisma.$disconnect();
    logger.info('Prisma Database disconnected');
  } catch (error) {
    logger.error('Error disconnecting Prisma:', error);
  }

  // 3. Disconnect shared Redis connection
  try {
    await redisConnection.quit();
    logger.info('Redis connection disconnected');
  } catch (error) {
    logger.error('Error disconnecting Redis:', error);
  }

  logger.info('Worker graceful shutdown complete');
}
