import { randomUUID } from 'crypto';

export interface WorkerMetrics {
  totalProcessed: number;
  successes: number;
  failures: number;
}

export interface LastJobDetails {
  jobId: string;
  completedAt: Date;
  status: 'COMPLETED' | 'FAILED';
}

export class WorkerHealthTracker {
  private static instance: WorkerHealthTracker;

  public readonly workerId: string;
  private currentJobId: string | null = null;
  private activeJobIds = new Set<string>();
  private concurrency = 5;
  private metrics: WorkerMetrics = { totalProcessed: 0, successes: 0, failures: 0 };
  private lastJob: LastJobDetails | null = null;

  private constructor() {
    this.workerId = `worker-${randomUUID()}`;
  }

  public static getInstance(): WorkerHealthTracker {
    if (!WorkerHealthTracker.instance) {
      WorkerHealthTracker.instance = new WorkerHealthTracker();
    }
    return WorkerHealthTracker.instance;
  }

  public setConcurrency(concurrency: number): void {
    this.concurrency = concurrency;
  }

  public getConcurrency(): number {
    return this.concurrency;
  }

  public getUtilization(): number {
    return this.concurrency > 0 ? this.activeJobIds.size / this.concurrency : 0;
  }

  public getActiveJobsCount(): number {
    return this.activeJobIds.size;
  }

  public startJob(jobId: string) {
    this.activeJobIds.add(jobId);
    this.currentJobId = jobId;
  }

  public completeJob(jobId: string) {
    this.activeJobIds.delete(jobId);
    this.currentJobId = this.activeJobIds.values().next().value || null;
    this.metrics.totalProcessed++;
    this.metrics.successes++;
    this.lastJob = {
      jobId,
      completedAt: new Date(),
      status: 'COMPLETED',
    };
  }

  public failJob(jobId: string) {
    this.activeJobIds.delete(jobId);
    this.currentJobId = this.activeJobIds.values().next().value || null;
    this.metrics.totalProcessed++;
    this.metrics.failures++;
    this.lastJob = {
      jobId,
      completedAt: new Date(),
      status: 'FAILED',
    };
  }

  public getHealthData() {
    const memory = process.memoryUsage();
    return {
      workerId: this.workerId,
      uptime: process.uptime(),
      memory: {
        rss: `${Math.round(memory.rss / 1024 / 1024)} MB`,
        heapTotal: `${Math.round(memory.heapTotal / 1024 / 1024)} MB`,
        heapUsed: `${Math.round(memory.heapUsed / 1024 / 1024)} MB`,
      },
      currentJobId: this.currentJobId,
      activeJobsCount: this.activeJobIds.size,
      concurrency: this.concurrency,
      utilization: this.getUtilization(),
      metrics: { ...this.metrics },
      lastJob: this.lastJob,
    };
  }
}
