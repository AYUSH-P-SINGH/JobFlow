# JobFlow Enterprise API Reference

Welcome to the JobFlow API Reference. JobFlow exposes REST endpoints for authentication, project isolation, custom workflow orchestration, worker heartbeat scheduling, and real-time observability telemetry.

## Authentication Headers
All endpoints (except `/api/v1/auth/register` and `/api/v1/auth/login`) require one of:
*   **Bearer JWT Token**: `Authorization: Bearer <accessToken>`
*   **Tenant API Key**: `X-API-Key: <apiKey>`

---

## 1. Authentication Module

### Register a User
Create a new developer tenant account.
*   **URL**: `/api/v1/auth/register`
*   **Method**: `POST`
*   **Request Body**:
    ```json
    {
      "email": "developer@jobflow.io",
      "password": "StrongPassword123!"
    }
    ```
*   **Response (201)**:
    ```json
    {
      "success": true,
      "data": {
        "user": { "id": "uuid", "email": "developer@jobflow.io", "role": "USER" },
        "accessToken": "eyJhb...",
        "refreshToken": "eyJhb..."
      }
    }
    ```

### User Login
Authenticate credentials and request session tokens.
*   **URL**: `/api/v1/auth/login`
*   **Method**: `POST`
*   **Request Body**:
    ```json
    {
      "email": "developer@jobflow.io",
      "password": "StrongPassword123!"
    }
    ```
*   **Response (200)**: Returns user model and token pair.

### Token Rotation
Revoke previous refresh token and issue a new pair.
*   **URL**: `/api/v1/auth/refresh`
*   **Method**: `POST`
*   **Request Body**:
    ```json
    {
      "refreshToken": "<old_refresh_token>"
    }
    ```
*   **Response (200)**: Returns new `accessToken` and rotated `refreshToken`.

---

## 2. Distributed Workflow Executions

### Trigger Workflow Execution
Create and queue a workflow execution topology.
*   **URL**: `/api/v1/workflows`
*   **Method**: `POST`
*   **Request Body**:
    ```json
    {
      "name": "Data-Ingest-Pipeline",
      "steps": [
        {
          "stepId": "download-csv",
          "jobType": "HTTP",
          "priority": "HIGH",
          "payload": { "url": "https://example.com/source.csv" },
          "dependsOn": []
        },
        {
          "stepId": "format-rows",
          "jobType": "AI",
          "priority": "MEDIUM",
          "payload": { "prompt": "extract fields" },
          "dependsOn": ["download-csv"]
        }
      ]
    }
    ```
*   **Response (201)**:
    ```json
    {
      "success": true,
      "data": {
        "id": "workflow-uuid-1234",
        "name": "Data-Ingest-Pipeline",
        "status": "PENDING",
        "progress": 0
      }
    }
    ```

### Get Workflow Execution Status
Retrieve live execution plan, steps, progress, and history events log.
*   **URL**: `/api/v1/workflows/:id`
*   **Method**: `GET`
*   **Response (200)**: Detailed workflow representation with steps array and history timeline list.

### Cancel Workflow
Gracefully terminate pending/active jobs and set execution status to `CANCELLED`.
*   **URL**: `/api/v1/workflows/:id/cancel`
*   **Method**: `PATCH`

### Retry Workflow
Reset and resume execution from failure step checkpoints.
*   **URL**: `/api/v1/workflows/:id/retry`
*   **Method**: `POST`

---

## 3. Worker Node Management

### Register Worker Node
Register host daemon to join worker pool.
*   **URL**: `/api/v1/workers/register`
*   **Method**: `POST`
*   **Request Body**:
    ```json
    {
      "hostname": "worker-node-1",
      "port": 5001,
      "region": "us-west",
      "supportedJobs": ["EMAIL", "PDF", "HTTP"],
      "concurrency": 10
    }
    ```

### Worker Heartbeat
Send heartbeat to report loads, active task counters, and check state changes.
*   **URL**: `/api/v1/workers/:id/heartbeat`
*   **Method**: `POST`
*   **Request Body**:
    ```json
    {
      "runningJobs": 2,
      "completedJobs": 25,
      "failedJobs": 0,
      "currentLoad": 0.2
    }
    ```

### Drain Worker Node
Prepare worker for graceful maintenance. Prevents new jobs from scheduling.
*   **URL**: `/api/v1/workers/:id/drain`
*   **Method**: `POST`

---

## 4. Observability & Telemetry

### Dashboard Statistics
Get cluster status counters.
*   **URL**: `/api/v1/monitoring/dashboard`
*   **Method**: `GET`

### Queue Statistics
Check wait queues and active jobs sizes.
*   **URL**: `/api/v1/monitoring/queues`
*   **Method**: `GET`

### Prometheus Metrics
Expose raw metrics for scraper configurations.
*   **URL**: `/metrics`
*   **Method**: `GET`
