# JobFlow 🚀

Distributed Workflow Orchestration & Job Queue Platform (BullMQ + Redis + PostgreSQL)

JobFlow is a high-performance distributed task processing and workflow orchestration platform. It is designed to coordinate complex multi-step jobs represented as Directed Acyclic Graphs (DAGs) with sequential, parallel, and conditional execution paths, complete with persistent state logs, retry backoff policies, distributed worker scaling, and real-time observability.

---

## 🗺️ Project State: Phase 14 Completed

JobFlow has evolved into a production-grade distributed orchestration platform:
* **Workflow Orchestration Engine (Phase 13)**: Coordinates complex Directed Acyclic Graph (DAG) pipelines containing sequential, parallel, and conditional execution paths.
  * Details: [Engine Architecture](docs/workflow-engine.md) | [State Machine Lifecycle](docs/workflow-lifecycle.md) | [DAG Dependency Resolution](docs/dependency-resolution.md) | [Performance Profile](docs/performance.md)
* **Real-Time Dashboard & Event Streaming (Phase 14)**: Socket.IO server utilizing JWT authentication. Separates connections into personal user rooms (`room:user:<id>`), detailed workflow timeline rooms (`room:workflow:<id>`), and system operator rooms (`room:admins`). Automatically replays cached events upon reconnection and throttles progress updates to 200ms. Includes REST endpoints for operational analytics.
  * Details: [Socket Gateway Architecture](docs/socket-architecture.md) | [Event Stream Pipeline](docs/event-flow.md) | [Dashboard API Reference](docs/dashboard-api.md)
* **Persistent Notifications (Phase 8)**: Database-backed system alerts categorizing failures, retries, and completions. Exposes list, mark read, and delete endpoints.
* **System Audit Logging (Phase 8)**: Tracks administrative actions (e.g. creations, retries, cancellations, logins, worker check-ins) across users and resources. Exposes operator queries.
* **Chronological Timelines (Phase 8)**: Aggregates workflow history logs into sequence timelines.
* **Prometheus Metrics (Phase 8)**: Exposes a standard scrapable `/metrics` endpoint with queue size gauges, total completed/failed counters, and worker utilization gauges.
* **Distributed Tracing (Phase 8)**: Injects and extracts `X-Correlation-ID` headers using `AsyncLocalStorage` to trace requests across the logging layer, queue payloads, and worker processing execution contexts.

---

## 🛠️ Tech Stack

* **Runtime:** Node.js (v20+)
* **Framework:** Express.js (v4)
* **Language:** TypeScript
* **Database:** PostgreSQL (v15+)
* **ORM:** Prisma ORM (v5)
* **Queue Engine:** BullMQ & Redis
* **WebSockets:** Socket.IO
* **Metrics:** prom-client (Prometheus Exporter)
* **Logger:** Winston (Prepend Correlation IDs)
* **API Validation:** Zod
* **Authentication:** JWT & Bcrypt
* **Testing:** Native Node.js Test Runner & Supertest

---

## 📂 Project Directory Structure

```text
jobflow/
├── backend/
│   ├── prisma/
│   │   ├── schema.prisma    # Database definitions (User, Job, Workflow, Notifications, AuditLog)
│   │   └── migrations/      # SQL migration files
│   ├── src/
│   │   ├── config/          # Environment configurations (Redis, environment variables)
│   │   ├── common/          # Shared operational layers
│   │   │   ├── errors/      # Standard HTTP client/server errors
│   │   │   ├── logger/      # Winston logger configuration
│   │   │   ├── middleware/  # Express middlewares (auth, validation, tracing)
│   │   │   └── tracing/     # AsyncLocalStorage distributed trace context
│   │   ├── events/          # In-process type-safe Event Bus
│   │   ├── socket/          # WebSocket (Socket.IO) server & gateway
│   │   ├── queues/          # BullMQ queue definitions & handlers
│   │   ├── workers/         # Base worker process & lifecycle managers
│   │   ├── modules/         # Domain-driven features
│   │   │   ├── auth/        # JWT Authentication & authorization
│   │   │   ├── jobs/        # CRUD Job management & execution services
│   │   │   ├── workflow/    # DAG engine, dependency resolver, scheduler & templates
│   │   │   └── monitoring/  # Metrics, audit logs, timelines, & Prometheus services
│   │   ├── app.ts           # Configured Express application instance
│   │   └── server.ts        # HTTP listener, Socket.IO & Graceful Shutdown script
│   │   └── worker.ts        # Independent worker background process entrypoint
│   ├── package.json         # Build scripts & dependencies manager
│   ├── tsconfig.json        # TypeScript compiler configurations
│   └── README.md            # Backend instructions
├── docs/                    # Architecture diagrams & guides (observability.md, workflow.md)
├── docker-compose.yml       # Dev Redis & PostgreSQL containers setup
└── README.md                # Global documentation file (This file)
```

---

## 🚀 How to Run JobFlow Locally

### Prerequisites
Make sure you have [Node.js](https://nodejs.org/), [Docker Desktop](https://www.docker.com/), and [Git](https://git-scm.com/) installed.

### Installation

1. Navigate to the repository workspace:
   ```bash
   cd JOBFLOW
   ```

2. Go to the `backend` folder:
   ```bash
   cd backend
   ```

3. Install dependencies (installs development socket client, Prometheus tools, BullMQ, and core libraries):
   ```bash
   npm install
   ```

4. Spin up the localized PostgreSQL and Redis containers:
   ```bash
   docker compose up -d
   ```

5. Push the database schema configurations and generate Prisma clients:
   ```bash
   npx prisma db push
   ```

6. Seed default users and templates:
   ```bash
   npx prisma db seed
   ```

---

### Running the Platform

#### Running in Development Mode
Starts the Express API Web Server with live-reloads:
```bash
npm run dev
```

Starts the Background Worker Consumer process with live-reloads:
```bash
npm run worker:dev
```

#### Running in Production Mode
Compile the TypeScript files to JS:
```bash
npm run build
```

Run the compiled web server:
```bash
npm run start
```

Run the compiled worker process:
```bash
npm run worker
```

---

### Running the Test Suite
JobFlow includes a comprehensive integration test suite verifying authentication, job queues, workers retry handling, DAG workflow scheduling, Socket.IO gateway rooms, trace propagation, notifications, audit logs, and metrics scraping:
```bash
npm run test
```

---

## 🛣️ API Endpoints Reference

### 🔐 Authentication & Session
* `POST /api/v1/auth/register` — Create a user.
* `POST /api/v1/auth/login` — Returns access & refresh token.
* `POST /api/v1/auth/refresh` — Rotation of session keys.
* `GET /api/v1/auth/me` — Fetches current authenticated payload.

### 💼 Job Operations
* `POST /api/v1/jobs` — Enqueue a new stand-alone job.
* `GET /api/v1/jobs` — Lists user-enqueued jobs.
* `GET /api/v1/jobs/:id` — Retrives details and runtime progress percentage.
* `POST /api/v1/jobs/:id/cancel` — Cancels a running/queued job.

### ⛓️ Workflow Orchestration
* `POST /api/v1/workflows` — Instantiates a new workflow (sequential or parallel execution graph).
* `GET /api/v1/workflows` — Lists user workflows.
* `GET /api/v1/workflows/:id` — Retrieves current workflow details.
* `POST /api/v1/workflows/:id/cancel` — Stops execution and cancels downstream paths.
* `POST /api/v1/workflows/:id/retry` — Resumes execution of failed steps.
* `GET /api/v1/workflows/templates` — Lists predefined DAG campaigns.
* `GET /api/v1/workflows/metrics` — Aggregate workflow performance (durations, success rates).

### 🔔 Live Notifications
* `GET /api/v1/notifications` — Paginated user alerts.
* `PATCH /api/v1/notifications/:id/read` — Marks notification as read.
* `DELETE /api/v1/notifications/:id` — Removes notification.

### 📊 Observability & System Exporters
* `GET /metrics` — Exposes Prometheus format metrics scraper registry.
* `GET /api/v1/monitoring/dashboard` — General summary statistics (restricted to `ADMIN`).
* `GET /api/v1/monitoring/queues` — Retrieves active/waiting counts in BullMQ (restricted to `ADMIN`).
* `GET /api/v1/monitoring/workflows` — Overall platform execution metrics (restricted to `ADMIN`).
* `GET /api/v1/monitoring/workers` — Worker check-in status, uptime, CPU and memory usage (restricted to `ADMIN`).
* `GET /api/v1/monitoring/logs` — Query security and operations audit logs (restricted to `ADMIN`).
* `GET /api/v1/monitoring/workflows/:id/timeline` — Sequential execution updates for steps.
