import { WorkerRegistry } from './worker.registry.js';
import { WorkerSelection } from './worker.selection.js';
import { DEFAULT_SCHEDULER_POLICY, SchedulerPolicy } from '../worker.constants.js';
import { QueuePartitioner } from '../../../queues/queue.partitioner.js';
import { QueueNames } from '../../../queues/queue.constants.js';
import { logger } from '../../../common/logger/logger.js';
import type { WorkerNode } from '@prisma/client';

export interface SchedulerResult {
  workerId: string | null;
  queueName: string;
  policy: SchedulerPolicy;
  candidateCount: number;
}

/**
 * Intelligent Scheduler
 * Integrates with the Worker Registry and Queue Partitioner to route jobs
 * to the best available worker via its specialized queue.
 */
export class IntelligentScheduler {
  private static policy: SchedulerPolicy = DEFAULT_SCHEDULER_POLICY;

  // Metrics tracking
  private static totalAssignments = 0;
  private static totalFallbacks = 0;
  private static assignmentLatencies: number[] = [];

  /**
   * Set the scheduling policy at runtime.
   */
  static setPolicy(policy: SchedulerPolicy): void {
    this.policy = policy;
    logger.info(`[IntelligentScheduler] Policy changed to: ${policy}`);
  }

  /**
   * Get the current scheduling policy.
   */
  static getPolicy(): SchedulerPolicy {
    return this.policy;
  }

  /**
   * Select the best worker and queue for a given job type.
   *
   * Algorithm:
   * 1. Find capable workers from the registry
   * 2. Apply scheduling policy to select the best worker
   * 3. Determine the target queue (specialized or fallback to default)
   */
  static async scheduleJob(jobType: string): Promise<SchedulerResult> {
    const startTime = Date.now();

    // 1. Get capable workers from the in-memory registry
    const capableWorkers = WorkerRegistry.getCapableWorkers(jobType);

    logger.info(
      `[IntelligentScheduler] Found ${capableWorkers.length} capable worker(s) for job type: ${jobType}`
    );

    // 2. If no specialized workers, fallback to default queue
    if (capableWorkers.length === 0) {
      this.totalFallbacks++;
      const fallbackQueue = QueueNames.JOB_QUEUE;
      const latency = Date.now() - startTime;
      this.recordLatency(latency);

      logger.info(
        `[IntelligentScheduler] No specialized workers for ${jobType}. Falling back to queue: ${fallbackQueue}`
      );

      return {
        workerId: null,
        queueName: fallbackQueue,
        policy: this.policy,
        candidateCount: 0,
      };
    }

    // 3. Apply scheduling policy
    const selectedWorker = WorkerSelection.select(capableWorkers, this.policy);

    if (!selectedWorker) {
      this.totalFallbacks++;
      const fallbackQueue = QueueNames.JOB_QUEUE;
      const latency = Date.now() - startTime;
      this.recordLatency(latency);

      return {
        workerId: null,
        queueName: fallbackQueue,
        policy: this.policy,
        candidateCount: 0,
      };
    }

    // 4. Determine the target queue for this worker
    const targetQueue = selectedWorker.queueName || QueuePartitioner.getQueueForJobType(jobType);

    this.totalAssignments++;
    const latency = Date.now() - startTime;
    this.recordLatency(latency);

    logger.info(
      `[IntelligentScheduler] Assigned ${jobType} to Worker ${selectedWorker.id} ` +
      `(${selectedWorker.hostname}) via queue: ${targetQueue} [Policy: ${this.policy}]`
    );

    return {
      workerId: selectedWorker.id,
      queueName: targetQueue,
      policy: this.policy,
      candidateCount: capableWorkers.length,
    };
  }

  /**
   * Record assignment latency for metrics.
   */
  private static recordLatency(latencyMs: number): void {
    this.assignmentLatencies.push(latencyMs);
    // Keep only last 1000 measurements
    if (this.assignmentLatencies.length > 1000) {
      this.assignmentLatencies = this.assignmentLatencies.slice(-1000);
    }
  }

  /**
   * Get scheduler metrics.
   */
  static getMetrics() {
    const avgLatency =
      this.assignmentLatencies.length > 0
        ? this.assignmentLatencies.reduce((a, b) => a + b, 0) / this.assignmentLatencies.length
        : 0;

    const registryCounts = WorkerRegistry.getCounts();

    return {
      policy: this.policy,
      totalAssignments: this.totalAssignments,
      totalFallbacks: this.totalFallbacks,
      averageAssignmentLatencyMs: Math.round(avgLatency * 100) / 100,
      workers: registryCounts,
    };
  }

  /**
   * Reset scheduler metrics (for testing).
   */
  static resetMetrics(): void {
    this.totalAssignments = 0;
    this.totalFallbacks = 0;
    this.assignmentLatencies = [];
  }
}
