# JobFlow Cloud-Native Deployment & Operations Guide

This guide details the high availability (HA), horizontal scaling, centralized monitoring, and disaster recovery strategies implemented in Phase 9 to transform JobFlow into an enterprise-grade cloud-native workflow platform.

---

## 1. System Architecture

The cloud-native deployment is designed to be highly available and resilient, with self-healing workloads and automated autoscaling:

```
                        Internet (Traffic)
                               │
                       Kubernetes Ingress
                               │
                    Load Balancer (ClusterIP)
                               │
        ┌───────────────────┼───────────────────┐
        ▼                   ▼                   ▼
    API Pod 1          API Pod 2          API Pod 3  <--- Scaled by api-hpa (3-8 pods)
        │                   │                   │
        └───────────────┬───┴───────────────────┘
                        │
             PostgreSQL Cluster (StatefulSet)
                        │
             Redis Cluster/Sentinel (StatefulSet)
                        │
        ┌───────────────┼────────────────────┐
        ▼               ▼                    ▼
    Worker 1        Worker 2            Worker 3    <--- Scaled by worker-hpa (5-10 pods)
        │               │                    │
        └───────────────┬────────────────────┘
                        ▼
                 Workflow Engine
                        │
          Prometheus + Grafana + Loki (Logs/Metrics/Traces)
```

---

## 2. Docker Stack Optimization

### Multi-Stage Build
The backend [Dockerfile](file:///d:/JOBFLOW/backend/Dockerfile) uses a multi-stage process to separate building transpilation dependencies from runtime packages:
1. **Builder Stage**: Builds the TypeScript source into ES Modules (`dist/`) and generates the Prisma client.
2. **Runner Stage**: Employs a lightweight `node:20-alpine` image, imports compiled files, runs `npm ci --omit=dev`, and executes the service using the non-root `node` user for security.

### Docker Healthcheck
Containers include native Docker healthchecks utilizing Node 20's global `fetch` API:
```dockerfile
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://localhost:' + (process.env.PORT || 5000) + '/health').then(r => r.ok ? process.exit(0) : process.exit(1)).catch(() => process.exit(1))"
```

---

## 3. Local Production Run (Docker Compose)

The full infrastructure is packaged as [docker-compose.prod.yml](file:///d:/JOBFLOW/docker-compose.prod.yml).

### Spin Up Stack
Run the following command in the project root:
```bash
docker compose -f docker-compose.prod.yml up -d --build
```

### Services Exposed
- **JobFlow API**: `http://localhost:5000`
- **Worker Health**: `http://localhost:5001`
- **Jaeger UI (Tracing)**: `http://localhost:16686`
- **Prometheus UI**: `http://localhost:9090`
- **Grafana (Dashboards)**: `http://localhost:3000`
- **Loki (Aggregated Logs)**: `http://localhost:3100`

---

## 4. Kubernetes Deployment

Workloads are isolated in the `jobflow` namespace. Base manifests are located in [deployment/kubernetes/](file:///d:/JOBFLOW/deployment/kubernetes).

### Commands to Deploy
1. **Create Namespace**:
   ```bash
   kubectl apply -f deployment/kubernetes/namespace.yaml
   ```
2. **Apply Configurations and Secrets**:
   ```bash
   kubectl apply -f deployment/kubernetes/configmap.yaml
   kubectl apply -f deployment/kubernetes/secrets.yaml
   ```
3. **Deploy Database and Redis StatefulSets**:
   ```bash
   kubectl apply -f deployment/kubernetes/postgres/
   kubectl apply -f deployment/kubernetes/redis/
   ```
4. **Deploy Application, HPAs, and Ingress**:
   ```bash
   kubectl apply -f deployment/kubernetes/api/
   kubectl apply -f deployment/kubernetes/workers/
   kubectl apply -f deployment/kubernetes/ingress/
   kubectl apply -f deployment/kubernetes/monitoring/
   ```

---

## 5. Horizontal Pod Autoscaling (HPA)

Autoscaling properties are declared for both API and Background workers:

- **API Pods**: Scales from **3 to 8** replicas when average CPU utilization exceeds **70%**.
- **Worker Pods**: Scales from **5 to 10** replicas when average CPU utilization exceeds **70%**. BullMQ automatically distributes queue processing to new worker pods as they bootstrap.

---

## 6. Liveness, Readiness, and Startup Probes

Pods use three distinct probes to manage service lifecycles without routing bad traffic:
1. **Startup Probe (`/startup`)**: Verifies that DB and Redis connections are established before liveness checks start.
2. **Liveness Probe (`/health`)**: Lightweight check verifying the Node process is active.
3. **Readiness Probe (`/ready`)**: Verifies DB and Redis are fully online. If either fails, traffic routing is halted (ingress level) to prevent client request errors.

---

## 7. Helm Chart Packaging

For multi-environment releases, run standard Helm commands:

### Install
```bash
helm install jobflow ./deployment/helm --namespace jobflow
```

### Upgrade / Deploy v2
```bash
helm upgrade jobflow ./deployment/helm --namespace jobflow --set image.tag="v2"
```

---

## 8. Distributed Tracing & Centralized Logging

### OpenTelemetry Tracing
- Express endpoints and database calls are auto-instrumented.
- Trace contexts are propagated via BullMQ jobs using job payload metadata (`correlationId`).
- Traces can be viewed live in the Jaeger UI at `http://localhost:16686`.

### Loki Logging
- Containers output JSON formatted logs in production.
- Promtail scans container stdouts from `docker.sock` and ships logs to Loki.
- Logs are visualized in Grafana (add `http://loki:3100` as a Loki datasource).

---

## 9. Backup & Disaster Recovery

### Creating a Backup
Automated hourly backups can be scheduled using the [backup.sh](file:///d:/JOBFLOW/deployment/scripts/backup.sh) utility.
To run manually:
```bash
bash deployment/scripts/backup.sh
```

### Restoring Database Dump
To restore a `.sql.gz` dump:
1. Copy the file into the database container:
   ```bash
   docker cp /tmp/jobflow-backups/jobflow_db_<timestamp>.sql.gz jobflow-postgres-prod:/tmp/
   ```
2. Exec into the container and gunzip:
   ```bash
   docker exec -it jobflow-postgres-prod gunzip /tmp/jobflow_db_<timestamp>.sql.gz
   ```
3. Drop and recreate database:
   ```bash
   docker exec -it jobflow-postgres-prod dropdb -U postgres jobflow
   docker exec -it jobflow-postgres-prod createdb -U postgres jobflow
   ```
4. Restore SQL dump:
   ```bash
   docker exec -it jobflow-postgres-prod psql -U postgres -d jobflow -f /tmp/jobflow_db_<timestamp>.sql
   ```
