# Real-Time Monitoring, Notifications & Observability Architecture

JobFlow features a production-grade observability suite that enables real-time system tracking, active user notifications, administrative audit logging, chronological execution timelines, Prometheus statistics scraping, and end-to-end distributed tracing.

---

## 1. Event-Driven Observability Pipeline

Observability is entirely decoupled from business logic using an in-process, type-safe **Event Bus** wrapper over Node.js's native `EventEmitter`.

```text
Worker Execution / API Router
            │
            ▼ (Publish Event)
       Event Bus 
            │
      ┌─────┼─────────────────────────────────┐
      ▼     ▼                                 ▼
  Socket.IO Gateway              Notifications Service         Audit Logging Service
(Real-Time Broadcast)           (Persistent User Alerts)     (Operator Log Recording)
```

* **Event Bus (`event.bus.ts`)**: Implements type-safe `.publish()` and `.subscribe()` methods to broadcast events platform-wide.
* **Event Publisher (`event.publisher.ts`)**: Utility methods to publish workflow and job status updates while automatically carrying tracing correlation IDs.

---

## 2. Distributed Tracing & Correlation IDs

Every user request or triggered background job runs under a unified tracking identifier (**Correlation ID**) to support end-to-end tracing.

1. **API Entry**: If an incoming REST request contains an `X-Correlation-ID` header, it is reused; otherwise, a unique UUID is generated via `crypto.randomUUID()`.
2. **Context Propagation (`context.ts`)**: Leverages Node's `AsyncLocalStorage` to store the active correlation ID for the duration of the request execution context.
3. **Log Interception (`logger.ts`)**: Winston logs automatically fetch the active correlation ID from context and prepend it in the format `[CID: <uuid>]`.
4. **Distributed Queue Propagation**: When jobs are added to BullMQ, the correlation ID is packaged into the minimal queue payload.
5. **Background Execution**: Workers read the correlation ID from the queue message and spawn the job executor handler inside a fresh `AsyncLocalStorage` tracing context.

---

## 3. Socket.IO Gateway & Real-Time Broadcast

Real-time streaming uses `Socket.IO` bound to the core HTTP server.

### Authentication & Security
Anonymous sockets are strictly forbidden. The connection handler uses a custom middleware (`socket.middleware.ts`) that extracts a JWT access token, validates it against the database, and attaches the authenticated user's ID and role to the socket instance.

### WebSocket Rooms
Sockets are routed into specific rooms to guarantee strict multi-tenant isolation and optimal messaging overhead:
* `room:user:<userId>`: Personal room for each user. Streams live workflow progress updates and user notifications.
* `room:workflow:<workflowId>`: Room for specific workflows. Streams detailed job step progress and step-specific completion/failure logs.
* `room:admins`: Operational room for `ADMIN` users. Streams all background job metrics, worker details, and system audit logs.

### Throttling & Replay
* **Event Throttling**: Performance progress updates (e.g. `job.progress`) are rate-limited to a maximum of one message every 200ms per job.
* **Event Replay**: The gateway caches the last 20 events for active workflows in an in-memory ring-buffer. When a client reconnects and joins a workflow room, these events are automatically replayed in order to sync the client UI.

---

## 4. Notifications & Persistent Alerts

User notifications are stored in PostgreSQL under the `Notification` model with the following categories:
* **SUCCESS**: Emitted upon successful workflow completions.
* **WARNING**: Emitted upon workflow step failures that trigger retries or stand-alone job errors.
* **ERROR**: Emitted upon terminal workflow failures.
* **INFO**: Informational system alerts.

### REST Endpoints
* `GET /api/v1/notifications`: Paginated list of read or unread user notifications.
* `PATCH /api/v1/notifications/:id/read`: Mark a specific notification as read.
* `DELETE /api/v1/notifications/:id`: Delete a notification.

---

## 5. Audit Logs & Activity Timelines

### System Audits
The `AuditLog` model logs all administrative and operator actions:
* Action types: `Workflow Created`, `Workflow Started`, `Workflow Cancelled`, `Workflow Retried`, `Job Cancelled`, `Admin Login`, `Worker Started`.
* Logs contain: `actor` (user ID or "system"), `action`, `resource` (`Workflow`, `Job`, `User`), and a `metadata` JSON payload.
* Search API: `GET /api/v1/monitoring/logs` (admin restricted).

### Chronological Timelines
The `ActivityService` aggregates chronological workflow histories and execution steps into a clean timeline:
* API endpoint: `GET /api/v1/monitoring/workflows/:id/timeline` (returns timestamped records such as Step Started ➡️ Progress Updates ➡️ Step Completed).

---

## 6. Dashboard & Prometheus Metrics

### Dashboard Statistics
Exposed under `GET /api/v1/monitoring/dashboard` to retrieve:
* Total active worker count.
* Number of currently running jobs.
* Cumulative count of completed and failed jobs today.

### Queue, Workflow & Worker Statistics
* **Queue Stats**: `GET /api/v1/monitoring/queues` (returns active, waiting, delayed, completed, and failed job counts in BullMQ).
* **Workflow Stats**: `GET /api/v1/monitoring/workflows` (returns overall workflow counts, average duration, and execution success rate).
* **Worker Stats**: `GET /api/v1/monitoring/workers` (returns worker uptime, processed jobs, active job ID, and memory/CPU usage).

### Prometheus Scraper (`/metrics`)
A Prometheus-compatible metrics exporter is exposed at `GET /metrics`. It exports standard Node.js runtime metrics alongside custom metrics:
* `jobflow_jobs_completed_total` (counter, labeled by `type`)
* `jobflow_jobs_failed_total` (counter, labeled by `type`)
* `jobflow_queue_size` (gauge, labeled by `status`)
* `worker_memory_usage` (gauge, labeled by `workerId`)
