#!/usr/bin/env bash
# JobFlow Release Notes and Changelog Generation Script

set -eo pipefail

OUTPUT_FILE="CHANGELOG.md"
RELEASE_NOTES_FILE="RELEASE_NOTES.md"

echo "=== Generating Release Changelog ==="

# Get latest tag or default to first commit
LATEST_TAG=$(git describe --tags --abbrev=0 2>/dev/null || echo "")
PREVIOUS_TAG=$(git describe --tags --abbrev=0 "${LATEST_TAG}^" 2>/dev/null || echo "")

if [ -z "${LATEST_TAG}" ]; then
  echo "No Git tags found. Generating changelog from full git commit history..."
  COMMIT_RANGE="HEAD"
else
  if [ -z "${PREVIOUS_TAG}" ]; then
    echo "First tag detected: ${LATEST_TAG}. Generating from history up to tag..."
    COMMIT_RANGE="${LATEST_TAG}"
  else
    echo "Generating changelog between ${PREVIOUS_TAG} and ${LATEST_TAG}..."
    COMMIT_RANGE="${PREVIOUS_TAG}..${LATEST_TAG}"
  fi
fi

# 1. Output Changelog Header
{
  echo "# Changelog"
  echo ""
  echo "All notable changes to the JobFlow Developer Platform will be documented in this file."
  echo "Generated dynamically on $(date +'%Y-%m-%d %H:%M:%S')"
  echo ""
  echo "## [v2.0.0] - $(date +'%Y-%m-%d')"
  echo ""
} > "${OUTPUT_FILE}"

# 2. Extract commit logs grouped by categories
echo "### Features" >> "${OUTPUT_FILE}"
git log "${COMMIT_RANGE}" --grep="^feat" --pretty=format:"- %s (%h) - %an" >> "${OUTPUT_FILE}" || true
echo "" >> "${OUTPUT_FILE}"
echo "" >> "${OUTPUT_FILE}"

echo "### Bug Fixes" >> "${OUTPUT_FILE}"
git log "${COMMIT_RANGE}" --grep="^fix" --pretty=format:"- %s (%h) - %an" >> "${OUTPUT_FILE}" || true
echo "" >> "${OUTPUT_FILE}"
echo "" >> "${OUTPUT_FILE}"

echo "### Documentation" >> "${OUTPUT_FILE}"
git log "${COMMIT_RANGE}" --grep="^docs" --pretty=format:"- %s (%h) - %an" >> "${OUTPUT_FILE}" || true
echo "" >> "${OUTPUT_FILE}"
echo "" >> "${OUTPUT_FILE}"

echo "### SRE & Reliability" >> "${OUTPUT_FILE}"
git log "${COMMIT_RANGE}" --grep="^test\|^ci" --pretty=format:"- %s (%h) - %an" >> "${OUTPUT_FILE}" || true
echo "" >> "${OUTPUT_FILE}"
echo "" >> "${OUTPUT_FILE}"

echo "SUCCESS: ${OUTPUT_FILE} generated."

# 3. Create short-form release summary
{
  echo "# Release Notes - JobFlow Platform v2.0"
  echo ""
  echo "We are thrilled to announce the v2.0 release of **JobFlow**—transforming the workflow orchestrator into a cloud-native developer platform and custom plugin ecosystem."
  echo ""
  echo "### 🌟 Highlights"
  echo "- **AI-Powered Workflow Generation:** Convert natural language scripts into fully structured DAG workflows."
  echo "- **Extensible Plugin SDK:** Write custom plugins implementing interfaces to integrate custom handlers."
  echo "- **Multi-Language Bindings:** Ship Go, Python, and Java client libraries."
  echo "- **SRE Simulation & Diagnostics:** Check dependency cycles, estimate runtime, and replay failed step runs without repeating completed executions."
  echo ""
  echo "Detailed commits list can be viewed inside \`CHANGELOG.md\`."
} > "${RELEASE_NOTES_FILE}"

echo "SUCCESS: ${RELEASE_NOTES_FILE} generated."
echo "=== Release Automation Completed Successfully ==="
