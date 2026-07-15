import client from 'prom-client';
import { WorkerRegistry } from './worker.registry.js';
import { IntelligentScheduler } from './worker.scheduler.js';
import { logger } from '../../../common/logger/logger.js';

/**
 * Worker Health Monitor
 *
 * Exposes Prometheus metrics for the worker fleet and scheduler performance.
 * Metrics are registered once and updated on each scrape.
 */
export class WorkerHealthMonitor {
  private static initialized = false;
  private static register: client.Registry;

  // Worker fleet gauges
  private static workerCountGauge: client.Gauge;
  private static workerUtilizationGauge: client.Gauge;
  private static workerRunningJobsGauge: client.Gauge;

  // Scheduler metrics
  private static schedulerAssignmentsCounter: client.Counter;
  private static schedulerFallbacksCounter: client.Counter;
  private static schedulerLatencyHistogram: client.Histogram;
  private static workerFailoversCounter: client.Counter;

  /**
   * Initialize all Prometheus metrics for worker management.
   * Should be called once during server startup.
   */
  static initialize(promRegister: client.Registry): void {
    if (this.initialized) return;
    this.register = promRegister;

    this.workerCountGauge = new client.Gauge({
      name: 'jobflow_worker_count',
      help: 'Number of registered workers by status',
      labelNames: ['status'],
    });
    promRegister.registerMetric(this.workerCountGauge);

    this.workerUtilizationGauge = new client.Gauge({
      name: 'jobflow_worker_utilization',
      help: 'Worker utilization (0.0 to 1.0)',
      labelNames: ['worker_id', 'hostname'],
    });
    promRegister.registerMetric(this.workerUtilizationGauge);

    this.workerRunningJobsGauge = new client.Gauge({
      name: 'jobflow_worker_running_jobs',
      help: 'Number of jobs currently running on each worker',
      labelNames: ['worker_id', 'hostname'],
    });
    promRegister.registerMetric(this.workerRunningJobsGauge);

    this.schedulerAssignmentsCounter = new client.Counter({
      name: 'jobflow_scheduler_assignments_total',
      help: 'Total number of intelligent scheduler assignments',
      labelNames: ['policy'],
    });
    promRegister.registerMetric(this.schedulerAssignmentsCounter);

    this.schedulerFallbacksCounter = new client.Counter({
      name: 'jobflow_scheduler_fallbacks_total',
      help: 'Total number of fallback assignments (no specialized worker found)',
    });
    promRegister.registerMetric(this.schedulerFallbacksCounter);

    this.schedulerLatencyHistogram = new client.Histogram({
      name: 'jobflow_scheduler_assignment_duration_seconds',
      help: 'Time taken to assign a job to a worker',
      buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5],
    });
    promRegister.registerMetric(this.schedulerLatencyHistogram);

    this.workerFailoversCounter = new client.Counter({
      name: 'jobflow_worker_failovers_total',
      help: 'Total number of worker failover events',
    });
    promRegister.registerMetric(this.workerFailoversCounter);

    this.initialized = true;
    logger.info('[WorkerHealthMonitor] Prometheus metrics initialized');
  }

  /**
   * Update metric values from current state (called before Prometheus scrape).
   */
  static async collectMetrics(): Promise<void> {
    if (!this.initialized) return;

    try {
      // Worker count by status
      const counts = WorkerRegistry.getCounts();
      for (const [status, count] of Object.entries(counts)) {
        if (status !== 'total') {
          this.workerCountGauge.set({ status }, count);
        }
      }

      // Per-worker utilization and running jobs
      const allWorkers = WorkerRegistry.getAll();
      for (const worker of allWorkers) {
        this.workerUtilizationGauge.set(
          { worker_id: worker.id, hostname: worker.hostname },
          worker.currentLoad
        );
        this.workerRunningJobsGauge.set(
          { worker_id: worker.id, hostname: worker.hostname },
          worker.runningJobs
        );
      }

      // Scheduler metrics
      const schedulerMetrics = IntelligentScheduler.getMetrics();
      this.schedulerAssignmentsCounter.reset();
      this.schedulerAssignmentsCounter.inc(
        { policy: schedulerMetrics.policy },
        schedulerMetrics.totalAssignments
      );
      this.schedulerFallbacksCounter.reset();
      this.schedulerFallbacksCounter.inc(schedulerMetrics.totalFallbacks);
    } catch (err) {
      logger.error(`[WorkerHealthMonitor] Metrics collection failed: ${(err as Error).message}`);
    }
  }

  /**
   * Record a failover event.
   */
  static recordFailover(): void {
    if (this.initialized) {
      this.workerFailoversCounter.inc();
    }
  }

  /**
   * Record a scheduler assignment latency.
   */
  static recordAssignmentLatency(durationSeconds: number): void {
    if (this.initialized) {
      this.schedulerLatencyHistogram.observe(durationSeconds);
    }
  }
}
