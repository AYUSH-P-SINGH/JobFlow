export interface DashboardStats {
  workers: number;
  runningJobs: number;
  completedToday: number;
  failedToday: number;
}

export interface QueueStats {
  waiting: number;
  active: number;
  delayed: number;
  completed: number;
  failed: number;
}

export interface WorkflowStats {
  totalWorkflows: number;
  runningWorkflows: number;
  completedWorkflows: number;
  failedWorkflows: number;
  successRate: number;
  averageDurationMs: number;
}

export interface WorkerStats {
  workerId: string;
  uptime: number;
  processedJobs: number;
  currentJobId?: string;
  memoryUsage: {
    rss: number;
    heapTotal: number;
    heapUsed: number;
    external: number;
  };
  cpuTime?: number;
}
