import { JobPriority } from '@prisma/client';

/**
 * Centralized queue name constants.
 * Every queue in the system must be registered here to avoid hardcoded strings.
 */
export enum QueueNames {
  JOB_QUEUE = 'job-processing',
  EMAIL_QUEUE = 'email',
  WORKFLOW_QUEUE = 'workflow',
  SCHEDULER_QUEUE = 'scheduler',
}

/**
 * Maps application-level JobPriority to BullMQ numeric priority.
 * Lower number = higher priority in BullMQ.
 */
export const PriorityMap: Record<JobPriority, number> = {
  [JobPriority.CRITICAL]: 1,
  [JobPriority.HIGH]: 2,
  [JobPriority.MEDIUM]: 5,
  [JobPriority.LOW]: 10,
};
