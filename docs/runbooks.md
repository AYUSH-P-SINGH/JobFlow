# JobFlow SRE Runbooks & Operational Incident Guides

This document provides step-by-step incident response procedures for operators managing JobFlow in production.

---

## 1. Redis Outage Mitigation

### Severity: High

### Symptoms
- Workers throw connection errors: `Redis connection lost` or `Max reconnection attempts reached`.
- API endpoints return `500 Internal Server Error` when enqueuing jobs.
- Scheduled cron tasks do not execute.

### Resolution Steps
1. **Check Redis Container/Process Status:**
   If running locally or via Docker Compose:
   ```bash
   docker ps -a | grep redis
   ```
   If running in Kubernetes:
   ```bash
   kubectl get pods -l app=redis
   ```
2. **Restart Redis Service:**
   - Docker Compose: `docker-compose restart redis`
   - Kubernetes: `kubectl rollout restart deployment/redis`
   - Linux: `sudo service redis-server restart`
3. **Verify Re-connection:**
   Once Redis is back online, monitor the JobFlow application logs. The `ioredis` client will automatically reconnect and resume enqueuing.
4. **Fallback Mechanism:**
   JobFlow's `QuotaService` and `DistributedLock` are built to degrade gracefully. If Redis remains unreachable, the API rate quotas will bypass validation (falling back to warning logs) rather than crashing the request threads.

---

## 2. PostgreSQL Outage Mitigation

### Severity: Critical

### Symptoms
- Application processes fail to start or exit immediately with `PrismaClientInitializationError`.
- API calls return `500` database connection timeouts.

### Resolution Steps
1. **Check PostgreSQL Process Status:**
   - Windows: `Get-Service -Name postgresql*`
   - Linux: `sudo service postgresql status`
2. **Start/Restart Service:**
   - Windows: `Start-Service -Name postgresql-x64-15` (or run `pg_ctl start -D <data_dir>`)
   - Linux: `sudo service postgresql restart`
3. **Check Connection Pool Limits:**
   If PostgreSQL is running but rejecting connections, check if the maximum connections limit is reached. Increase `max_connections` in `postgresql.conf` or utilize a pooling manager like `PgBouncer`.
4. **Run Backup Validation:**
   If the database files are corrupted, restore the latest healthy backup using the restoration guide:
   ```bash
   bash deployment/scripts/restore-validate.sh
   ```

---

## 3. Worker Crash Recovery

### Severity: Medium

### Symptoms
- Workflows are stuck in the `RUNNING` status with no progress updates.
- Queue wait time increases as jobs sit in `QUEUED` state indefinitely.

### Resolution Steps
1. **Restart Worker Processes:**
   Locate and restart the crashed background worker:
   - Command: `npm run worker`
   - Docker: `docker restart jobflow-worker`
   - Kubernetes: `kubectl rollout restart deployment/jobflow-worker`
2. **Startup Auto-Recovery:**
   Upon worker startup, the `RecoveryService` automatically scans all `RUNNING` workflows in PostgreSQL and reconciles them with active BullMQ jobs.
   - Any step marked as `RUNNING` that has lost its corresponding BullMQ job (due to the crash) is automatically reset back to `PENDING`.
   - The engine automatically triggers `WorkflowEngine.tick(workflowId)` to reschedule and resume the workflow from its last checkpoint.

---

## 4. DLQ Manual Recovery

### Severity: Low

### Symptoms
- Jobs are routed to the Dead Letter Queue after exhausting all 3 attempts.
- Operators see failed jobs listed in the **Recovery Dashboard** at `/admin/recovery`.

### Resolution Steps
1. **Inspect Failure Details:**
   Navigate to the recovery dashboard at `http://localhost:5000/admin/recovery`.
   Review the JSON error payload inside the failed job card (e.g. `SMTP connection timed out`).
2. **Resolve Root Cause:**
   Ensure the external service or dependency (e.g. SMTP server, webhook target) is fully operational.
3. **Replay Job:**
   Click **Replay** next to the job in the recovery dashboard, or execute the API call:
   ```bash
   curl -X POST http://localhost:5000/api/v1/admin/recovery/dlq/<jobId>/replay -H "Authorization: Bearer <admin_token>"
   ```
   This resets the job attempts and moves the step and workflow status back to `RUNNING` for immediate reprocessing.
4. **Discard Job:**
   If the job payload is invalid and cannot be processed, click **Discard** or call:
   ```bash
   curl -X POST http://localhost:5000/api/v1/admin/recovery/dlq/<jobId>/discard -H "Authorization: Bearer <admin_token>"
   ```

---

## 5. Zero-Downtime Rolling Deployments

### Guidelines
To deploy updates to JobFlow without causing workflow interruptions:

1. **Database Schema Additions Only:**
   Always perform additive migrations (e.g. adding columns/tables). Never delete columns or tables in a single release without a deprecation phase.
2. **Deploy Workers First:**
   Deploy new workers alongside old workers. BullMQ allows multiple worker versions to consume from the same queue safely.
3. **Deploy API Gateways / Server:**
   Update the Express API server instances.
4. **Clean up Old Worker Instances:**
   Gracefully shut down old workers using `SIGTERM`. JobFlow's worker lifecycle handles graceful shutdown by closing the queue consumers, letting active jobs complete before exiting.
