import { WorkerRepository, RegisterWorkerInput, UpdateHeartbeatInput } from './worker.repository.js';
import { WorkerStatusValue, HEARTBEAT_OFFLINE_THRESHOLD_MS } from './worker.constants.js';
import { WorkerStatus } from '@prisma/client';
import { logger } from '../../common/logger/logger.js';
import { eventBus } from '../../events/event.bus.js';

export class WorkerService {
  /**
   * Register a new worker and transition it to READY.
   */
  static async registerWorker(data: RegisterWorkerInput) {
    logger.info(`[WorkerService] Registering worker: ${data.hostname}:${data.port ?? 5001}`);

    const worker = await WorkerRepository.register(data);

    // Transition to READY immediately after registration
    const readyWorker = await WorkerRepository.updateStatus(worker.id, WorkerStatus.READY);

    eventBus.publish('worker.registered', {
      workerId: readyWorker.id,
      hostname: readyWorker.hostname,
      supportedJobs: readyWorker.supportedJobs as string[],
    });

    logger.info(`[WorkerService] Worker registered and READY: ${readyWorker.id} (${readyWorker.hostname})`);
    return readyWorker;
  }

  /**
   * Process a heartbeat from a worker.
   */
  static async heartbeat(workerId: string, data: UpdateHeartbeatInput) {
    const worker = await WorkerRepository.findById(workerId);
    if (!worker) {
      throw new Error(`Worker ${workerId} not found`);
    }

    if (worker.status === WorkerStatusValue.OFFLINE) {
      // Worker was marked offline but is back — resurrect it
      await WorkerRepository.updateStatus(workerId, WorkerStatus.READY);
      logger.info(`[WorkerService] Worker ${workerId} resurrected from OFFLINE to READY`);
    }

    const updated = await WorkerRepository.updateHeartbeat(workerId, data);

    let finalWorker = updated;
    // Update status based on load
    if (updated.runningJobs > 0 && updated.status === WorkerStatus.READY) {
      finalWorker = await WorkerRepository.updateStatus(workerId, WorkerStatus.BUSY);
    } else if (updated.runningJobs === 0 && updated.status === WorkerStatus.BUSY) {
      finalWorker = await WorkerRepository.updateStatus(workerId, WorkerStatus.READY);
    }

    eventBus.publish('worker.heartbeat', {
      workerId: finalWorker.id,
      runningJobs: finalWorker.runningJobs,
      currentLoad: finalWorker.currentLoad,
    });

    return finalWorker;
  }

  /**
   * Get a single worker by ID.
   */
  static async getWorker(id: string) {
    const worker = await WorkerRepository.findById(id);
    if (!worker) {
      throw new Error(`Worker ${id} not found`);
    }
    return worker;
  }

  /**
   * List all registered workers with optional status filter.
   */
  static async getAllWorkers(status?: string) {
    const statusFilter = status ? (status as WorkerStatus) : undefined;
    return WorkerRepository.findAll(statusFilter);
  }

  /**
   * Drain a worker: stop accepting new jobs, finish current work, then go OFFLINE.
   */
  static async drainWorker(id: string, reason?: string) {
    const worker = await WorkerRepository.findById(id);
    if (!worker) {
      throw new Error(`Worker ${id} not found`);
    }

    if (worker.status === WorkerStatusValue.OFFLINE) {
      throw new Error(`Worker ${id} is already OFFLINE`);
    }

    if (worker.status === WorkerStatusValue.DRAINING) {
      throw new Error(`Worker ${id} is already DRAINING`);
    }

    const drained = await WorkerRepository.updateStatus(id, WorkerStatus.DRAINING);

    eventBus.publish('worker.drained', {
      workerId: id,
      reason: reason || 'Manual drain',
    });

    logger.info(`[WorkerService] Worker ${id} is now DRAINING: ${reason || 'Manual drain'}`);
    return drained;
  }

  /**
   * Deregister a worker (set OFFLINE and optionally remove from DB).
   */
  static async deregisterWorker(id: string) {
    const worker = await WorkerRepository.findById(id);
    if (!worker) {
      throw new Error(`Worker ${id} not found`);
    }

    await WorkerRepository.updateStatus(id, WorkerStatus.OFFLINE);

    eventBus.publish('worker.offline', {
      workerId: id,
      reason: 'Deregistered',
    });

    logger.info(`[WorkerService] Worker ${id} deregistered and OFFLINE`);
    return { id, status: WorkerStatusValue.OFFLINE };
  }

  /**
   * Get aggregated worker and scheduling metrics.
   */
  static async getWorkerMetrics() {
    return WorkerRepository.getAggregatedMetrics();
  }

  /**
   * Find the best worker for a given job type using the registry.
   */
  static async findCapableWorkers(jobType: string) {
    return WorkerRepository.findHealthyByCapability(jobType);
  }
}
