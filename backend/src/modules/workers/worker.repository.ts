import prisma from '../../prisma.js';
import { WorkerStatus } from '@prisma/client';
import { logger } from '../../common/logger/logger.js';

export interface RegisterWorkerInput {
  hostname: string;
  port?: number;
  region?: string;
  tags?: string[];
  cpu?: number;
  memory?: number;
  gpu?: boolean;
  supportedJobs?: string[];
  concurrency?: number;
  queueName?: string;
}

export interface UpdateHeartbeatInput {
  runningJobs?: number;
  completedJobs?: number;
  failedJobs?: number;
  currentLoad?: number;
}

export class WorkerRepository {
  /**
   * Register a new worker node in the database.
   */
  static async register(data: RegisterWorkerInput) {
    return prisma.workerNode.create({
      data: {
        hostname: data.hostname,
        port: data.port ?? 5001,
        status: WorkerStatus.STARTING,
        region: data.region ?? 'default',
        tags: data.tags ?? [],
        cpu: data.cpu ?? 1,
        memory: data.memory ?? 512,
        gpu: data.gpu ?? false,
        supportedJobs: data.supportedJobs ?? [],
        concurrency: data.concurrency ?? 5,
        queueName: data.queueName ?? null,
        lastHeartbeat: new Date(),
        startedAt: new Date(),
      },
    });
  }

  /**
   * Find a worker by ID.
   */
  static async findById(id: string) {
    return prisma.workerNode.findUnique({ where: { id } });
  }

  /**
   * List all registered workers, optionally filtered by status.
   */
  static async findAll(status?: WorkerStatus) {
    return prisma.workerNode.findMany({
      where: status ? { status } : undefined,
      orderBy: { startedAt: 'desc' },
    });
  }

  /**
   * Find all healthy workers (READY status) that support a given job type.
   */
  static async findHealthyByCapability(jobType: string) {
    const workers = await prisma.workerNode.findMany({
      where: {
        status: WorkerStatus.READY,
      },
      orderBy: { currentLoad: 'asc' },
    });

    // Filter by capability — supportedJobs is a JSON array
    return workers.filter((w) => {
      const supported = w.supportedJobs as string[];
      return Array.isArray(supported) && supported.includes(jobType.toUpperCase());
    });
  }

  /**
   * Update worker heartbeat timestamp and load metrics.
   */
  static async updateHeartbeat(id: string, data: UpdateHeartbeatInput) {
    return prisma.workerNode.update({
      where: { id },
      data: {
        lastHeartbeat: new Date(),
        runningJobs: data.runningJobs,
        completedJobs: data.completedJobs,
        failedJobs: data.failedJobs,
        currentLoad: data.currentLoad,
      },
    });
  }

  /**
   * Update the worker status.
   */
  static async updateStatus(id: string, status: WorkerStatus) {
    return prisma.workerNode.update({
      where: { id },
      data: { status },
    });
  }

  /**
   * Update running jobs count and current load for a worker.
   */
  static async updateLoad(id: string, runningJobs: number, currentLoad: number) {
    return prisma.workerNode.update({
      where: { id },
      data: { runningJobs, currentLoad },
    });
  }

  /**
   * Increment completed jobs counter atomically.
   */
  static async incrementCompleted(id: string) {
    return prisma.workerNode.update({
      where: { id },
      data: { completedJobs: { increment: 1 } },
    });
  }

  /**
   * Increment failed jobs counter atomically.
   */
  static async incrementFailed(id: string) {
    return prisma.workerNode.update({
      where: { id },
      data: { failedJobs: { increment: 1 } },
    });
  }

  /**
   * Mark workers with stale heartbeats as OFFLINE.
   * Returns the IDs of workers that were marked offline.
   */
  static async markStaleOffline(thresholdMs: number): Promise<string[]> {
    const cutoff = new Date(Date.now() - thresholdMs);
    const staleWorkers = await prisma.workerNode.findMany({
      where: {
        lastHeartbeat: { lt: cutoff },
        status: { notIn: [WorkerStatus.OFFLINE] },
      },
    });

    if (staleWorkers.length === 0) return [];

    const ids = staleWorkers.map((w) => w.id);
    await prisma.workerNode.updateMany({
      where: { id: { in: ids } },
      data: { status: WorkerStatus.OFFLINE },
    });

    logger.warn(`[WorkerRepository] Marked ${ids.length} stale worker(s) as OFFLINE: ${ids.join(', ')}`);
    return ids;
  }

  /**
   * Delete a worker registration.
   */
  static async delete(id: string) {
    return prisma.workerNode.delete({ where: { id } });
  }

  /**
   * Get aggregated worker metrics.
   */
  static async getAggregatedMetrics() {
    const workers = await prisma.workerNode.findMany();

    const total = workers.length;
    const online = workers.filter((w) => w.status !== WorkerStatus.OFFLINE).length;
    const ready = workers.filter((w) => w.status === WorkerStatus.READY).length;
    const busy = workers.filter((w) => w.status === WorkerStatus.BUSY).length;
    const draining = workers.filter((w) => w.status === WorkerStatus.DRAINING).length;
    const offline = workers.filter((w) => w.status === WorkerStatus.OFFLINE).length;

    const totalRunning = workers.reduce((sum, w) => sum + w.runningJobs, 0);
    const totalCompleted = workers.reduce((sum, w) => sum + w.completedJobs, 0);
    const totalFailed = workers.reduce((sum, w) => sum + w.failedJobs, 0);
    const avgLoad = total > 0
      ? workers.reduce((sum, w) => sum + w.currentLoad, 0) / total
      : 0;

    return {
      totalWorkers: total,
      onlineWorkers: online,
      readyWorkers: ready,
      busyWorkers: busy,
      drainingWorkers: draining,
      offlineWorkers: offline,
      totalRunningJobs: totalRunning,
      totalCompletedJobs: totalCompleted,
      totalFailedJobs: totalFailed,
      averageLoad: Math.round(avgLoad * 100) / 100,
    };
  }
}
