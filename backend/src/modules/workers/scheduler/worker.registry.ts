import { WorkerRepository } from '../worker.repository.js';
import { WorkerStatus, WorkerNode } from '@prisma/client';
import { logger } from '../../../common/logger/logger.js';
import { eventBus } from '../../../events/event.bus.js';

/**
 * In-memory + DB-backed worker registry.
 * Provides fast lookups of registered workers and syncs periodically from DB.
 */
export class WorkerRegistry {
  private static workers: Map<string, WorkerNode> = new Map();
  private static syncInterval: ReturnType<typeof setInterval> | null = null;

  /**
   * Initialize the registry by loading all workers from DB.
   */
  static async initialize(): Promise<void> {
    await this.sync();

    // Periodic sync every 15 seconds
    this.syncInterval = setInterval(() => {
      this.sync().catch((err) => {
        logger.error(`[WorkerRegistry] Sync failed: ${err.message}`);
      });
    }, 15_000);

    logger.info(`[WorkerRegistry] Initialized with ${this.workers.size} worker(s)`);
  }

  /**
   * Sync the in-memory cache from the database.
   */
  static async sync(): Promise<void> {
    const allWorkers = await WorkerRepository.findAll();
    this.workers.clear();
    for (const w of allWorkers) {
      this.workers.set(w.id, w);
    }
  }

  /**
   * Add or update a worker in the in-memory cache.
   */
  static set(worker: WorkerNode): void {
    this.workers.set(worker.id, worker);
  }

  /**
   * Remove a worker from the in-memory cache.
   */
  static remove(workerId: string): void {
    this.workers.delete(workerId);
  }

  /**
   * Get a specific worker from the cache.
   */
  static get(workerId: string): WorkerNode | undefined {
    return this.workers.get(workerId);
  }

  /**
   * Get all workers from the cache.
   */
  static getAll(): WorkerNode[] {
    return Array.from(this.workers.values());
  }

  /**
   * Get all workers with a specific status.
   */
  static getByStatus(status: WorkerStatus): WorkerNode[] {
    return this.getAll().filter((w) => w.status === status);
  }

  /**
   * Get all READY workers that support a given job type.
   */
  static getCapableWorkers(jobType: string): WorkerNode[] {
    return this.getAll().filter((w) => {
      if (w.status !== WorkerStatus.READY) return false;
      const supported = w.supportedJobs as string[];
      return Array.isArray(supported) && supported.includes(jobType.toUpperCase());
    });
  }

  /**
   * Get all healthy workers (READY or BUSY with capacity).
   */
  static getHealthyWorkers(): WorkerNode[] {
    return this.getAll().filter(
      (w) => w.status === WorkerStatus.READY || w.status === WorkerStatus.BUSY
    );
  }

  /**
   * Get the count of workers by status.
   */
  static getCounts(): Record<string, number> {
    const counts: Record<string, number> = {
      total: 0,
      STARTING: 0,
      READY: 0,
      BUSY: 0,
      DRAINING: 0,
      OFFLINE: 0,
    };

    for (const w of this.workers.values()) {
      counts.total++;
      counts[w.status] = (counts[w.status] || 0) + 1;
    }

    return counts;
  }

  /**
   * Gracefully shut down the registry sync.
   */
  static shutdown(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
    this.workers.clear();
    logger.info('[WorkerRegistry] Shut down');
  }
}
