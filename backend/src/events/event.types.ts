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
}

export type EventType = keyof EventMap;
export type EventPayload<T extends EventType> = EventMap[T];
