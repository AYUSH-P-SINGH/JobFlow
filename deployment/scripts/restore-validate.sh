#!/usr/bin/env bash
# JobFlow Database Backup Restoration Validation Script

set -eo pipefail

BACKUP_DIR="/tmp/jobflow-backups"
TEST_DB_NAME="jobflow_restore_test"

echo "=== Starting Database Backup Restoration Validation ==="

# 1. Locate the latest database backup file
LATEST_BACKUP=$(ls -t "${BACKUP_DIR}"/jobflow_db_*.sql.gz 2>/dev/null | head -n 1)

if [ -z "${LATEST_BACKUP}" ]; then
  echo "ERROR: No PostgreSQL backup file (.sql.gz) found in ${BACKUP_DIR}."
  exit 1
fi

echo "Found latest database backup: ${LATEST_BACKUP}"

# 2. Prepare temporary SQL file location
TEMP_SQL="/tmp/jobflow_restore_temp.sql"
echo "Decompressing backup dump..."
gunzip -c "${LATEST_BACKUP}" > "${TEMP_SQL}"

# 3. Create a clean, temporary database for recovery validation
echo "Recreating validation database: ${TEST_DB_NAME}..."
psql -U postgres -c "DROP DATABASE IF EXISTS ${TEST_DB_NAME};"
psql -U postgres -c "CREATE DATABASE ${TEST_DB_NAME};"

# 4. Import the schema and data into the temporary database
echo "Restoring backup data into validation database..."
psql -U postgres -d "${TEST_DB_NAME}" -f "${TEMP_SQL}"

# 5. Assert database health and verify tables
echo "Validating restored tables count..."
TABLES_COUNT=$(psql -U postgres -d "${TEST_DB_NAME}" -t -A -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';")

echo "Validation Result: Restored database contains ${TABLES_COUNT} tables."

if [ "${TABLES_COUNT}" -gt 0 ]; then
  echo "SUCCESS: Backup validation checks PASSED. Database restored successfully."
else
  echo "FAILURE: Backup validation checks FAILED. Restored database contains no tables."
  exit 1
fi

# 6. Cleanup temporary SQL file and database
echo "Cleaning up validation resources..."
rm -f "${TEMP_SQL}"
psql -U postgres -c "DROP DATABASE IF EXISTS ${TEST_DB_NAME};"

echo "=== Backup Restoration Validation Completed Successfully ==="
