#!/usr/bin/env bash
# JobFlow Database and State Backup Automation Script

set -eo pipefail

BACKUP_DIR="/tmp/jobflow-backups"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
RETENTION_DAYS=7
DB_CONTAINER_NAME="jobflow-postgres-prod"
REDIS_CONTAINER_NAME="jobflow-redis-prod"

echo "=== Starting JobFlow Backup: ${TIMESTAMP} ==="
mkdir -p "${BACKUP_DIR}"

# 1. Backup PostgreSQL Database
echo "Starting PostgreSQL backup..."
PG_BACKUP_FILE="${BACKUP_DIR}/jobflow_db_${TIMESTAMP}.sql"
if docker ps --format '{{.Names}}' | grep -q "^${DB_CONTAINER_NAME}$"; then
  docker exec "${DB_CONTAINER_NAME}" pg_dump -U postgres jobflow > "${PG_BACKUP_FILE}"
  echo "PostgreSQL backup saved to ${PG_BACKUP_FILE}"
else
  if [ -n "${DATABASE_URL}" ]; then
    pg_dump "${DATABASE_URL}" > "${PG_BACKUP_FILE}"
    echo "PostgreSQL backup (via DATABASE_URL) saved to ${PG_BACKUP_FILE}"
  else
    echo "WARNING: PostgreSQL container not found and DATABASE_URL env not set. Skipping DB dump."
  fi
fi

# Compress database dump
if [ -f "${PG_BACKUP_FILE}" ]; then
  gzip -f "${PG_BACKUP_FILE}"
  echo "PostgreSQL backup compressed: ${PG_BACKUP_FILE}.gz"
fi

# 2. Backup Redis AOF/RDB state
echo "Starting Redis persistence trigger..."
if docker ps --format '{{.Names}}' | grep -q "^${REDIS_CONTAINER_NAME}$"; then
  docker exec "${REDIS_CONTAINER_NAME}" redis-cli bgsave
  echo "Redis BGSAVE triggered."
  
  REDIS_BACKUP_FILE="${BACKUP_DIR}/jobflow_redis_${TIMESTAMP}.aof"
  docker exec "${REDIS_CONTAINER_NAME}" cat /data/appendonly.aof > "${REDIS_BACKUP_FILE}" || true
  if [ -f "${REDIS_BACKUP_FILE}" ]; then
    gzip -f "${REDIS_BACKUP_FILE}"
    echo "Redis data state backup saved and compressed: ${REDIS_BACKUP_FILE}.gz"
  fi
fi

# 3. Clean up old backups (Retention policy)
echo "Applying retention policy (older than ${RETENTION_DAYS} days)..."
find "${BACKUP_DIR}" -type f -mtime +"${RETENTION_DAYS}" -name "jobflow_*" -exec rm -v {} \;

echo "=== JobFlow Backup Completed Successfully at $(date) ==="
