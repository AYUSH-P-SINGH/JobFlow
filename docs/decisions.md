# Architecture Design Decisions (ADRs)

This document outlines the technical design decisions, framework choices, and architectural patterns selected for the JobFlow platform.

---

## 1. Why PostgreSQL?
We chose **PostgreSQL** as the primary relational database to persist structural, relational, and audit-sensitive data:
- **ACID Integrity**: Crucial for coordinating multi-step transactions. If a step fails, the transition of the step and the database state logs must occur atomically.
- **Relational Model**: Users, tenants, api-keys, workflows, steps, and history records exhibit strict relationships.
- **Hybrid JSONB**: Allows step inputs/outputs and execution results to be saved dynamically as JSON while retaining SQL query capability.

---

## 2. Why Redis?
We chose **Redis** as the transient memory and event broker:
- **Low Latency**: Key-value lookup speeds (<1ms) are required for rate limiters, active worker tracking, and real-time Socket.IO room maps.
- **Distributed Locking**: Provides standard atomic lock primitives (`SET NX PX`) via Redlock to ensure single-threaded execution tick validation when multiple steps complete concurrently.

---

## 3. Why BullMQ?
We chose **BullMQ** (powered by Redis) as the distributed job execution engine:
- **Reliability & Scalability**: Implements the reliable queue pattern, making sure that if a worker process crashes mid-execution, the job is automatically moved back to the active queue or DLQ.
- **Feature Set**: Built-in support for delayed executions, exponential retry backoff, priority job scheduling, and concurrency rate limits.
- **Loose Coupling**: Worker processors compile completely independently, reading task payloads from BullMQ without referencing the central API server.

---

## 4. Why Repository Pattern?
We chose to decouple data access using the **Repository Pattern** (wrapped around Prisma Client):
- **Encapsulation**: Keeps raw SQL/Prisma queries out of business services.
- **Testability**: Simplifies unit testing by allowing repositories to be mocked or swapped with in-memory databases.

---

## 5. Why State Machine?
We enforced workflow and step transitions via a strict **State Machine**:
- **Execution Safety**: Prevents race conditions from executing invalid state hops (e.g., transitioning a `COMPLETED` step back to `RUNNING`).
- **Audit Trails**: Simplifies state logging by validating states *before* executing writes.

---

## 6. Why Directed Acyclic Graphs (DAGs)?
We modeled workflows as **DAGs**:
- **Complex Orchestration**: Allows modeling of sequential dependencies, parallel branches, and conditional triggers.
- **Loop Prevention**: Cycle-detection algorithms run at creation validation to ensure pipelines never enter infinite loops.
