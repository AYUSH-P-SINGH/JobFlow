# Load Testing Guide

This guide details the load testing procedures for JobFlow using the configured `k6` script.

## Load Test Setup
The load testing suite uses [k6](https://k6.io/) to simulate concurrent users logging in, creating execution graphs (DAGs), and querying statuses.

The script is located at: `backend/tests/load/k6-load-test.js`.

### Target Ramping States
The testing targets are divided into three validation limits:
1.  **Low Load (10-20 Concurrent Users)**: Validates basic round-trip REST latency.
2.  **Medium Load (50 Concurrent Users)**: Validates concurrent database connection pools and Redis queue enqueuing.
3.  **High Load (100+ Concurrent Users)**: Measures worker scaling bottlenecks and maximum connection pool exhaust limits.

---

## Running the Load Test

### Prerequisite
Ensure the target server is started:
```bash
# Production Compose stack
docker compose -f docker-compose.prod.yml up --build -d
```

### Running with k6 CLI
Run the load test directly from your local terminal pointing to the target URL:
```bash
k6 run -e API_URL=http://localhost:5000 backend/tests/load/k6-load-test.js
```

---

## Output Metrics & Validation Limits
The load test enforces the following service-level thresholds:
*   `http_req_failed`: Less than **1%** error rate allowed.
*   `http_req_duration`: **95%** of requests must complete under **500ms** (`p(95) < 500`).

### Measured KPI Parameters
*   **Throughput**: Transactions completed per second (RPS).
*   **Request Latency**: P50, P90, P95, and P99 latency values.
*   **Queue Wait Time**: Delay between enqueuing and worker lock receipt.
*   **Worker Utilization**: Capacity processing loads recorded in the worker dashboard.
