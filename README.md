# JobFlow ⚡

<div align="center">

![JobFlow Banner](https://raw.githubusercontent.com/AYUSH-P-SINGH/JobFlow/main/docs/assets/banner.png)

**Distributed Workflow Orchestration, Task Queue & Intelligent Worker Fleet Platform**

[![Node.js](https://img.shields.io/badge/Node.js-v20%2B-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-v5.4%2B-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-v18%2Fv19-61DAFB?logo=react&logoColor=black)](https://reactjs.org/)
[![BullMQ](https://img.shields.io/badge/BullMQ-v5.79%2B-FF4438?logo=redis&logoColor=white)](https://bullmq.io/)
[![Redis](https://img.shields.io/badge/Redis-v7.0%2B-DC382D?logo=redis&logoColor=white)](https://redis.io/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-v16-4169E1?logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![Prisma](https://img.shields.io/badge/Prisma-v5.14-2D3748?logo=prisma&logoColor=white)](https://www.prisma.io/)
[![Docker](https://img.shields.io/badge/Docker-Ready-2496ED?logo=docker&logoColor=white)](https://www.docker.com/)
[![Kubernetes](https://img.shields.io/badge/Kubernetes-Ready-326CE5?logo=kubernetes&logoColor=white)](https://kubernetes.io/)
[![License](https://img.shields.io/badge/License-ISC-blue.svg)](LICENSE)

[Features](#-key-features) • [Architecture](#-architecture--data-flow) • [Tech Stack](#-technology-stack) • [Quick Start](#-quick-start) • [UI Dashboard](#-visual-web-dashboard) • [CLI & SDK](#-developer-tooling-cli--sdks) • [API & GraphQL](#-api-endpoints--graphql) • [Observability](#-production-observability--telemetry) • [Deployment](#-deployment--production-operations) • [Testing](#-testing-load--chaos-engineering)

</div>

---

## 📖 Overview

**JobFlow** is a modern, high-throughput distributed task processing and workflow orchestration platform. It is engineered to coordinate complex, multi-step jobs structured as **Directed Acyclic Graphs (DAGs)** with sequential execution paths, parallel fan-outs/fan-ins, dynamic condition branching, checkpoint state recovery, and distributed worker capacity load balancing.

Equipped with a **React 18 / Vite** real-time management dashboard, **developer CLI (`jobflow`)**, **multi-language client SDKs**, and an end-to-end observability stack (**OpenTelemetry, Jaeger, Prometheus, Loki, Grafana, Bull-Board**), JobFlow delivers enterprise-grade reliability, fault-tolerance, and scale out of the box.

---

## 🌟 Key Features

### 🔀 Resilient DAG Workflow Engine
- **Directed Acyclic Graph (DAG) Execution**: Coordinate multi-stage task pipelines with parallel, sequential, and conditional branching.
- **Dynamic Dependency Resolution**: Real-time evaluation of parent task prerequisites and outputs before scheduling downstream steps.
- **Distributed Concurrency Locks**: Zero-race condition tick processing powered by distributed Redis locking (`lock:workflow:tick:<id>`).
- **State Checkpointing & Resumption**: Granular step checkpoints stored in PostgreSQL to instantly resume failed workflows without re-executing completed parent steps.
- **Cascading Cancellations**: Smart path pruning that automatically marks downstream dependent tasks as cancelled if upstream conditional branches fail or skip.
- **Dead-Letter Queue (DLQ) Replay**: Dead-letter job capture, analysis, and single-click replay for unhandled exceptions.

### 🤖 Intelligent Distributed Worker Management
- **Self-Registering Worker Nodes**: Dynamic worker discovery and registration with CPU core counts, RAM availability, and GPU capability flags.
- **Heartbeat Health Monitoring**: Periodic 30-second heartbeat checks that detect crashed workers and automatically redistribute in-flight jobs.
- **Load-Aware Routing**: Smart job dispatching based on real-time load utilization, round-robin, priority tiering, and specialized capability matching.
- **Graceful Draining**: Safe maintenance draining (`jobflow worker drain <id>`) ensuring active jobs finish before the worker goes offline.

### 🏢 Enterprise Multi-Tenancy & Governance
- **Strict Tenant Isolation**: Complete logical data partitioning across tenants, projects, API keys, workflows, and queues.
- **Role-Based Access Control (RBAC)**: Fine-grained access control across `ADMIN`, `OPERATOR`, and `USER` tiers.
- **Hashed API Key Authentication**: Cryptographically hashed API keys for programmatic automation and CLI integration.
- **Tenant Quotas & Policy Enforcement**: Configurable daily execution thresholds, max concurrent workflows, and business-hour runtime restrictions.
- **Comprehensive Audit Trails**: Structured audit logs capturing all user actions, state mutations, and system events.

### 📊 Modern Visual Dashboard (SPA)
- **Glassmorphic Slate Dark UI**: Sleek, high-performance web interface built with React 18, Vite, and custom CSS design tokens.
- **Interactive Visual DAG Builder**: Drag-and-drop canvas for constructing step topologies, payload structures, priorities, and dependency links.
- **Live BullMQ Queue Monitor**: Real-time inspection of active, waiting, completed, delayed, and failed task partitions.
- **Worker Fleet Inspector**: Live telemetry cards displaying CPU/memory utilization, load percentages, and active task assignments.
- **CSV Batch Ingestion Engine**: Schema validation and bulk workflow dispatching from CSV data with instant parsing reports.

### 🛠️ Developer Ecosystem & Multi-Language SDKs
- **Developer CLI (`jobflow`)**: Command-line tool for scaffolding templates, deploying pipelines, triggering runs, and managing worker nodes.
- **Multi-Language SDK Clients**: Ready-to-use client libraries for **TypeScript/Node.js**, **Python**, **Go**, and **Java**.
- **Coexisting GraphQL & REST APIs**: Flexible querying via unified `/graphql` gateway alongside standard versioned REST endpoints (`/api/v1/*`).
- **Extensible Plugin SDK & Marketplace**: Community plugin architecture allowing custom job handlers and reusable templates to be published and discovered.
- **AI-Powered Workflow Generator**: Convert natural language descriptions into valid, production-ready workflow JSON DSLs.
- **Dry-Run Simulator & Replay Debugger**: Deterministic step replay and offline DAG simulations to validate pipelines prior to deployment.

### 🔍 Full-Spectrum Production Observability
- **Distributed Tracing**: OpenTelemetry instrumentation with trace propagation across HTTP API, Redis queues, and worker execution spans (visualized via Jaeger).
- **Correlation ID Tracking**: Consistent correlation tracking across all layers via Node.js `AsyncLocalStorage` and Winston logger (`[CID: <uuid>]`).
- **Prometheus Metrics Scraper**: Native `/metrics` endpoint delivering custom gauges, counters, and histograms for queues, workflows, workers, and SLOs.
- **Loki & Promtail Log Aggregation**: Direct Winston logging transport streaming structured logs to Loki.
- **Bull-Board Queue UI**: Built-in queue management portal accessible at `/admin/queues`.
- **Real-Time WebSocket Streams**: Socket.IO event bus broadcasting live progress updates, step status changes, and operator alerts.

---

## 🏗️ Architecture & Data Flow

```
                                  ┌─────────────────────────────────────────┐
                                  │       Developers / Clients / Apps       │
                                  └────┬──────────────┬──────────────┬──────┘
                                       │              │              │
                           CLI Tool    │   React UI   │  Client SDKs │ (Python/Go/Java/TS)
                          (jobflow)    │  (Vite SPA)  │  & Webhooks  │
                                       ▼              ▼              ▼
                                  ┌─────────────────────────────────────────┐
                                  │      API Gateway / Ingress (Nginx)      │
                                  │     (Auth, Rate Limiting, Tracing)      │
                                  └───────────────────┬─────────────────────┘
                                                      │
                                                      ▼
                                  ┌─────────────────────────────────────────┐
                                  │        JobFlow Core API (Express)       │
                                  │  ┌──────────────┐      ┌─────────────┐  │
                                  │  │ REST / v1    │      │ GraphQL API │  │
                                  │  └──────┬───────┘      └──────┬──────┘  │
                                  │         │                     │         │
                                  │  ┌──────▼─────────────────────▼──────┐  │
                                  │  │      Workflow Engine & Tick       │  │
                                  │  │   (DAG Dependency Resolution)     │  │
                                  │  └──────┬─────────────────────┬──────┘  │
                                  └─────────┼─────────────────────┼─────────┘
                                            │                     │
                     Distributed Locks &    │                     │  Persistent State &
                     Queue Enqueueing       ▼                     ▼  Checkpoints
                                 ┌──────────────────┐     ┌──────────────────┐
                                 │     Redis 7      │     │  PostgreSQL 16   │
                                 │    (BullMQ)      │     │   (Prisma ORM)   │
                                 └─────────┬────────┘     └──────────────────┘
                                           │
                        Job Distribution   │ (Partitioned Queues)
                                           ▼
                 ┌─────────────────────────────────────────────────────────┐
                 │                Distributed Worker Fleet                 │
                 │                                                         │
                 │  ┌──────────────────┐  ┌──────────────────┐  ┌───────┐  │
                 │  │ Worker Node 1    │  │ Worker Node 2    │  │  ...  │  │
                 │  │ (HTTP, Data)     │  │ (AI, GPU, Video) │  │       │  │
                 │  └────────┬─────────┘  └────────┬─────────┘  └───────┘  │
                 └───────────┼─────────────────────┼───────────────────────┘
                             │                     │
                             └──────────┬──────────┘
                                        │ Status Callbacks & Heartbeats
                                        ▼
                 ┌─────────────────────────────────────────────────────────┐
                 │                   Observability Stack                   │
                 │                                                         │
                 │  ┌─────────────┐  ┌─────────────┐  ┌─────────────────┐  │
                 │  │ Prometheus  │  │ Grafana     │  │ Jaeger Tracing  │  │
                 │  │ (/metrics)  │  │ (Dashboards)│  │ (OTel Spans)    │  │
                 │  └─────────────┘  └─────────────┘  └─────────────────┘  │
                 │  ┌─────────────┐  ┌─────────────┐  ┌─────────────────┐  │
                 │  │ Loki / Tail │  │ Bull-Board  │  │ Socket.IO Bus   │  │
                 │  │ (Logs)      │  │ (/admin)    │  │ (Live Events)   │  │
                 │  └─────────────┘  └─────────────┘  └─────────────────┘  │
                 └─────────────────────────────────────────────────────────┘
```

### 🔁 DAG Workflow Tick Execution Flow
1. **Client Submission**: Client posts a workflow DAG definition via REST, GraphQL, CLI, or UI.
2. **State Persistence**: Workflow and steps are saved in PostgreSQL as `PENDING`.
3. **Lock Acquisition**: Distributed Redis lock (`lock:workflow:tick:<id>`) is acquired to guarantee idempotent state evaluation.
4. **DAG Traversal**: `DependencyResolver` identifies all ready steps whose parent prerequisites are `COMPLETED` and conditions pass.
5. **Queue Dispatch**: `WorkflowScheduler` enqueues ready steps into BullMQ with OpenTelemetry tracing context attached.
6. **Worker Execution**: An eligible worker claims the job, runs the task logic, and reports execution status via callback.
7. **Recursive Evaluation**: The callback triggers the next engine tick to evaluate downstream dependent steps until terminal state (`COMPLETED` or `FAILED`).

---

## 🛠️ Technology Stack

| Layer | Technologies | Description |
|---|---|---|
| **Backend Core** | `Node.js 20+`, `Express.js 4`, `TypeScript 5.4` | High-performance modular REST & GraphQL server |
| **Queue & Scheduling** | `BullMQ 5.79`, `IORedis 5.11` | Partitioned Redis-backed distributed task queues & locks |
| **Database & ORM** | `PostgreSQL 16`, `Prisma ORM 5.14` | Relational state persistence, JSON step definitions & indexing |
| **Frontend SPA** | `React 18 / 19`, `Vite 8`, `TypeScript`, `CSS Tokens` | Glassmorphic dark-theme visual control panel |
| **Real-Time Streaming** | `Socket.IO 4.8` | Bi-directional WebSocket event bus with room multi-tenancy |
| **Distributed Tracing** | `OpenTelemetry SDK`, `Jaeger Tracing` | Distributed context propagation across API and Workers |
| **Metrics & Logs** | `Prometheus`, `Grafana`, `Loki`, `Promtail`, `Winston` | Comprehensive metric scrapers, dashboards, and structured logging |
| **Queue Admin UI** | `@bull-board/express` | Visual BullMQ job and queue inspector |
| **Developer Tools** | `@jobflow/cli`, `@jobflow/sdk-js` | Command line client, TypeScript SDK & code scaffolding |
| **Container & Cloud** | `Docker`, `Docker Compose`, `Kubernetes`, `Helm 3` | Production containerization, HPA auto-scaling, Helm charts |

---

## 📂 Project Directory Structure

```text
JobFlow/
├── backend/                        # Node.js + TypeScript Backend Service
│   ├── prisma/                     # Database schema and seed scripts
│   │   ├── schema.prisma           # Prisma PostgreSQL data models
│   │   └── migrations/             # Database migration history
│   ├── src/
│   │   ├── ai/                     # AI Natural Language Workflow Generator
│   │   ├── analytics/              # Aggregated tenant execution metrics
│   │   ├── common/                 # Winston logger, AsyncLocalStorage context, errors, middleware
│   │   ├── config/                 # Environment validation via Zod schemas
│   │   ├── debugger/               # Deterministic execution replay & timeline engine
│   │   ├── developer-portal/       # Interactive API playground & keys
│   │   ├── events/                 # Internal type-safe EventBus & publishers
│   │   ├── gateway/                # Rate limiting, correlation interceptor & security
│   │   ├── graphql/                # GraphQL Gateway & Resolvers
│   │   ├── marketplace/            # Plugin & Workflow Template Marketplace
│   │   ├── modules/
│   │   │   ├── auth/               # JWT authentication, passwords & RBAC
│   │   │   ├── chaos/              # Failure simulation & resilience testing
│   │   │   ├── feature-flags/      # Dynamic runtime feature flag engine
│   │   │   ├── governance/         # Policy engine & tenant quota enforcement
│   │   │   ├── jobs/               # Single job CRUD, execution and queueing
│   │   │   ├── monitoring/         # Dashboard metrics, Prometheus exporter & audit logs
│   │   │   ├── notifications/      # Persistent multi-channel notifications
│   │   │   ├── plugins/            # Plugin SDK lifecycle & custom step runners
│   │   │   ├── recovery/           # Automatic crash recovery & checkpoint restore
│   │   │   ├── scheduler/          # Cron-based recurring workflow schedules
│   │   │   ├── tenants/            # Multi-tenancy, projects & API key management
│   │   │   ├── webhooks/           # Inbound/outbound webhook integration triggers
│   │   │   ├── workers/            # Worker node registry, heartbeats & load balancer
│   │   │   └── workflow/           # DAG engine, dependency resolver & state machine
│   │   ├── queues/                 # Partitioned BullMQ queue factory & listeners
│   │   ├── routes/                 # Express API routing configuration
│   │   ├── simulator/              # Dry-run workflow simulation engine
│   │   ├── socket/                 # Socket.IO rooms, connection gateway & throttlers
│   │   ├── workers/                # Built-in worker handlers (HTTP, Email, Image, Report)
│   │   ├── app.ts                  # Express application configuration
│   │   ├── server.ts               # Primary API HTTP server & WebSocket bootstrap
│   │   └── worker.ts               # Standalone worker runtime entry point
│   ├── tests/                      # Integration, unit, and k6 load tests
│   ├── Dockerfile                  # Multi-stage container build for Backend API & Worker
│   └── package.json
├── frontend/                       # Vite + React 18 Single Page Application
│   ├── src/
│   │   ├── pages/
│   │   │   ├── Dashboard.tsx       # Live metrics, BullMQ queues & worker fleet
│   │   │   ├── WorkflowBuilder.tsx # Drag-and-drop Visual DAG designer
│   │   │   ├── WorkerRegistry.tsx  # Worker node health, load & drain controls
│   │   │   ├── CsvImport.tsx       # Batch workflow CSV file ingestion & validation
│   │   │   ├── Login.tsx           # User authentication screen
│   │   │   └── Register.tsx        # New account registration
│   │   ├── services/               # API HTTP client & Socket.IO real-time hooks
│   │   ├── index.css               # Modern slate-dark design theme & glassmorphic tokens
│   │   ├── App.tsx                 # Navigation & view router
│   │   └── main.tsx
│   ├── nginx.conf                  # Production reverse proxy config for SPA
│   ├── Dockerfile                  # Production Nginx container
│   └── package.json
├── packages/
│   ├── sdk-js/                     # Official TypeScript / JavaScript Client SDK
│   │   └── src/index.ts            # Client class for Workflows, Templates, Jobs, Workers
│   └── cli/                        # JobFlow Developer Command-Line Interface (`jobflow`)
│       └── src/index.ts            # CLI command implementations
├── deployment/                     # Infrastructure & Orchestration Configs
│   ├── docker/                     # Prometheus, Grafana, Loki, Promtail configs
│   ├── kubernetes/                 # K8s Manifests (Deployments, Services, HPA, Ingress, PVC)
│   ├── helm/                       # Production Helm 3 chart for cloud deployments
│   └── scripts/                    # Automated backup, restore-validation, and release scripts
├── docs/                           # In-depth architectural specifications & guides
├── docker-compose.yml              # Local development dependencies (Postgres + Redis)
├── docker-compose.prod.yml         # Full production multi-service stack
└── CHANGELOG.md                    # Release and version history
```

---

## 🚀 Quick Start

### Prerequisites
- **Node.js**: `v20.0.0` or higher
- **npm** or **pnpm**
- **Docker & Docker Compose** (for databases or full stack)

---

### Method 1: Local Development Setup

#### 1. Clone the repository
```bash
git clone https://github.com/AYUSH-P-SINGH/JobFlow.git
cd JobFlow
```

#### 2. Start PostgreSQL & Redis via Docker
```bash
docker compose up -d
```
> Spawns PostgreSQL on port `5433` and Redis on port `6379`.

#### 3. Setup and start Backend API Server
```bash
cd backend
cp .env.example .env

# Install dependencies
npm install

# Run database migrations & seed initial data
npx prisma db push
npm run prisma:seed # (or: npx tsx src/seed.ts)

# Start API in development mode
npm run dev
```
> API will be running at **http://localhost:5000**.

#### 4. Start Background Worker Node (in a new terminal)
```bash
cd backend
npm run worker:dev
```
> Worker will initialize, register with the API on port `5001`, and start listening on queues.

#### 5. Start Frontend Dashboard (in a new terminal)
```bash
cd ../frontend
npm install
npm run dev
```
> Dashboard will be running at **http://localhost:5173**.

---

### Method 2: Full-Stack Production Docker Compose

To spin up the **entire enterprise cluster** (API, Worker, Nginx Frontend, PostgreSQL, Redis, Jaeger, Prometheus, Loki, Promtail, Grafana) with a single command:

```bash
docker compose -f docker-compose.prod.yml up --build -d
```

#### Service Endpoints Matrix

| Service | URL | Credentials / Notes |
|---|---|---|
| **React Web Dashboard** | [http://localhost](http://localhost) | Port 80 (Nginx) |
| **API Server** | [http://localhost:5000](http://localhost:5000) | REST & WebSocket |
| **Swagger API Docs** | [http://localhost:5000/docs](http://localhost:5000/docs) | OpenAPI interactive explorer |
| **GraphQL Gateway** | [http://localhost:5000/graphql](http://localhost:5000/graphql) | POST GraphQL queries |
| **Bull-Board Queue UI** | [http://localhost:5000/admin/queues](http://localhost:5000/admin/queues) | BullMQ queue admin |
| **Recovery Dashboard** | [http://localhost:5000/admin/recovery](http://localhost:5000/admin/recovery) | Checkpoints & crash logs |
| **Grafana Dashboards** | [http://localhost:3000](http://localhost:3000) | `admin` / `admin` |
| **Jaeger Tracing UI** | [http://localhost:16686](http://localhost:16686) | Distributed traces |
| **Prometheus Scraper** | [http://localhost:9090](http://localhost:9090) | `/metrics` viewer |
| **Loki Log Aggregator** | [http://localhost:3100](http://localhost:3100) | Log streams |

---

## ⚙️ Configuration & Environment Variables

Copy `backend/.env.example` to `backend/.env` and adjust the variables as required:

```dotenv
# Server Configuration
PORT=5000
NODE_ENV=development
LOG_LEVEL=info

# JWT Security
JWT_SECRET=super_secret_jwt_key_jobflow_development_change_me_in_prod
JWT_EXPIRES_IN=1h

# Database (PostgreSQL)
DATABASE_URL=postgresql://postgres:postgrespassword@localhost:5433/jobflow?schema=public

# Cache & Queues (Redis)
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

# CORS Settings
CORS_ORIGIN=http://localhost:5173

# Worker Node Configuration
WORKER_PORT=5001
WORKER_REGION=default
WORKER_TAGS=["general","priority"]
WORKER_CONCURRENCY=5
WORKER_GPU=false
WORKER_SUPPORTED_JOBS=["HTTP","EMAIL","AI","DATA_PROC","WEBHOOK"]
API_SERVER_URL=http://localhost:5000

# OpenTelemetry Distributed Tracing
ENABLE_TRACING=false
OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318/v1/traces
OTEL_SERVICE_NAME=jobflow-backend
```

---

## 💻 Developer Tooling: CLI & SDKs

### 1. Developer CLI (`jobflow`)

JobFlow includes an official CLI tool for terminal-based workflow management, templating, and worker administration.

#### Installation
```bash
# Install globally from the packages directory
npm install -g ./packages/cli
```

#### CLI Command Reference
```bash
# 1. Authenticate with an API Key
jobflow login <your-api-key> http://localhost:5000

# 2. Scaffold a new workflow template JSON
jobflow create data-pipeline

# 3. Deploy a workflow template JSON
jobflow workflow deploy data-pipeline.json

# 4. List deployed templates
jobflow workflow list

# 5. Trigger a workflow execution
jobflow workflow run <template-id>

# 6. Check workflow status & live progress
jobflow workflow status <run-id>

# 7. View chronological execution logs
jobflow workflow logs <run-id>

# 8. Manage worker fleet
jobflow worker list
jobflow worker metrics
jobflow worker drain <worker-id>
```

---

### 2. Multi-Language SDKs

#### TypeScript / JavaScript SDK (`@jobflow/sdk-js`)

```typescript
import { JobFlowClient } from '@jobflow/sdk-js';

const client = new JobFlowClient({
  apiKey: 'jf_live_secret_key',
  baseUrl: 'http://localhost:5000',
});

// Create and deploy a template
const template = await client.templates.create('ETL Pipeline', 'Process daily extracts');
await client.templates.createVersion(template.data.id, {
  name: 'ETL Pipeline',
  steps: [
    { stepId: 'extract', jobType: 'HTTP', payload: { url: 'https://api.source.com/data' }, dependsOn: [] },
    { stepId: 'transform', jobType: 'DATA_PROC', payload: { script: 'clean.py' }, dependsOn: ['extract'] },
    { stepId: 'notify', jobType: 'EMAIL', payload: { to: 'ops@company.com' }, dependsOn: ['transform'] },
  ]
});

// Trigger a run
const run = await client.templates.run(template.data.id);
console.log(`Execution started: ${run.data.id}`);

// Inspect worker metrics
const metrics = await client.workers.metrics();
console.log(`Cluster CPU: ${metrics.data.totalCpu} cores`);
```

#### Python SDK Example
```python
from jobflow import JobFlowClient

client = JobFlowClient(api_key="jf_live_secret_key", base_url="http://localhost:5000")

# Trigger an execution
run = client.trigger_workflow("template-uuid-123", {
    "file_path": "/data/incoming.csv",
    "batch_size": 500
})
print(f"Workflow triggered: {run['id']}, status: {run['status']}")
```

#### Go SDK Example
```go
package main

import (
    "fmt"
    "github.com/jobflow/jobflow-go/sdk"
)

func main() {
    client := sdk.NewJobFlowClient("http://localhost:5000", "jf_live_secret_key")
    res, err := client.TriggerWorkflow("template-uuid-123", map[string]interface{}{
        "format": "parquet",
    })
    if err != nil {
        panic(err)
    }
    fmt.Printf("Started workflow: %s\n", res.ID)
}
```

---

## 📡 API Endpoints & GraphQL

### Core REST Endpoints

| Category | Method & Path | Description |
|---|---|---|
| **Health & Probes** | `GET /health` | Detailed service health (DB, Redis, Memory, Uptime) |
| | `GET /live` | Kubernetes Liveness Probe |
| | `GET /ready` | Kubernetes Readiness Probe |
| | `GET /metrics` | Prometheus telemetry scraper endpoint |
| **Authentication** | `POST /api/v1/auth/register` | Register a new user account |
| | `POST /api/v1/auth/login` | Authenticate & retrieve JWT access/refresh tokens |
| | `POST /api/v1/auth/refresh` | Refresh an expired access token |
| **Workflows** | `GET /api/v1/workflows` | List workflow executions (supports filtering & pagination) |
| | `POST /api/v1/workflows` | Submit and trigger an ad-hoc workflow DAG |
| | `GET /api/v1/workflows/:id` | Get workflow execution status, steps, and progress |
| | `PATCH /api/v1/workflows/:id/cancel` | Cancel an active in-flight workflow execution |
| | `POST /api/v1/workflows/:id/retry` | Retry failed steps from last checkpoint |
| **Templates** | `GET /api/v1/workflows/templates` | List all workflow templates |
| | `POST /api/v1/workflows/templates` | Create a new workflow template |
| | `POST /api/v1/workflows/templates/:id/versions` | Deploy a new versioned JSON DSL definition |
| | `POST /api/v1/workflows/templates/:id/run` | Execute a specific template version |
| **Jobs & Queues** | `GET /api/v1/jobs/:id` | Fetch details of a standalone background job |
| | `POST /api/v1/jobs` | Enqueue a standalone job into BullMQ |
| **Workers** | `GET /api/v1/workers` | List all registered workers & real-time load |
| | `POST /api/v1/workers/register` | Worker self-registration endpoint |
| | `POST /api/v1/workers/heartbeat` | 30s worker health check-in |
| | `POST /api/v1/workers/:id/drain` | Put a worker node into graceful drain mode |
| | `GET /api/v1/workers/metrics` | Aggregated cluster CPU, Memory, and Load metrics |
| **AI & Simulation** | `POST /api/v1/ai/generate` | Generate workflow JSON DSL from natural language prompt |
| | `POST /api/v1/workflows/simulate` | Dry-run DAG validation & step execution simulation |
| **Recovery** | `GET /api/v1/admin/recovery/checkpoints` | List step recovery checkpoints |
| | `POST /api/v1/admin/recovery/:id/resume` | Resume workflow from checkpoint |
| **Marketplace** | `GET /api/v1/marketplace/plugins` | List ecosystem plugins |
| | `POST /api/v1/marketplace/plugins` | Register custom plugin |

### GraphQL API (`POST /graphql`)

Query workflow graphs and steps with flexible GraphQL operations:

```graphql
query GetWorkflowStatus {
  workflow(id: "3fa85f64-5717-4562-b3fc-2c963f66afa6") {
    id
    name
    status
    progress
    currentStep
    steps {
      stepId
      jobType
      status
      startedAt
      completedAt
    }
  }
}
```

---

## 🎨 Visual Web Dashboard

The frontend dashboard provides a comprehensive operator interface:

1. **Live Analytics & Queues**: Real-time KPI cards for active jobs, completion rates, queue backlogs, and WebSocket connection status.
2. **Visual Workflow DAG Builder**: Interactive interface to connect steps, set input parameters, configure conditional rules, and test validations.
3. **Worker Registry Console**: Live view of connected worker nodes, CPU/Memory telemetry gauges, status flags (`READY`, `BUSY`, `DRAINING`), and drain triggers.
4. **CSV Bulk Importer**: Upload batch files, preview mapped job steps, execute validation checks, and trigger multi-job pipelines with instant reporting.
5. **Interactive Replay Debugger**: Step-by-step visual playback of completed or failed workflows to inspect exact payloads, logs, and state transitions.

---

## 🔬 Testing, Load & Chaos Engineering

JobFlow maintains a strict testing regime spanning unit tests, integration suites, k6 high-concurrency benchmarks, and chaos failover scenarios.

### 1. Running Native Backend Tests
```bash
cd backend
npm test
```
> Runs tests across Auth, Jobs, Queues, Workflows, Observability, and Worker Registry modules.

### 2. Running k6 High-Concurrency Load Tests
Simulates 100+ concurrent users dispatching workflows to ensure API latency remains strictly below 500ms under load:

```bash
k6 run -e API_URL=http://localhost:5000 backend/tests/load/k6-load-test.js
```

### 3. Chaos Engineering & Failover Playbooks
JobFlow is tested against sudden infrastructure disruptions. Full playbooks are detailed in [docs/testing/chaos-testing.md](docs/testing/chaos-testing.md):
- **Worker Crash Recovery**: Active workers killed mid-job are detected via missing heartbeats, transitioning state to `OFFLINE` while unacknowledged BullMQ jobs are safely re-queued.
- **Redis Connection Loss**: Distributed locking falls back safely and reconnects with exponential backoff.
- **PostgreSQL Temporary Outage**: In-flight jobs pause in memory until database reconnects, preserving idempotency.

---

## 🔄 Demonstrable CI/CD & GitOps Pipeline

JobFlow features a fully functional, zero-credential **GitOps CI/CD Pipeline** powered by **GitHub Actions**, **GitHub Container Registry (GHCR)**, **Trivy Security Scanning**, and **Kind (Kubernetes in Docker)**:

```
                        git push (main / PR)
                               │
                               ▼
                        GitHub Repository
                               │
                               ▼
                        GitHub Actions
                               │
             ┌─────────────────┴─────────────────┐
             ▼                                   ▼
      🧪 Unit & Integration               🛡️ Security Scan
       (Postgres 16 + Redis 7)             (Trivy + npm audit)
             │                                   │
             └─────────────────┬─────────────────┘
                               ▼
                       🐳 Docker Buildx
                               │
                               ▼
                   📦 GHCR Container Registry
               (ghcr.io/owner/jobflow-backend)
                               │
                               ▼
                   ☸️ Kubernetes In-CI (Kind)
                  (Helm 3 Automated Release)
                               │
             ┌─────────────────┴─────────────────┐
             ▼                                   ▼
        🚀 API Pods                         ⚙️ Worker Pods
       (HPA: 2-8 Replicas)                 (HPA: 3-10 Replicas)
             │                                   │
             └─────────────────┬─────────────────┘
                               ▼
                     🗄️ PostgreSQL & Redis
                               │
                               ▼
                     📊 Prometheus & Grafana
```

### 🌟 Why This Pipeline is 10/10
1. **Zero External Secrets Required**: Uses `secrets.GITHUB_TOKEN` to push images to **GitHub Container Registry (`ghcr.io`)** out-of-the-box.
2. **Security-First**: Runs parallel `npm audit` and **Trivy vulnerability and misconfiguration scanning** on every pull request.
3. **Real In-CI Kubernetes Validation**: Spawns an ephemeral **Kind** cluster directly inside the GitHub Actions runner, installs the Helm chart, waits for pod readiness, and executes live `/health` and `/ready` probe tests.
4. **Cloud-Ready**: The exact same Helm chart deployed in CI can be promoted directly to AWS (EKS), GCP (GKE), or Azure (AKS) without modifying a single manifest line.

---

## ☸️ Local Kubernetes Deployment (Kind / Minikube)

You don't need an AWS account or paid cloud infrastructure to run JobFlow on Kubernetes. You can spin up the full production cluster locally in seconds using **Kind** or **Minikube**.

### 1-Command Local Kind Setup

Run the automated bootstrap script to create a local Kind cluster, build images, and deploy the Helm chart:

**On Linux / macOS:**
```bash
chmod +x ./deployment/scripts/local-kind-setup.sh
./deployment/scripts/local-kind-setup.sh
```

**On Windows (PowerShell):**
```powershell
.\deployment\scripts\local-kind-setup.ps1
```

#### What the Script Does Automatically:
1. Provisions a multi-port mapped Kind cluster named `jobflow-local`.
2. Builds optimized Docker images for Backend (`jobflow-backend:local`) and Frontend (`jobflow-frontend:local`).
3. Sideloads images directly into the Kind control-plane nodes (no registry required).
4. Creates the `jobflow` namespace and installs the Helm chart with resource limits and health probes.
5. Verifies pod readiness:
   ```text
   NAME                               READY   STATUS    RESTARTS   AGE
   jobflow-api-6d8b7cfbfb-7t8q2       1/1     Running   0          42s
   jobflow-api-6d8b7cfbfb-k9lx4       1/1     Running   0          42s
   jobflow-worker-79774d8bb8-2d88v    1/1     Running   0          42s
   jobflow-worker-79774d8bb8-j45k2    1/1     Running   0          42s
   jobflow-postgres-0                 1/1     Running   0          42s
   jobflow-redis-0                    1/1     Running   0          42s
   ```

### Accessing Local Services
```bash
# Port-forward the API server to localhost:5000
kubectl port-forward -n jobflow svc/jobflow-api 5000:5000

# Access Bull-Board Queue Management:
# http://localhost:5000/admin/queues

# Access OpenAPI Swagger Docs:
# http://localhost:5000/docs
```

---

## 🚢 Deployment & Production Operations

### Cloud Kubernetes (AWS EKS / GCP GKE / Azure AKS)

Deploy the production Helm chart to your cloud cluster:

```bash
# 1. Switch to your cloud cluster context
kubectl config use-context <your-cloud-cluster-context>

# 2. Deploy via Helm using immutable short git SHA tag
helm upgrade --install jobflow ./deployment/helm \
  --namespace jobflow \
  --create-namespace \
  --set image.repository=ghcr.io/ayush-p-singh/jobflow-backend \
  --set image.tag=a1b2c3d \
  --set global.jwtSecret="YOUR_STRONG_PRODUCTION_SECRET"
```

### Production Helm Rollback Operations

If a newly deployed release version experiences issues, roll back instantly to the last healthy revision:

```bash
# 1. Check revision history
helm history jobflow -n jobflow

# 2. Rollback to previous stable revision (e.g. revision 1)
helm rollback jobflow 1 -n jobflow

# 3. Verify rollout status of API and Worker pods
kubectl rollout status deployment/jobflow-api -n jobflow
kubectl rollout status deployment/jobflow-worker -n jobflow
```

### 🛡️ Verified Failure Scenarios & Resilience Matrix

The platform's fault tolerance is proven against critical distributed failure scenarios:

| Failure Scenario | Simulated Fault | Verified Behavior & Recovery |
| :--- | :--- | :--- |
| **Worker Crash Mid-Execution** | Sudden process SIGKILL / termination | BullMQ unacknowledged lock expires; job automatically re-queued or routed to online workers; health monitor detects timeout (`>30s`) and marks worker `OFFLINE`. |
| **Duplicate Worker Callback** | Worker sends completion callback twice | [`WorkflowEngine`](backend/src/modules/workflow/engine/workflow.engine.ts) idempotency guard verifies terminal status (`COMPLETED`); duplicate callbacks safely discarded without duplicate history entries or extra ticks. |
| **Concurrent Workflow Ticks** | 20+ simultaneous tick triggers | Redis distributed lock (`lock:workflow:tick:<id>`) with UUID ownership token ensures strictly one atomic evaluation per workflow. |
| **Invalid DAG (Cycle)** | Submitting circular step dependency ($A \to B \to A$) | Ingestion validator rejects cycle with `400 Bad Request: Circular dependencies detected in workflow steps` before scheduling. |
| **Unauthorized Tenant Access** | Tenant A requests Tenant B workflow by ID | Strict tenant scoping in authorization middleware rejects cross-tenant requests with `401/403 Unauthorized`. |
| **Exhausted Retries (DLQ)** | Job fails all configured retry attempts | Job payload and stack trace moved to `DeadLetterJob` table; available for manual/automated idempotent replay via `POST /api/v1/recovery/dlq/:id/replay`. |

### Backup & Disaster Recovery Scripts
Automated shell scripts for production backups and verification:
```bash
# Run database and configuration backup
./deployment/scripts/backup.sh

# Validate and dry-run backup restoration
./deployment/scripts/restore-validate.sh
```

---

## 📚 Documentation Index

For detailed guides and architecture documents, consult the `docs/` directory:

| Document | Topic |
|---|---|
| [**Workflow Engine**](docs/workflow-engine.md) | DAG resolution, tick traversal algorithm, distributed locking |
| [**Worker Registry**](docs/worker-registry.md) | Worker node schema, heartbeats, and load balancing |
| [**Observability Architecture**](docs/observability.md) | Distributed tracing, Winston/Loki logging, Prometheus metrics & SLOs |
| [**Developer Platform**](docs/platform.md) | Multi-language SDKs (Python, Go, Java), Plugins & GraphQL |
| [**API Reference**](docs/api-reference.md) | Complete REST API endpoint reference |
| [**Deployment Guide**](docs/deployment.md) | Kubernetes, Helm, Ingress, and Production environment configuration |
| [**Load Testing Guide**](docs/testing/load-testing.md) | k6 performance validation benchmarks |
| [**Chaos Testing Guide**](docs/testing/chaos-testing.md) | Fault-tolerance verification & recovery scenarios |
| [**Runbooks & SRE**](docs/runbooks.md) | Incident response, alert triage, and maintenance procedures |

---

## 🤝 Contributing

We welcome contributions from the community! To get started:

1. **Fork the Repository** and clone your fork.
2. **Create a Feature Branch**: `git checkout -b feature/amazing-feature`.
3. **Commit your Changes**: `git commit -m "feat: Add amazing feature"`.
4. **Run Tests**: Ensure `npm test` passes cleanly.
5. **Push to Branch**: `git push origin feature/amazing-feature`.
6. **Open a Pull Request** against the `main` branch.

---

## 📄 License

This project is licensed under the [ISC License](LICENSE).

---

<div align="center">
Built with ❤️ by the <b>JobFlow Team</b>. Empowering resilient distributed workflow orchestration at scale.
</div>
