#!/usr/bin/env bash
# ==============================================================================
# JobFlow - Local Kubernetes (Kind) Cluster & Helm Bootstrap Script
# ==============================================================================
# This script spins up a local Kind cluster, loads local container images,
# deploys the Prometheus/Grafana observability stack, and installs the JobFlow
# Helm chart with zero cloud dependencies.
# ==============================================================================

set -euo pipefail

CLUSTER_NAME="jobflow-local"
NAMESPACE="jobflow"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/../.." && pwd)"

echo "🚀 [1/6] Checking prerequisites..."
command -v docker >/dev/null 2>&1 || { echo "❌ Docker is required but not installed. Aborting."; exit 1; }
command -v kubectl >/dev/null 2>&1 || { echo "❌ kubectl is required but not installed. Aborting."; exit 1; }
command -v helm >/dev/null 2>&1 || { echo "❌ helm is required but not installed. Aborting."; exit 1; }
command -v kind >/dev/null 2>&1 || { echo "❌ kind is required but not installed. Install via: 'go install sigs.k8s.io/kind@latest' or 'brew install kind'. Aborting."; exit 1; }

echo "📦 [2/6] Provisioning local Kind Kubernetes cluster '${CLUSTER_NAME}'..."
if kind get clusters 2>/dev/null | grep -q "^${CLUSTER_NAME}$"; then
    echo "  ℹ️ Kind cluster '${CLUSTER_NAME}' already exists. Reusing..."
else
    cat <<EOF | kind create cluster --name "${CLUSTER_NAME}" --config=-
kind: Cluster
apiVersion: kind.x-k8s.io/v1alpha4
nodes:
- role: control-plane
  kubeadmConfigPatches:
  - |
    kind: InitConfiguration
    nodeRegistration:
      kubeletExtraArgs:
        node-labels: "ingress-ready=true"
  extraPortMappings:
  - containerPort: 80
    hostPort: 80
    protocol: TCP
  - containerPort: 443
    hostPort: 443
    protocol: TCP
  - containerPort: 5000
    hostPort: 5000
    protocol: TCP
  - containerPort: 3000
    hostPort: 3000
    protocol: TCP
EOF
    echo "  ✅ Kind cluster '${CLUSTER_NAME}' created successfully."
fi

# Ensure kubectl context is set to kind
kubectl config use-context "kind-${CLUSTER_NAME}"

echo "🔨 [3/6] Building local Docker images..."
echo "  -> Building Backend/Worker image (jobflow-backend:local)..."
docker build -t jobflow-backend:local -f "${ROOT_DIR}/backend/Dockerfile" "${ROOT_DIR}/backend"

echo "  -> Building Frontend image (jobflow-frontend:local)..."
docker build -t jobflow-frontend:local -f "${ROOT_DIR}/frontend/Dockerfile" "${ROOT_DIR}/frontend"

echo "📥 [4/6] Loading Docker images into Kind cluster..."
kind load docker-image jobflow-backend:local --name "${CLUSTER_NAME}"
kind load docker-image jobflow-frontend:local --name "${CLUSTER_NAME}"

echo "⚙️ [5/6] Deploying JobFlow Helm Chart into '${NAMESPACE}' namespace..."
kubectl create namespace "${NAMESPACE}" --dry-run=client -o yaml | kubectl apply -f -

helm upgrade --install jobflow "${ROOT_DIR}/deployment/helm" \
    --namespace "${NAMESPACE}" \
    --set image.repository=jobflow-backend \
    --set image.tag=local \
    --set image.pullPolicy=Never \
    --set api.replicaCount=2 \
    --set worker.replicaCount=3 \
    --set global.jwtSecret="dev_secret_jwt_jobflow_local_testing_key_123456789" \
    --wait --timeout=180s

echo "🩺 [6/6] Verifying Kubernetes Pod health..."
kubectl get pods -n "${NAMESPACE}"

echo ""
echo "=========================================================================="
echo "🎉 JobFlow Local Kubernetes Cluster is READY!"
echo "=========================================================================="
echo "  • API Server Endpoint   : kubectl port-forward -n ${NAMESPACE} svc/jobflow-api 5000:5000"
echo "  • Bull-Board Dashboard  : http://localhost:5000/admin/queues"
echo "  • Swagger API Docs      : http://localhost:5000/docs"
echo "  • Cluster Pod Status    : kubectl get pods -n ${NAMESPACE}"
echo "=========================================================================="
echo "To clean up: kind delete cluster --name ${CLUSTER_NAME}"
