import { WorkerNode } from '@prisma/client';
import { SchedulerPolicy } from '../worker.constants.js';
import { logger } from '../../../common/logger/logger.js';

/**
 * Worker selection strategies for the intelligent scheduler.
 * Each strategy takes a list of capable workers and returns the best candidate.
 */
export class WorkerSelection {
  private static roundRobinIndex = 0;

  /**
   * Select the best worker based on the given scheduling policy.
   */
  static select(workers: WorkerNode[], policy: SchedulerPolicy): WorkerNode | null {
    if (workers.length === 0) return null;

    switch (policy) {
      case SchedulerPolicy.LEAST_LOADED:
        return this.leastLoaded(workers);
      case SchedulerPolicy.ROUND_ROBIN:
        return this.roundRobin(workers);
      case SchedulerPolicy.CAPABILITY_MATCH:
        return this.capabilityMatch(workers);
      case SchedulerPolicy.RANDOM:
        return this.random(workers);
      case SchedulerPolicy.PRIORITY:
        return this.priority(workers);
      default:
        return this.leastLoaded(workers);
    }
  }

  /**
   * LEAST_LOADED — Select the worker with the lowest current load.
   * Tie-breaking: prefer the worker with fewer running jobs.
   */
  private static leastLoaded(workers: WorkerNode[]): WorkerNode {
    return workers.reduce((best, w) => {
      if (w.currentLoad < best.currentLoad) return w;
      if (w.currentLoad === best.currentLoad && w.runningJobs < best.runningJobs) return w;
      return best;
    });
  }

  /**
   * ROUND_ROBIN — Rotate through available workers in order.
   */
  private static roundRobin(workers: WorkerNode[]): WorkerNode {
    const index = this.roundRobinIndex % workers.length;
    this.roundRobinIndex = (this.roundRobinIndex + 1) % Number.MAX_SAFE_INTEGER;
    return workers[index];
  }

  /**
   * CAPABILITY_MATCH — Workers are pre-filtered by capability.
   * Among matching workers, select the one with the lowest load.
   * This is the default strategy.
   */
  private static capabilityMatch(workers: WorkerNode[]): WorkerNode {
    // Workers passed here are already capability-filtered.
    // Pick the least loaded among them.
    return this.leastLoaded(workers);
  }

  /**
   * RANDOM — Pick a random worker from the capable list.
   */
  private static random(workers: WorkerNode[]): WorkerNode {
    const index = Math.floor(Math.random() * workers.length);
    return workers[index];
  }

  /**
   * PRIORITY — Prefer workers with the "priority" tag, then fall back to least loaded.
   */
  private static priority(workers: WorkerNode[]): WorkerNode {
    const priorityWorkers = workers.filter((w) => {
      const tags = w.tags as string[];
      return Array.isArray(tags) && tags.includes('priority');
    });

    if (priorityWorkers.length > 0) {
      return this.leastLoaded(priorityWorkers);
    }

    return this.leastLoaded(workers);
  }
}
