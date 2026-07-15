# Heartbeat Mechanism

## Overview

Workers send periodic heartbeat signals to the API server to prove they are alive and operational. If a worker fails to send a heartbeat within the configured threshold, it is automatically marked as `OFFLINE` and its jobs become eligible for failover.

## Configuration

| Constant                       | Value   | Description                          |
|--------------------------------|---------|--------------------------------------|
| `HEARTBEAT_INTERVAL_MS`        | 30,000  | Workers send heartbeat every 30s     |
| `HEARTBEAT_OFFLINE_THRESHOLD_MS` | 90,000 | Worker marked OFFLINE after 90s     |
| `DISCOVERY_SCAN_INTERVAL_MS`   | 30,000  | Server checks for stale workers every 30s |

## Heartbeat Flow

```
Worker Process                    API Server
     │                                 │
     │  POST /workers/:id/heartbeat    │
     │  { runningJobs: 3,              │
     │    completedJobs: 47,           │
     │    failedJobs: 2,               │
     │    currentLoad: 0.6 }           │
     │────────────────────────────────>│
     │                                 │ UPDATE lastHeartbeat, load
     │  200 OK                         │
     │<────────────────────────────────│
     │                                 │
     │    ... 30 seconds pass ...       │
     │                                 │
     │  POST /workers/:id/heartbeat    │
     │────────────────────────────────>│
```

## Stale Detection

The Worker Discovery Service runs a background scan every 30 seconds:

```javascript
// Pseudo-code
const cutoff = new Date(Date.now() - HEARTBEAT_OFFLINE_THRESHOLD_MS);
const staleWorkers = await db.workerNode.findMany({
  where: {
    lastHeartbeat: { lt: cutoff },
    status: { notIn: ['OFFLINE'] },
  },
});

// Mark all stale workers as OFFLINE
await db.workerNode.updateMany({
  where: { id: { in: staleWorkerIds } },
  data: { status: 'OFFLINE' },
});
```

## Worker Resurrection

If a worker that was marked `OFFLINE` sends a heartbeat, it is automatically transitioned back to `READY`:

```
Worker (OFFLINE) → Heartbeat received → Worker (READY)
```

## Failover

When a worker goes OFFLINE, any jobs it was processing may need to be requeued:

1. Discovery Service detects stale heartbeat
2. Worker status → `OFFLINE`
3. `worker.offline` event published
4. BullMQ's built-in stalled job detection handles job requeue
5. Other capable workers pick up the requeued jobs

## Prometheus Metrics

```
jobflow_worker_count{status="OFFLINE"} 1
jobflow_worker_failovers_total 3
```
