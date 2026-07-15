import { z } from 'zod';

/**
 * Validation schema for worker registration.
 */
export const registerWorkerSchema = z.object({
  hostname: z.string().min(1, 'Hostname is required'),
  port: z.number().int().positive().optional().default(5001),
  region: z.string().optional().default('default'),
  tags: z.array(z.string()).optional().default([]),
  cpu: z.number().int().positive().optional().default(1),
  memory: z.number().int().positive().optional().default(512),
  gpu: z.boolean().optional().default(false),
  supportedJobs: z.array(z.string()).optional().default([]),
  concurrency: z.number().int().positive().optional().default(5),
  queueName: z.string().optional(),
});

export type RegisterWorkerDTO = z.infer<typeof registerWorkerSchema>;

/**
 * Validation schema for worker heartbeat updates.
 */
export const heartbeatSchema = z.object({
  runningJobs: z.number().int().min(0).optional(),
  completedJobs: z.number().int().min(0).optional(),
  failedJobs: z.number().int().min(0).optional(),
  currentLoad: z.number().min(0).max(1).optional(),
});

export type HeartbeatDTO = z.infer<typeof heartbeatSchema>;

/**
 * Validation schema for worker drain request.
 */
export const drainWorkerSchema = z.object({
  reason: z.string().optional().default('Manual drain requested'),
});

export type DrainWorkerDTO = z.infer<typeof drainWorkerSchema>;
