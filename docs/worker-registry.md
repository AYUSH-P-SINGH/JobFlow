# Worker Registry

## Overview

The Worker Registry is the central database and in-memory cache that tracks all registered worker nodes in the JobFlow distributed platform. Every worker self-registers on startup and maintains its presence through periodic heartbeats.

## Architecture

```
Worker Process           API Server              Database
     │                       │                       │
     │  POST /register       │                       │
     │──────────────────────>│  INSERT WorkerNode    │
     │                       │──────────────────────>│
     │  { id: "w-123" }      │                       │
     │<──────────────────────│                       │
     │                       │                       │
     │  POST /heartbeat      │  UPDATE heartbeat     │
     │──────────────────────>│──────────────────────>│
     │  (every 30s)          │                       │
```

## WorkerNode Schema

| Field           | Type         | Description                              |
|-----------------|-------------|------------------------------------------|
| `id`            | UUID        | Unique worker identifier                 |
| `hostname`      | String      | Machine hostname                         |
| `port`          | Int         | Worker HTTP health port                  |
| `status`        | WorkerStatus| STARTING, READY, BUSY, DRAINING, OFFLINE |
| `region`        | String      | Deployment region (e.g., "us-east-1")    |
| `tags`          | JSON        | Custom tags (e.g., ["priority","gpu"])    |
| `cpu`           | Int         | Number of CPU cores                      |
| `memory`        | Int         | Available memory in MB                   |
| `gpu`           | Boolean     | GPU availability                         |
| `supportedJobs` | JSON        | Job types this worker handles            |
| `concurrency`   | Int         | Max concurrent jobs                      |
| `runningJobs`   | Int         | Currently running jobs count             |
| `completedJobs` | Int         | Total completed jobs                     |
| `failedJobs`    | Int         | Total failed jobs                        |
| `currentLoad`   | Float       | Utilization ratio (0.0 to 1.0)           |
| `lastHeartbeat` | DateTime    | Last heartbeat timestamp                 |
| `startedAt`     | DateTime    | Worker start time                        |
| `queueName`     | String?     | Specialized queue this worker listens on |

## API Endpoints

### Register Worker
```
POST /api/v1/workers/register
Content-Type: application/json

{
  "hostname": "worker-pod-1",
  "port": 5001,
  "region": "us-east-1",
  "tags": ["email", "priority"],
  "cpu": 8,
  "memory": 16384,
  "gpu": false,
  "supportedJobs": ["EMAIL", "PDF"],
  "concurrency": 10
}
```

### List Workers
```
GET /api/v1/workers
GET /api/v1/workers?status=READY
```

### Get Worker Details
```
GET /api/v1/workers/:id
```

### Deregister Worker
```
DELETE /api/v1/workers/:id
```

## Environment Variables

| Variable               | Default     | Description                    |
|------------------------|-------------|--------------------------------|
| `WORKER_SUPPORTED_JOBS`| `""`        | Comma-separated job types      |
| `WORKER_CONCURRENCY`   | `5`         | Max concurrent jobs per worker |
| `WORKER_REGION`        | `"default"` | Deployment region              |
| `WORKER_TAGS`          | `""`        | Comma-separated worker tags    |
| `WORKER_GPU`           | `"false"`   | GPU capability flag            |
| `API_SERVER_URL`       | `"http://localhost:5000"` | API server URL   |
