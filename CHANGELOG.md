# Changelog

All notable changes to the JobFlow project will be documented in this file.

## [1.0.0] - 2026-07-17
### Added
*   **Production React Dashboard**: Completed a dark-themed visual dashboard SPA in `frontend/` powered by Vite.
*   **Visual DAG Workflow Builder**: An interactive flow builder inside the dashboard allowing developers to visually construct pipeline steps, priorities, and dependency rules.
*   **CSV Batch Job Importer**: Built a schema validator and importer supporting file-based imports with completion alerts and reports.
*   **Worker Registry Client & CLI**: Extended the JS SDK and `jobflow` CLI with `create`, `workflow`, and `worker` commands.
*   **Kubernetes Probes**: Implemented standard liveness probe `/live` for failover mapping.
*   **Database Query Indexes**: Added Postgres indexes for status fields, tenant keys, and step foreign relations.
*   **Active CI/CD Pipeline**: Configured active GitHub Actions workflow compiling and building docker images for both backend and frontend.

### Changed
*   **Winston Structured Logging**: Enhanced backend logger to capture and format context variables (`requestId`, `workflowId`, `workerId`, `jobId`, `executionTime`).
*   **Security Header Hardenings**: Reinforced validation logic for env variables on boot and password registration complexity limits.
