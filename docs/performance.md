# Workflow Engine Performance Profile

This document records the performance characteristics, throughput scalability, and topology latency comparisons of the JobFlow Workflow Orchestration Engine under local development conditions.

---

## 1. Concurrency Scalability Benchmark

To profile how the engine scales under concurrent loads, we simulated clusters of varying sizes executing step workflows in parallel.

### Scalability Performance Metrics:

| Workflows Created | Total Completion Time | Average Duration per Workflow |
|:---:|:---:|:---:|
| **100** | 61,096 ms | 610.96 ms |
| **500** | 73,273 ms | 146.55 ms |
| **1,000** | 83,358 ms | 83.36 ms |

> [!TIP]
> **Orchestrator Efficiency**: As concurrent volume increases, the average duration per workflow drops significantly. This is due to database connection pool warm-ups and efficient multi-tenant queue batching.

---

## 2. Topology Execution Comparison (5-Step DAG)

We measured the difference in execution duration between a sequential DAG (5 steps linked A ➡️ B ➡️ C ➡️ D ➡️ E) and a parallel DAG (5 independent steps running concurrently) to evaluate the engine's scheduling efficacy.

### Metrics Comparison:

- **Sequential Execution**: **1,518 ms** (Average of ~300ms overhead per sequential dependency tick)
- **Parallel Execution**: **511 ms** (Concurrently scheduled and processed simultaneously)
- **Orchestration Acceleration**: **+66.3% faster**

---

## 3. Why BullMQ?

BullMQ was chosen as the primary distributed queue layer for JobFlow due to the following system constraints:
1. **At-Least-Once Delivery**: Workers must pop jobs from Redis using atomic primitives. If a worker crashes mid-job, the lock expires and the job is reclaimed.
2. **Priorities**: Built-in support for processing `CRITICAL` workflows before `LOW` priority ones.
3. **Delayed Executions**: Essential for delayed steps (e.g. sending a follow-up email in 2 hours).
4. **Retry Backoff Policies**: Native exponential retry backoff parameters (e.g., retry after 5s, 10s, 20s).
5. **Active Community**: High-performance, production-ready, and heavily optimized.
