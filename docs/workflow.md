# Workflow Orchestration Engine Architecture

JobFlow supports multi-step workflow execution, enabling users to submit complex Directed Acyclic Graph (DAG) pipelines containing sequential, parallel, and conditional tasks.

---

## 1. Architecture Design

The Workflow Orchestration Engine works in coordination with the database (PostgreSQL + Prisma ORM) and the distributed queue (BullMQ + Redis):

```text
                     Client Request
                           │
                           ▼
                   Workflow API Router
                           │
                 PostgreSQL (Database)
                           │
                           ▼
                  Workflow Engine (Tick)
                           │
         ┌─────────────────┴─────────────────┐
         ▼                                   ▼
Dependency Resolver                 Step Scheduler
 (DAG & Conditions)                (Enqueue Step Jobs)
         │                                   │
         └─────────────────┬─────────────────┘
                           ▼
                    BullMQ Queue
                           │
                           ▼
                        Workers
                           │
                           ▼
               Worker Execution Callback
                           │
                           ▼
                  Update Step & WF State
```

### Components
1. **Workflow API**: REST endpoints to create, cancel, list, retry, and check status/metrics of workflows.
2. **Workflow Engine**: Evaluates state on a tick-based traversal. Determines when to transition workflow statuses.
3. **Dependency Resolver**: Exposes DAG validation (detects circular/duplicate dependencies) and finds pending steps whose parent tasks are completed. Evaluates conditions for conditional branching.
4. **Step Scheduler**: Takes eligible steps, creates a PostgreSQL Job record, enqueues the job into BullMQ, and transitions the step to `RUNNING`.
5. **Execution Callback**: When a background job completes or fails, workers notify `WorkflowEngine` to tick and proceed with downstream steps.

---

## 2. State Machine

Workflows and Steps both use the `WorkflowStatus` state machine:

```text
       ┌───────────┐
       │  PENDING  │
       └─────┬─────┘
             │ (Starts/Schedules)
             ▼
       ┌───────────┐
 ┌────►│  RUNNING  ├─────┐
 │     └─────┬─────┘     │
 │           │           │
 │ (Retry)   │ (Success) │ (Failure / Cancel)
 │           ▼           ▼
 │     ┌───────────┐ ┌───────────┐
 └─────┤  FAILED   │ │ COMPLETED │
 │     └───────────┘ └───────────┘
 │           ▲
 │ (Retry)   │ (Cancel)
 └───────────┴───────────┐
                         ▼
                   ┌───────────┐
                   │ CANCELLED │
                   └───────────┘
```

### Allowed Transitions
* **PENDING** ➡️ **RUNNING** / **CANCELLED**
* **RUNNING** ➡️ **COMPLETED** / **FAILED** / **CANCELLED**
* **FAILED** ➡️ **PENDING** (Reset for retry)
* **CANCELLED** ➡️ **PENDING** (Reset for retry)

---

## 3. Parallel & Conditional Branching

### Parallel Execution
When a step has multiple child steps that do not depend on each other (e.g. A ➡️ B and A ➡️ C), completing step A makes both B and C eligible. The engine resolves dependencies and schedules all eligible steps simultaneously.

### Conditional Branching
Steps can define an optional `condition` string inside their payload:
* Syntax: `"steps.<parentStepId>.status === 'COMPLETED'"` or `"steps.<parentStepId>.result.<field> === <value>"`
* If the condition evaluates to `false`, the step transitions directly to `CANCELLED` (skipped), and the engine recursively cascades cancellation to all downstream steps that depend on it.

---

## 4. API Reference

### POST `/api/v1/workflows`
Submit a new workflow definition.
* **Request Body**:
  ```json
  {
    "name": "CSV Import Pipeline",
    "steps": [
      {
        "stepId": "upload",
        "jobType": "IMAGE",
        "priority": "HIGH",
        "payload": { "imageUrl": "https://storage.com/raw.jpg", "operation": "grayscale" },
        "dependsOn": []
      },
      {
        "stepId": "validate",
        "jobType": "REPORT",
        "payload": { "reportType": "csv-check", "format": "csv" },
        "dependsOn": ["upload"]
      }
    ]
  }
  ```

### PATCH `/api/v1/workflows/:id/cancel`
Terminates a pending/running workflow. Removes all pending steps from the BullMQ queue and marks them as `CANCELLED`.

### POST `/api/v1/workflows/:id/retry`
Retries a failed or cancelled workflow. Only failed/cancelled steps are reset to `PENDING` and re-run. Already completed steps are bypassed.

### GET `/api/v1/workflows/metrics`
Retrieves orchestration metrics: active workflows, failed counts, success rate, and average duration.
