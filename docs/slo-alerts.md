# Service Level Objectives (SLOs) & Alerting Strategy

This document details the Service Level Objectives (SLOs), Service Level Indicators (SLIs), and Alerting thresholds defined for JobFlow.

---

## 1. Service Level Objectives (SLOs)

JobFlow defines three core SLOs to guarantee platform reliability, latency control, and queue speed.

| Objective Name | target | SLI Definition | Prometheus Metric Query |
|---|---|---|---|
| **Workflow Success Rate** | **99.9%** | % of completed workflows that did not fail due to engine errors. | `sum(rate(jobflow_workflows_total{status="completed"}[5m])) / sum(rate(jobflow_workflows_total[5m])) * 100` |
| **API Request Latency** | **99.0% < 200ms** | % of HTTP requests to the REST API completing in less than 200ms. | `sum(rate(http_request_duration_seconds_bucket{le="0.2"}[5m])) / sum(rate(http_request_duration_seconds_count[5m])) * 100` |
| **Job Queue Delay** | **95.0% < 5.0s** | % of jobs transitioning from QUEUED to RUNNING in under 5 seconds. | `sum(rate(jobflow_job_queue_delay_seconds_bucket{le="5.0"}[5m])) / sum(rate(jobflow_job_queue_delay_seconds_count[5m])) * 100` |

---

## 2. Prometheus Alerting Rules

Below are the Prometheus alerting thresholds configured in the Alertmanager config.

### Alert: WorkflowFailureRateHigh
- **Expression:** `sum(rate(jobflow_workflows_total{status="failed"}[5m])) / sum(rate(jobflow_workflows_total[5m])) > 0.001`
- **For:** 2m
- **Severity:** Critical
- **Description:** Workflow failure rate has exceeded the 0.1% error budget limit.

### Alert: ApiLatencyHigh
- **Expression:** `histogram_quantile(0.99, sum(rate(http_request_duration_seconds_bucket[5m])) by (le)) > 0.2`
- **For:** 5m
- **Severity:** Warning
- **Description:** 99th percentile of API response latency is greater than 200ms.

### Alert: JobQueueDelayHigh
- **Expression:** `histogram_quantile(0.95, sum(rate(jobflow_job_queue_delay_seconds_bucket[5m])) by (le)) > 5.0`
- **For:** 3m
- **Severity:** Warning
- **Description:** 95% of jobs are waiting in the queue for longer than 5 seconds.

### Alert: WorkerProcessCrash
- **Expression:** `up{job="jobflow-worker"} == 0`
- **For:** 1m
- **Severity:** Critical
- **Description:** A JobFlow background worker process has exited or cannot be reached.

---

## 3. Incident Routing & PagerDuty Integration

All alerts are classified by severity and routed accordingly:
- **Severity: Critical (P1)**: Page on-call engineers immediately via PagerDuty/Opsgenie. Trigger webhook restarts (K8s pod recycle).
- **Severity: Warning (P2)**: Dispatch slack notification to `#jobflow-alerts` channel. Create a ticket in Jira.
