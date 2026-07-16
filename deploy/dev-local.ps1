# One-shot local stack: ensure QP env → start Floci → bootstrap bucket → API + web.
# Does NOT deploy Amplify or use paid S3/R2 when QP is active.
param(
  [switch]$SkipFloci,
  [switch]$ForceProvider,
  [switch]$NoWeb
)

$ErrorActionPreference = "Stop"
$RepoRoot = Split-Path $PSScriptRoot -Parent
Set-Location $RepoRoot

Write-Host "=== SI dev:local ===" -ForegroundColor Cyan
Write-Host "Repo: $RepoRoot"

# 1) QP env
$ensureArgs = @("deploy/ensure-qp-env.js")
if ($ForceProvider) { $ensureArgs += "--force-provider" }
Write-Host "`n[1/3] Ensuring QP Floci env in apps/api/.env ..."
node @ensureArgs
if ($LASTEXITCODE -ne 0) { throw "ensure-qp-env failed" }

# 2) Floci emulator
if (-not $SkipFloci) {
  Write-Host "`n[2/3] Starting Floci (local S3) ..."
  if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    Write-Warning "Docker not found — skip Floci. Install Docker Desktop or use -SkipFloci after starting Floci yourself."
  } else {
    try {
      powershell -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot "floci-up.ps1")
    } catch {
      Write-Warning "Floci start failed: $($_.Exception.Message)"
      Write-Warning "Start Docker Desktop, then re-run: npm run floci:up"
    }
  }
} else {
  Write-Host "`n[2/3] Skip Floci (-SkipFloci)"
}

# 3) API + web
Write-Host "`n[3/3] Starting local API + web (no Amplify) ..."
Write-Host "  Web:  http://localhost:3000"
Write-Host "  API:  http://localhost:4000"
Write-Host "  Floci S3: http://127.0.0.1:4566"
Write-Host "  Ctrl+C stops API/web (Floci container keeps running — npm run floci:down to stop)"
Write-Host ""

if ($NoWeb) {
  npm run dev:api
} else {
  npm run dev
}
