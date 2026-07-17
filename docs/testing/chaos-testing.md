# Chaos Testing & Failover Playbook

This document details failure scenarios, recovery validation, and failover playbooks for the JobFlow platform.

---

## 1. Scenario: Worker Process Failure (Worker Kill)

### Simulation
*   Kill an active worker process during step execution:
    ```bash
    # Kill the docker worker container
    docker compose -f docker-compose.prod.yml kill worker
    ```

### Expected Behavior
1.  **Heartbeat Expiry**: The API server registry identifies that the worker's heartbeat has expired (max 10 seconds timeout).
2.  **Node Offline**: The worker node status transitions to `OFFLINE` in the registry.
3.  **Job Recovery (BullMQ Lock Expiry)**: Active jobs lock on Redis expires.
4.  **Auto-Retry**: The BullMQ queue automatically restarts the active task and schedules it onto another `READY` worker.
5.  **State Machine Resume**: The workflow engine updates the step checkpoints and continues executing without workflow corruption.

---

## 2. Scenario: Redis / BullMQ Disconnection

### Simulation
*   Temporarily stop the Redis container:
    ```bash
    docker compose -f docker-compose.prod.yml stop redis
    ```

### Expected Behavior
1.  **Connection Retries**: The backend instances (API and Worker) log reconnection attempts using the configured retry strategy:
    `Redis [main]: Retry attempt 1, next in 500ms...`
2.  **Request Buffering / Failure Degrade**: Gateway APIs return `503 Service Unavailable` for queue-specific actions (like workflow start) but allow public reads if cached, degrading gracefully.
3.  **Automatic Resync**: Once the Redis server is started (`docker compose start redis`), the API server and worker pool reconnect instantly, re-processing active events queues without data loss.

---

## 3. Scenario: PostgreSQL Database Failure

### Simulation
*   Temporarily pause or stop the Postgres service:
    ```bash
    docker compose -f docker-compose.prod.yml stop postgres
    ```

### Expected Behavior
1.  **Prisma Retries & Failures**: Active database operations fail with Prisma connection errors.
2.  **Readiness Probe Offline**: The readiness probe `/ready` returns `503 not_ready` indicating database is unhealthy. Kubernetes automatically restarts or routes traffic away from this pod.
3.  **Active checkpointer recovery**: On database recovery, active workflow state steps are recovered from checkpoints, updating failed states and keeping history timeline logs correct.
