/**
 * Phase 16 — Worker Management Constants
 * Centralized configuration for worker registration, heartbeats, and scheduling.
 */

/** Interval in milliseconds between heartbeat pings (30 seconds) */
export const HEARTBEAT_INTERVAL_MS = 30_000;

/** If no heartbeat is received within this window, mark worker OFFLINE (90 seconds) */
export const HEARTBEAT_OFFLINE_THRESHOLD_MS = 90_000;

/** How often the discovery service checks for stale workers (30 seconds) */
export const DISCOVERY_SCAN_INTERVAL_MS = 30_000;

/** Default worker concurrency if not specified */
export const DEFAULT_WORKER_CONCURRENCY = 5;

/** Scheduling policies for the intelligent scheduler */
export enum SchedulerPolicy {
  LEAST_LOADED = 'LEAST_LOADED',
  ROUND_ROBIN = 'ROUND_ROBIN',
  CAPABILITY_MATCH = 'CAPABILITY_MATCH',
  RANDOM = 'RANDOM',
  PRIORITY = 'PRIORITY',
}

/** Default scheduling policy */
export const DEFAULT_SCHEDULER_POLICY: SchedulerPolicy =
  (process.env.SCHEDULER_POLICY as SchedulerPolicy) || SchedulerPolicy.CAPABILITY_MATCH;

/** Worker status lifecycle values (mirrors Prisma enum) */
export enum WorkerStatusValue {
  STARTING = 'STARTING',
  READY = 'READY',
  BUSY = 'BUSY',
  DRAINING = 'DRAINING',
  OFFLINE = 'OFFLINE',
}

/** Statuses that are eligible to receive new jobs */
export const ASSIGNABLE_STATUSES: WorkerStatusValue[] = [
  WorkerStatusValue.READY,
];

/** All known built-in job types for capability matching */
export const KNOWN_JOB_TYPES = [
  'EMAIL',
  'REPORT',
  'NOTIFICATION',
  'IMAGE',
  'PDF',
  'AI',
  'VIDEO',
] as const;

export type KnownJobType = (typeof KNOWN_JOB_TYPES)[number];
