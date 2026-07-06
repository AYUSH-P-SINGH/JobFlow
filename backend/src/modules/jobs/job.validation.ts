import { z } from 'zod';
import { JobStatus, JobPriority } from './job.types.js';

export const createJobSchema = z.object({
  body: z.object({
    title: z.string().min(1, 'Title is required'),
    description: z.string().nullable().optional(),
    type: z.string().min(1, 'Type is required'),
    priority: z.nativeEnum(JobPriority).optional(),
    payload: z.record(z.string(), z.any()),
  }),
});

export const updateJobSchema = z.object({
  body: z.object({
    title: z.string().min(1, 'Title cannot be empty').optional(),
    description: z.string().nullable().optional(),
    priority: z.nativeEnum(JobPriority).optional(),
  }).strict(),
});

export const queryJobsSchema = z.object({
  query: z.object({
    page: z.string().optional().transform((val) => (val ? parseInt(val, 10) : 1)),
    limit: z.string().optional().transform((val) => (val ? parseInt(val, 10) : 10)),
    status: z.nativeEnum(JobStatus).optional(),
    priority: z.nativeEnum(JobPriority).optional(),
    type: z.string().optional(),
    startDate: z.string().optional().refine(val => !val || !isNaN(Date.parse(val)), { message: 'Invalid start date format' }).transform(val => val ? new Date(val) : undefined),
    endDate: z.string().optional().refine(val => !val || !isNaN(Date.parse(val)), { message: 'Invalid end date format' }).transform(val => val ? new Date(val) : undefined),
    sortBy: z.string().optional(),
    sortOrder: z.enum(['asc', 'desc']).optional(),
  }),
});

export const jobIdParamSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid job ID format'),
  }),
});
