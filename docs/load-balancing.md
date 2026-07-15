# Load Balancing

## Overview

JobFlow uses load-aware scheduling to distribute work evenly across specialized workers. The load balancing system tracks real-time worker utilization and routes new jobs to the worker best positioned to handle them.

## Load Metrics

Each worker reports these metrics via heartbeat:

| Metric         | Description                                      |
|----------------|--------------------------------------------------|
| `runningJobs`  | Number of jobs currently being processed         |
| `currentLoad`  | Utilization ratio: `runningJobs / concurrency`   |
| `completedJobs`| Lifetime completed job count                     |
| `failedJobs`   | Lifetime failed job count                        |

## How Load Balancing Works

```
Incoming Job (type: EMAIL)
         │
         ▼
   ┌─────────────────────────────────┐
   │     Worker Registry Query       │
   │  Filter: status=READY,          │
   │          supports EMAIL          │
   └──────────────┬──────────────────┘
                  │
         ┌────────┼────────┐
         ▼        ▼        ▼
      Worker A  Worker B  Worker C
      load=0.8  load=0.2  load=0.6
         │        │        │
         │      SELECTED   │
         │   (lowest load) │
         └────────┼────────┘
                  │
                  ▼
          Email Queue → Worker B
```

## Load Tracking Pipeline

1. **Worker starts** → registers with `runningJobs=0, currentLoad=0.0`
2. **Job starts** → worker increments `runningJobs`, updates `currentLoad`
3. **Heartbeat (every 30s)** → worker sends current `runningJobs` and `currentLoad`
4. **Job completes** → worker decrements `runningJobs`, increments `completedJobs`
5. **Worker Registry** syncs in-memory cache every 15 seconds

## Auto-Scaling Hooks

The load metrics are exposed as Prometheus gauges, ready for Kubernetes HPA or KEDA to consume:

```
jobflow_worker_count{status="READY"} 3
jobflow_worker_count{status="BUSY"} 2
jobflow_worker_utilization{worker_id="w-123"} 0.8
jobflow_worker_running_jobs{worker_id="w-123"} 4
```

### KEDA ScaledObject Example (Future)

```yaml
apiVersion: keda.sh/v1alpha1
kind: ScaledObject
metadata:
  name: jobflow-worker-scaler
spec:
  scaleTargetRef:
    name: jobflow-worker
  minReplicaCount: 1
  maxReplicaCount: 10
  triggers:
    - type: prometheus
      metadata:
        serverAddress: http://prometheus:9090
        metricName: queue_waiting
        threshold: "100"
        query: queue_waiting
```

## Graceful Draining

Before scaling down or deploying:

1. `POST /api/v1/workers/:id/drain` → Worker status → `DRAINING`
2. Worker stops pulling new jobs from BullMQ queues
3. Worker finishes all running jobs
4. Worker deregisters and shuts down

No workflows are interrupted during this process.
