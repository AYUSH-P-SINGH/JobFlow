import { Workflow, Job } from '@prisma/client';

export type WorkflowEventPayload = {
  workflow: Workflow;
  correlationId?: string;
  error?: any;
};

export type JobEventPayload = {
  job: Job;
  correlationId?: string;
  progress?: number;
  result?: any;
  error?: any;
};

export type WorkerStatsPayload = {
  workerId: string;
  stats: {
    cpuTime?: number;
    memory?: {
      rss: number;
      heapTotal: number;
      heapUsed: number;
      external: number;
    };
    uptime: number;
    processedJobs: number;
    currentJobId?: string;
  };
  correlationId?: string;
};

// Phase 16: Worker lifecycle event payloads
export type WorkerRegisteredPayload = {
  workerId: string;
  hostname: string;
  supportedJobs: string[];
};

export type WorkerHeartbeatPayload = {
  workerId: string;
  runningJobs: number;
  currentLoad: number;
};

export type WorkerOfflinePayload = {
  workerId: string;
  reason: string;
};

export type WorkerDrainedPayload = {
  workerId: string;
  reason: string;
};

export interface EventMap {
  'workflow.started': WorkflowEventPayload;
  'workflow.updated': WorkflowEventPayload;
  'workflow.completed': WorkflowEventPayload;
  'workflow.failed': WorkflowEventPayload;
  'workflow.cancelled': WorkflowEventPayload;

  'job.started': JobEventPayload;
  'job.progress': JobEventPayload;
  'job.completed': JobEventPayload;
  'job.failed': JobEventPayload;
  'job.cancelled': JobEventPayload;

  'worker.stats_reported': WorkerStatsPayload;

  // Phase 16: Worker lifecycle events
  'worker.registered': WorkerRegisteredPayload;
  'worker.heartbeat': WorkerHeartbeatPayload;
  'worker.offline': WorkerOfflinePayload;
  'worker.drained': WorkerDrainedPayload;
}

export type EventType = keyof EventMap;
export type EventPayload<T extends EventType> = EventMap[T];
