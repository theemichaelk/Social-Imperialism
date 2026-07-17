# Zero-touch local stack:
#   Docker Desktop (auto-start) → QP .env → Floci S3 → API + web
# No Amplify. No paid S3 when STORAGE_PROVIDER=floci.
param(
  [switch]$SkipFloci,
  [switch]$ForceProvider,
  [switch]$NoWeb,
  [switch]$ReadyOnly
)

$ErrorActionPreference = "Continue"
$RepoRoot = Split-Path $PSScriptRoot -Parent
Set-Location $RepoRoot

function Write-Step($n, $msg) {
  Write-Host ""
  Write-Host "[$n] $msg" -ForegroundColor Cyan
}

Write-Host "========================================" -ForegroundColor Green
Write-Host " Social Imperialism — zero-touch local "
Write-Host "========================================" -ForegroundColor Green
Write-Host "Repo: $RepoRoot"

# ── 1) QP env (always force floci for local zero-touch) ──
Write-Step "1/4" "QP env (apps/api/.env) ..."
node (Join-Path $RepoRoot "deploy\ensure-qp-env.js") --force-provider
if ($LASTEXITCODE -ne 0) {
  Write-Warning "qp:ensure failed (exit $LASTEXITCODE) — continuing"
}

# ── 2) Docker ──
$dockerOk = $false
if (-not $SkipFloci) {
  Write-Step "2/4" "Docker Desktop ..."
  & powershell -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot "ensure-docker.ps1")
  $dockerOk = ($LASTEXITCODE -eq 0)
} else {
  Write-Step "2/4" "Docker skipped (-SkipFloci)"
}

# ── 3) Floci ──
if (-not $SkipFloci -and $dockerOk) {
  Write-Step "3/4" "Floci local S3 (:4566) ..."
  & powershell -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot "floci-up.ps1")
  if ($LASTEXITCODE -ne 0) {
    Write-Warning "Floci up returned $LASTEXITCODE — API may fall back if R2 keys exist"
  }
} elseif (-not $SkipFloci) {
  Write-Step "3/4" "Floci skipped (Docker not ready)"
  Write-Warning "Start Docker Desktop once, leave it running — next npm run dev will attach Floci automatically."
} else {
  Write-Step "3/4" "Floci skipped"
}

if ($ReadyOnly) {
  Write-Host ""
  Write-Host "Ready-only complete. Run: npm run dev:app" -ForegroundColor Green
  exit 0
}

# ── 4) API + web ──
Write-Step "4/4" "Starting API + web (no Amplify) ..."
Write-Host "  Web   http://localhost:3000"
Write-Host "  API   http://localhost:4000"
Write-Host "  Floci http://127.0.0.1:4566  (if Docker was ready)"
Write-Host "  Ctrl+C stops API/web. Floci container keeps running (npm run floci:down to stop)."
Write-Host ""

# Ensure child processes see Floci routing even if .env was incomplete mid-load
$env:STORAGE_PROVIDER = "floci"
$env:SI_STORAGE_PROVIDER = "floci"
$env:FLOCI_ENDPOINT = "http://127.0.0.1:4566"
$env:AWS_S3_ENDPOINT = "http://127.0.0.1:4566"
$env:AWS_S3_FORCE_PATH_STYLE = "true"
if (-not $env:AWS_S3_BUCKET_NAME) { $env:AWS_S3_BUCKET_NAME = "social-imperialism" }
if (-not $env:AWS_ACCESS_KEY_ID) { $env:AWS_ACCESS_KEY_ID = "test" }
if (-not $env:AWS_SECRET_ACCESS_KEY) { $env:AWS_SECRET_ACCESS_KEY = "test" }
if (-not $env:AWS_S3_PUBLIC_BASE_URL) { $env:AWS_S3_PUBLIC_BASE_URL = "http://127.0.0.1:4566/social-imperialism" }

if ($NoWeb) {
  npm run dev:api
} else {
  npm run dev:app
}
