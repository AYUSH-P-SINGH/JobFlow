# Real-Time Event Stream Pipeline

JobFlow decouples the worker execution nodes from the client-facing WebSocket server by utilizing an in-process, asynchronous **Event Bus**.

---

## 1. Publish/Subscribe Pipeline

The execution engine and workers never import Socket.IO or know about WebSockets. They simply publish lifecycle events to the central `eventBus`. The `SocketGateway` subscribes to these events and translates them to client broadcasts.

```text
  +------------------+
  |  Worker Node /   |
  | Execution Engine |
  +--------+---------+
           │
           ▼ (Publish Event)
  +--------+---------+
  |    Event Bus     |
  +--------+---------+
           │
           ▼ (Trigger Subscriptions)
  +--------+---------+
  |  SocketGateway   |
  +--------+---------+
           │
           ▼ (Route by Tenant/Workflow Room)
  +--------+---------+
  |  Socket Rooms    |
  +--------+---------+
           │
           ▼ (Stream over WebSockets)
  +--------+---------+
  |  React Dashboard |
  +------------------+
```

---

## 2. Event Catalogs

### Workflow Events
Streamed to the owner's user room (`room:user:<userId>`) and the workflow's track room (`room:workflow:<workflowId>`):

- **`workflow.started`**: Emitted when a workflow transitions from `PENDING` to `RUNNING`.
- **`workflow.updated`**: Emitted on execution progress changes or status alterations. Includes progress percentage and current active step name.
- **`workflow.completed`**: Emitted when all DAG steps complete successfully.
- **`workflow.failed`**: Emitted when a step execution fails and halts downstream paths.
- **`workflow.cancelled`**: Emitted upon explicit cancellation requests.

### Job Events
Streamed to the workflow details room (`room:workflow:<workflowId>`) and the administrator room (`room:admins`):

- **`job.queued`**: Job has been registered in the database and enqueued in BullMQ.
- **`job.started`**: Worker has picked up the job and started handler execution.
- **`job.progress`**: Job progress callback updates (e.g. `20%`, `40%`).
- **`job.completed`**: Worker handler complete.
- **`job.failed`**: Handler threw an execution exception or failed validation.

---

## 3. High-Frequency Throttling

To prevent high-frequency tasks (e.g. loops or batch processing steps) from overloading client browsers with socket packets, JobFlow implements sliding-window throttling for job progress events inside `SocketGateway.ts`:
- **Rules**: Progress events (`job.progress`) are limited to **a maximum of 1 emit per 200ms** per job ID.
- **Implementation**: The gateway checks the `throttleMap` timestamps on every progress message. If the elapsed time is less than 200ms, the event is silently dropped for WebSockets (while the database remains updated with the true progress).
