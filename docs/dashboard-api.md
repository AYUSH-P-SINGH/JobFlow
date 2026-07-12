# Dashboard & Monitoring REST API Reference

JobFlow exposes a rich set of operational REST endpoints to monitor queue metrics, worker resources, active pipelines, audit logs, and timelines. All endpoints are versioned under `/api/v1/monitoring/*`.

---

## 1. Authentication & Authorization

- **JWT Authentication Required**: All endpoints require a valid user access token passed in the `Authorization: Bearer <token>` header.
- **Admin Restrictions**: Routes containing critical cluster metrics or audit logs are restricted to users possessing the `ADMIN` role.

---

## 2. API Endpoints

### 1. GET `/api/v1/monitoring/dashboard`
Returns high-level platform health metrics and compilation of jobs processed today.
- **Access**: `ADMIN` role only
- **Response Example**:
  ```json
  {
    "success": true,
    "data": {
      "activeWorkflows": 5,
      "failedToday": 2,
      "completedToday": 84,
      "activeJobs": 12,
      "successRate": 97.6
    }
  }
  ```

### 2. GET `/api/v1/monitoring/queues`
Returns persistent metrics for the primary BullMQ job queues.
- **Access**: `ADMIN` role only
- **Response Example**:
  ```json
  {
    "success": true,
    "data": {
      "waiting": 14,
      "active": 3,
      "completed": 1240,
      "failed": 28,
      "delayed": 2
    }
  }
  ```

### 3. GET `/api/v1/monitoring/workers`
Returns host details, resource utilization (CPU, memory), and active tasks of all registered worker processes.
- **Access**: `ADMIN` role only
- **Response Example**:
  ```json
  {
    "success": true,
    "data": [
      {
        "workerId": "worker-node-1",
        "status": "IDLE",
        "cpuUsage": 1.4,
        "memoryUsage": 84200000,
        "uptime": 86400,
        "activeJobsCount": 0
      }
    ]
  }
  ```

### 4. GET `/api/v1/monitoring/workflows`
Lists all active workflow executions across all tenants.
- **Access**: `ADMIN` role only

### 5. GET `/api/v1/monitoring/logs`
Returns the global audit trail log capturing user actions (logins, cancellations, retries, creation) for security and compliance audits.
- **Access**: `ADMIN` role only

### 6. GET `/api/v1/monitoring/workflows/:id/timeline`
Retrieves the chronological sequence of execution steps and states for a specific workflow ID.
- **Access**: Authenticated users who own the workflow (or admins).
- **Path Parameter**: `id` (Workflow ID)
- **Response Example**:
  ```json
  {
    "success": true,
    "data": [
      {
        "event": "CREATED",
        "message": "Workflow created successfully",
        "createdAt": "2026-07-12T14:40:00.000Z"
      },
      {
        "event": "STEP_STARTED",
        "message": "Step 'fetch-data' has been scheduled and queued.",
        "createdAt": "2026-07-12T14:40:02.000Z"
      }
    ]
  }
  ```

### 7. GET `/api/v1/monitoring/analytics`
Returns tenant-specific execution throughput graphs, averages, and failure ratios over time.
- **Access**: Authenticated users.
