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

  // Phase 16: Extended tracking
  private _isDraining = false;
  private _supportedJobs: string[] = [];
  private _queueNames: string[] = [];
  private _registeredWorkerId: string | null = null;

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

  // ─── Phase 16: Extended Methods ──────────────────────────────────────

  /**
   * Set the registered worker ID from the API server registration.
   */
  public setRegisteredWorkerId(id: string): void {
    this._registeredWorkerId = id;
  }

  /**
   * Get the registered worker ID (from the WorkerNode table).
   */
  public getRegisteredWorkerId(): string | null {
    return this._registeredWorkerId;
  }

  /**
   * Set supported job types for this worker.
   */
  public setSupportedJobs(jobs: string[]): void {
    this._supportedJobs = jobs;
  }

  /**
   * Get supported job types.
   */
  public getSupportedJobs(): string[] {
    return this._supportedJobs;
  }

  /**
   * Set the queue names this worker is subscribed to.
   */
  public setQueueNames(names: string[]): void {
    this._queueNames = names;
  }

  /**
   * Get the queue names this worker is subscribed to.
   */
  public getQueueNames(): string[] {
    return this._queueNames;
  }

  /**
   * Check if the worker is draining.
   */
  public isDraining(): boolean {
    return this._isDraining;
  }

  /**
   * Set the draining state.
   */
  public setDraining(draining: boolean): void {
    this._isDraining = draining;
  }

  /**
   * Get the current CPU usage percentage (0.0 to 1.0).
   */
  public getCpuLoad(): number {
    const cpus = process.cpuUsage();
    // Rough approximation — ratio of CPU time to uptime
    const totalCpuTime = (cpus.user + cpus.system) / 1e6; // convert to seconds
    const uptime = process.uptime();
    return uptime > 0 ? Math.min(totalCpuTime / uptime, 1.0) : 0;
  }

  /**
   * Get memory usage in MB.
   */
  public getMemoryUsageMB(): number {
    return Math.round(process.memoryUsage().rss / 1024 / 1024);
  }

  /**
   * Build the heartbeat payload for the API server.
   */
  public buildHeartbeatPayload() {
    return {
      runningJobs: this.activeJobIds.size,
      completedJobs: this.metrics.successes,
      failedJobs: this.metrics.failures,
      currentLoad: this.getUtilization(),
    };
  }

  public getHealthData() {
    const memory = process.memoryUsage();
    return {
      workerId: this.workerId,
      registeredWorkerId: this._registeredWorkerId,
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
      isDraining: this._isDraining,
      supportedJobs: this._supportedJobs,
      queueNames: this._queueNames,
      metrics: { ...this.metrics },
      lastJob: this.lastJob,
    };
  }
}
