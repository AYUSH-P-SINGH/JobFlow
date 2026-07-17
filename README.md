# JobFlow 🚀

Distributed Workflow Orchestration & Job Queue Platform (React + Express + BullMQ + Redis + PostgreSQL)

JobFlow is a high-performance distributed task processing and workflow orchestration platform. It coordinates multi-step jobs represented as Directed Acyclic Graphs (DAGs) with sequential, parallel, and capability-based execution paths, complete with persistent state logs, retry backoff policies, distributed worker capacity tracking, and real-time observability.

---

## 🗺️ Project State: Phase 17 Production Ready

JobFlow has evolved into a complete, enterprise-grade production platform:
*   **Intelligent Distributed Workers (Phase 16)**: Worker nodes register with CPU/Memory telemetry and check in via heartbeats, supporting specialized routing rules (least-loaded, priority-based, round-robin, capability matching). Nodes can be gracefully drained for maintenance.
*   **Vite React Dashboard (Phase 17)**: A high-fidelity dark-themed single page application supporting login/registration, live BullMQ queue tracking, dynamic node stats, a drag-and-drop visual DAG builder, and a CSV import batch validator.
*   **JS SDK & Developer CLI (Phase 17)**: A unified JS SDK client and command-line tool `jobflow` supporting workspace scaffolding, deploying templates, and monitoring workers.
*   **Enterprise Production Observability**: Real-time events streaming via Socket.IO, Winston-based trace tracking (`requestId`, `workflowId`, `workerId`, `jobId`), Prometheus `/metrics`, and Loki log streams.

---

## 🛠️ Technology Stack

*   **Frontend**: React (v18), Vite, TypeScript, Socket.IO Client, CSS Themes.
*   **Backend**: Node.js (v20+), Express.js (v4), TypeScript.
*   **Orchestration & State**: BullMQ & Redis, PostgreSQL, Prisma ORM.
*   **Observability**: Winston Logger, Prometheus, Grafana, Loki.
*   **Developer Tooling**: JS SDK, CLI, Swagger OpenAPI.
*   **Testing**: k6 Load Testing, Chaos Failover Scripts, Node.js Native Test Runner.

---

## 📂 Project Directory Structure

```text
jobflow/
├── backend/
│   ├── src/
│   │   ├── config/          # Environment variables & startup validation
│   │   ├── common/          # Winston logging, HTTP errors, AsyncLocalStorage tracing
│   │   ├── socket/          # Socket.IO WebSocket broadcasts
│   │   ├── queues/          # Partitioned BullMQ queue handlers
│   │   ├── workers/         # Base worker and lifecycle supervisors
│   │   └── modules/         # Auth, Jobs, Workflow engine, Telemetry & Swagger Controller
│   ├── tests/               # Backend units, integrations, and k6 load tests
├── frontend/
│   ├── src/
│   │   ├── pages/           # Login, Register, Dashboard, CsvImport, WorkflowBuilder
│   │   ├── services/        # HTTP API Client and Socket.IO listener
│   │   └── index.css        # Premium slate-dark glassmorphic design theme
│   └── Dockerfile           # Multi-stage production Nginx container configuration
├── packages/
│   ├── sdk-js/              # JS SDK client libraries
│   └── cli/                 # Developer command-line tool (`jobflow`)
├── deployment/
│   ├── kubernetes/          # K8s Ingress, deployments, HPA, Services, PVC
│   └── helm/                # Multi-service Helm charts
├── docs/                    # Architecture, API-Reference, Load & Chaos guides
├── docker-compose.prod.yml  # Complete production service composition
└── CHANGELOG.md             # Project change history and releases log
```

---

## 🚀 Running the Production Compose Stack

The quickest way to spin up the entire cluster (API Server, Redis, Postgres DB, Prometheus, Loki, Grafana, Workers, and the React Dashboard) is using Docker Compose:

```bash
# Start all production services in the background
docker compose -f docker-compose.prod.yml up --build -d
```

Once running:
*   **React Dashboard**: Access at [http://localhost](http://localhost) (mapped on port 80).
*   **API Web Server**: Access at [http://localhost:5000](http://localhost:5000).
*   **API Swagger Reference**: Explore at [http://localhost:5000/docs](http://localhost:5000/docs).
*   **Grafana Telemetry**: Monitor dashboards at [http://localhost:3000](http://localhost:3000).
*   **BullMQ Admin Panel**: Manage queue statuses at [http://localhost:5000/admin/queues](http://localhost:5000/admin/queues).

---

## ⌨️ Command Line Interface (CLI)

The CLI tool allows developers to manage pipelines and worker nodes directly from the console.

### Installation
```bash
npm install -g ./packages/cli
```

### Commands List
*   **Scaffold a Workflow template**:
    ```bash
    jobflow create my-pipeline
    ```
*   **Manage Workflows**:
    ```bash
    jobflow workflow list
    jobflow workflow deploy my-pipeline.json
    jobflow workflow run <template-id>
    jobflow workflow status <run-id>
    jobflow workflow logs <run-id>
    ```
*   **Manage Worker Clusters**:
    ```bash
    jobflow worker list
    jobflow worker metrics
    jobflow worker drain <worker-id>
    ```

---

## 🔬 Testing Suites

### Running Native Backend Tests
```bash
cd backend
npm install
npm test
```

### Running k6 Load Tests
Ensures that the API handles high concurrent workflow registration under 500ms response targets:
```bash
k6 run -e API_URL=http://localhost:5000 backend/tests/load/k6-load-test.js
```
See the [Load Testing Guide](docs/testing/load-testing.md) for more details.

### Reviewing Failover & Chaos Playbooks
Check [Chaos Testing Guide](docs/testing/chaos-testing.md) for behavior analysis during Postgres, Redis, and Worker Node recovery scenarios.
