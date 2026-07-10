import client from 'prom-client';
  import { getJobQueue } from '../../queues/job.queue.js';
  import { workflowRepository } from '../workflow/workflow.repository.js';
  import { WorkerHealthTracker } from '../../workers/worker.health.js';
  import prisma from '../../prisma.js';
  import { DashboardStats, QueueStats, WorkflowStats, WorkerStats } from './monitoring.types.js';
  import { eventBus } from '../../events/event.bus.js';

  // Create Registry
  const register = new client.Registry();

  // Enable default node metrics
  client.collectDefaultMetrics({ register });

  // Custom Prometheus metrics
  const completedJobsCounter = new client.Counter({
    name: 'jobflow_jobs_completed_total',
    help: 'Total number of completed jobs',
    labelNames: ['type'],
  });
  register.registerMetric(completedJobsCounter);

  const failedJobsCounter = new client.Counter({
    name: 'jobflow_jobs_failed_total',
    help: 'Total number of failed jobs',
    labelNames: ['type'],
  });
  register.registerMetric(failedJobsCounter);

  const queueSizeGauge = new client.Gauge({
    name: 'jobflow_queue_size',
    help: 'Current size of the job processing queue by status',
    labelNames: ['status'],
  });
  register.registerMetric(queueSizeGauge);

  const workerMemoryGauge = new client.Gauge({
    name: 'worker_memory_usage',
    help: 'Worker process RSS memory usage in bytes',
    labelNames: ['workerId'],
  });
  register.registerMetric(workerMemoryGauge);

  const workflowExecutionCounter = new client.Counter({
    name: 'jobflow_workflows_total',
    help: 'Total number of executed workflows by status',
    labelNames: ['status'],
  });
  register.registerMetric(workflowExecutionCounter);

  const httpRequestDuration = new client.Histogram({
    name: 'http_request_duration_seconds',
    help: 'Duration of HTTP requests in seconds',
    labelNames: ['method', 'route', 'status_code'],
    buckets: [0.05, 0.1, 0.2, 0.5, 1, 2, 5],
  });
  register.registerMetric(httpRequestDuration);

  const jobQueueDelay = new client.Histogram({
    name: 'jobflow_job_queue_delay_seconds',
    help: 'Delay between job creation and execution start in seconds',
    labelNames: ['type'],
    buckets: [0.5, 1, 2, 5, 10, 30],
  });
  register.registerMetric(jobQueueDelay);

  export class MetricsService {
    /**
     * Initializes metric event listeners to count completions/failures.
     */
    public static initSubscriptions(): void {
      eventBus.subscribe('job.completed', ({ job }) => {
        completedJobsCounter.inc({ type: job.type });
        if (job.startedAt && job.createdAt) {
          const delay = (new Date(job.startedAt).getTime() - new Date(job.createdAt).getTime()) / 1000;
          jobQueueDelay.observe({ type: job.type }, delay);
        }
      });

      eventBus.subscribe('job.failed', ({ job }) => {
        failedJobsCounter.inc({ type: job.type });
      });

      eventBus.subscribe('workflow.completed', () => {
        workflowExecutionCounter.inc({ status: 'completed' });
      });

      eventBus.subscribe('workflow.failed', () => {
        workflowExecutionCounter.inc({ status: 'failed' });
      });
    }

    /**
     * Records HTTP latency metrics for REST endpoints.
     */
    public static recordHttpDuration(
      method: string,
      route: string,
      statusCode: number,
      durationSeconds: number
    ): void {
      httpRequestDuration.observe(
        { method, route, status_code: String(statusCode) },
        durationSeconds
      );
    }

    /**
     * Exposes Prometheus formatted string metrics.
     */
    public static async getPrometheusMetrics(): Promise<string> {
      try {
        const queue = getJobQueue();
        const [waiting, active, delayed, completed, failed] = await Promise.all([
          queue.getWaitingCount(),
          queue.getActiveCount(),
          queue.getDelayedCount(),
          queue.getCompletedCount(),
          queue.getFailedCount(),
        ]);

        queueSizeGauge.set({ status: 'waiting' }, waiting);
        queueSizeGauge.set({ status: 'active' }, active);
        queueSizeGauge.set({ status: 'delayed' }, delayed);
        queueSizeGauge.set({ status: 'completed' }, completed);
        queueSizeGauge.set({ status: 'failed' }, failed);
      } catch (err) {
        // Queue may not be ready
      }

      try {
        const health = WorkerHealthTracker.getInstance().getHealthData();
        const memory = process.memoryUsage();
        workerMemoryGauge.set({ workerId: health.workerId }, memory.rss);
      } catch (err) {
        // Health tracker not ready
      }

      return register.metrics();
    }

    /**
     * Collects summary metrics for the operator dashboard.
     */
    public static async getDashboardStats(): Promise<DashboardStats> {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const [completedToday, failedToday] = await Promise.all([
        prisma.job.count({ where: { status: 'COMPLETED', updatedAt: { gte: today } } }),
        prisma.job.count({ where: { status: 'FAILED', updatedAt: { gte: today } } }),
      ]);

      let runningJobs = 0;
      try {
        const queue = getJobQueue();
        runningJobs = await queue.getActiveCount();
      } catch (err) {
        runningJobs = await prisma.job.count({ where: { status: 'RUNNING' } });
      }

      return {
        workers: 1, // Single-process deployment context
        runningJobs,
        completedToday,
        failedToday,
      };
    }

    /**
     * Fetches raw BullMQ queue counts.
     */
    public static async getQueueStats(): Promise<QueueStats> {
      try {
        const queue = getJobQueue();
        const [waiting, active, delayed, completed, failed] = await Promise.all([
          queue.getWaitingCount(),
          queue.getActiveCount(),
          queue.getDelayedCount(),
          queue.getCompletedCount(),
          queue.getFailedCount(),
        ]);
        return { waiting, active, delayed, completed, failed };
      } catch (err) {
        const [waiting, active, delayed, completed, failed] = await Promise.all([
          prisma.job.count({ where: { status: 'PENDING' } }),
          prisma.job.count({ where: { status: 'RUNNING' } }),
          prisma.job.count({ where: { status: 'QUEUED' } }),
          prisma.job.count({ where: { status: 'COMPLETED' } }),
          prisma.job.count({ where: { status: 'FAILED' } }),
        ]);
        return { waiting, active, delayed, completed, failed };
      }
    }

    /**
     * Compiles workflow execution metrics.
     */
    public static async getWorkflowStats(): Promise<WorkflowStats> {
      const [total, running, completed, failed, repoMetrics] = await Promise.all([
        prisma.workflow.count(),
        prisma.workflow.count({ where: { status: 'RUNNING' } }),
        prisma.workflow.count({ where: { status: 'COMPLETED' } }),
        prisma.workflow.count({ where: { status: 'FAILED' } }),
        workflowRepository.getMetrics(),
      ]);

      return {
        totalWorkflows: total,
        runningWorkflows: running,
        completedWorkflows: completed,
        failedWorkflows: failed,
        successRate: repoMetrics.successRate,
        averageDurationMs: repoMetrics.averageDuration,
      };
    }

    /**
     * Evaluates active background worker statistics.
     */
    public static async getWorkerStats(): Promise<WorkerStats[]> {
      const health = WorkerHealthTracker.getInstance().getHealthData();
      const memory = process.memoryUsage();
      const cpu = process.cpuUsage();

      return [
        {
          workerId: health.workerId,
          uptime: health.uptime,
          processedJobs: health.metrics.totalProcessed,
          currentJobId: health.currentJobId || undefined,
          memoryUsage: {
            rss: memory.rss,
            heapTotal: memory.heapTotal,
            heapUsed: memory.heapUsed,
            external: memory.external,
          },
          cpuTime: cpu.user + cpu.system,
        },
      ];
    }
  }
