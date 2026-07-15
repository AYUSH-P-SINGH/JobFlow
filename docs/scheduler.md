# Intelligent Scheduler

## Overview

The Intelligent Scheduler replaces BullMQ's random job assignment with capability-aware, load-balanced job routing. It understands worker capabilities and routes jobs to the most suitable worker via specialized queues.

## How It Works

```
Workflow Step (jobType: "IMAGE")
         │
         ▼
Intelligent Scheduler
         │
    ┌────┴────┐
    │ Step 1  │ Find capable workers from Worker Registry
    │         │ → Workers supporting "IMAGE"
    ├─────────┤
    │ Step 2  │ Apply scheduling policy
    │         │ → Least loaded, round robin, etc.
    ├─────────┤
    │ Step 3  │ Determine target queue
    │         │ → "image-processing"
    ├─────────┤
    │ Step 4  │ Enqueue job to specialized queue
    │         │ → Only IMAGE workers consume this queue
    └─────────┘
```

## Scheduling Policies

Configure via the `SCHEDULER_POLICY` environment variable:

| Policy             | Behavior                                                |
|--------------------|---------------------------------------------------------|
| `LEAST_LOADED`     | Select worker with lowest `currentLoad`. Tie-break by `runningJobs`. |
| `ROUND_ROBIN`      | Rotate through available workers in order.              |
| `CAPABILITY_MATCH` | **(Default)** Filter by capability, then select least loaded. |
| `RANDOM`           | Random selection from capable workers.                  |
| `PRIORITY`         | Prefer workers tagged with "priority", then least loaded. |

## Queue Partitioning

Jobs are routed to specialized queues based on type:

| Job Type       | Queue Name               |
|----------------|--------------------------|
| EMAIL          | `email-processing`       |
| PDF            | `pdf-processing`         |
| IMAGE          | `image-processing`       |
| AI             | `ai-processing`          |
| REPORT         | `report-processing`      |
| NOTIFICATION   | `notification-processing` |
| VIDEO          | `video-processing`       |
| *(unknown)*    | `job-processing`         |

Workers subscribe only to queues matching their `WORKER_SUPPORTED_JOBS`.

## Fallback Behavior

When no specialized workers are registered for a job type, the scheduler falls back to the default `job-processing` queue. This ensures backward compatibility — existing workers without `WORKER_SUPPORTED_JOBS` configured will continue processing all jobs.

## Integration Points

### Workflow Engine
The `WorkflowScheduler.scheduleStep()` method consults the Intelligent Scheduler before enqueuing each workflow step.

### Direct Job Submission
Jobs submitted via `POST /api/v1/jobs` currently use the standard `EnqueueService`. The intelligent scheduler is invoked during workflow execution.

## Metrics

The scheduler exposes these metrics:

- **Total Assignments** — Number of jobs routed to specialized workers
- **Total Fallbacks** — Number of jobs routed to the default queue
- **Average Assignment Latency** — Time taken to select a worker (ms)
- **Worker Counts** — Breakdown by status (READY, BUSY, OFFLINE, etc.)

Access via `GET /api/v1/workers/metrics`.
