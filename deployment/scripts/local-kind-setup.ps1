# ==============================================================================
# JobFlow - Local Kubernetes (Kind) Cluster & Helm Bootstrap Script (PowerShell)
# ==============================================================================

param (
    [string]$ClusterName = "jobflow-local",
    [string]$Namespace = "jobflow"
)

$ErrorActionPreference = "Stop"

Write-Host "🚀 [1/6] Checking prerequisites..." -ForegroundColor Cyan
if (-not (Get-Command docker -ErrorAction SilentlyContinue)) { Write-Error "Docker is required but not installed."; exit 1 }
if (-not (Get-Command kubectl -ErrorAction SilentlyContinue)) { Write-Error "kubectl is required but not installed."; exit 1 }
if (-not (Get-Command helm -ErrorAction SilentlyContinue)) { Write-Error "helm is required but not installed."; exit 1 }
if (-not (Get-Command kind -ErrorAction SilentlyContinue)) { Write-Error "kind is required. Install via: 'choco install kind' or 'winget install Kubernetes.kind'"; exit 1 }

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$RootDir = Resolve-Path "$ScriptDir\..\.."

Write-Host "📦 [2/6] Provisioning local Kind Kubernetes cluster '$ClusterName'..." -ForegroundColor Cyan
$existingClusters = kind get clusters 2>$null
if ($existingClusters -contains $ClusterName) {
    Write-Host "  ℹ️ Kind cluster '$ClusterName' already exists. Reusing..." -ForegroundColor Yellow
} else {
    $kindConfig = @"
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
"@
    $kindConfigFile = [System.IO.Path]::GetTempFileName()
    Set-Content -Path $kindConfigFile -Value $kindConfig
    kind create cluster --name $ClusterName --config $kindConfigFile
    Remove-Item $kindConfigFile
    Write-Host "  ✅ Kind cluster '$ClusterName' created successfully." -ForegroundColor Green
}

kubectl config use-context "kind-$ClusterName"

Write-Host "🔨 [3/6] Building local Docker images..." -ForegroundColor Cyan
Write-Host "  -> Building Backend/Worker image (jobflow-backend:local)..."
docker build -t jobflow-backend:local -f "$RootDir\backend\Dockerfile" "$RootDir\backend"

Write-Host "  -> Building Frontend image (jobflow-frontend:local)..."
docker build -t jobflow-frontend:local -f "$RootDir\frontend\Dockerfile" "$RootDir\frontend"

Write-Host "📥 [4/6] Loading Docker images into Kind cluster..." -ForegroundColor Cyan
kind load docker-image jobflow-backend:local --name $ClusterName
kind load docker-image jobflow-frontend:local --name $ClusterName

Write-Host "⚙️ [5/6] Deploying JobFlow Helm Chart into '$Namespace' namespace..." -ForegroundColor Cyan
kubectl create namespace $Namespace --dry-run=client -o yaml | kubectl apply -f -

helm upgrade --install jobflow "$RootDir\deployment\helm" `
    --namespace $Namespace `
    --set image.repository=jobflow-backend `
    --set image.tag=local `
    --set image.pullPolicy=Never `
    --set api.replicaCount=2 `
    --set worker.replicaCount=3 `
    --set global.jwtSecret="dev_secret_jwt_jobflow_local_testing_key_123456789" `
    --wait --timeout=180s

Write-Host "🩺 [6/6] Verifying Kubernetes Pod health..." -ForegroundColor Cyan
kubectl get pods -n $Namespace

Write-Host ""
Write-Host "==========================================================================" -ForegroundColor Green
Write-Host "🎉 JobFlow Local Kubernetes Cluster is READY!" -ForegroundColor Green
Write-Host "==========================================================================" -ForegroundColor Green
Write-Host "  • Port-Forward API      : kubectl port-forward -n $Namespace svc/jobflow-api 5000:5000"
Write-Host "  • Bull-Board Dashboard  : http://localhost:5000/admin/queues"
Write-Host "  • Swagger API Docs      : http://localhost:5000/docs"
Write-Host "  • Cluster Pod Status    : kubectl get pods -n $Namespace"
Write-Host "==========================================================================" -ForegroundColor Green
Write-Host "To clean up: kind delete cluster --name $ClusterName" -ForegroundColor Yellow
