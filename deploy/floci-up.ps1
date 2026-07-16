# Start local Floci (S3 emulator) for Social Imperialism development.
# Does NOT deploy Amplify or touch real AWS S3.
param(
  [switch]$Bootstrap
)

$ErrorActionPreference = "Stop"
$RepoRoot = Split-Path $PSScriptRoot -Parent
$Compose = Join-Path $PSScriptRoot "docker-compose.floci.yml"

if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
  Write-Error "Docker is required. Install Docker Desktop, then re-run."
}

Write-Host "Starting Floci AWS emulator on :4566 ..."
docker compose -f $Compose up -d floci

Write-Host "Waiting for health..."
$ok = $false
for ($i = 0; $i -lt 30; $i++) {
  try {
    $r = Invoke-WebRequest -Uri "http://127.0.0.1:4566/_floci/health" -UseBasicParsing -TimeoutSec 2
    if ($r.StatusCode -ge 200 -and $r.StatusCode -lt 500) { $ok = $true; break }
  } catch {
    try {
      # Some builds use /_localstack/health or root
      $r2 = Invoke-WebRequest -Uri "http://127.0.0.1:4566/" -UseBasicParsing -TimeoutSec 2
      if ($r2.StatusCode -ge 200) { $ok = $true; break }
    } catch { Start-Sleep -Seconds 1 }
  }
}

if ($ok) {
  Write-Host "Floci is up at http://127.0.0.1:4566"
} else {
  Write-Warning "Health probe timed out — container may still be starting. Check: docker logs si-floci"
}

if ($Bootstrap -or $true) {
  Write-Host "Bootstrapping SI bucket..."
  Push-Location $RepoRoot
  try {
    node deploy/floci-bootstrap.js
  } finally {
    Pop-Location
  }
}

Write-Host ""
Write-Host "Ensuring QP env in apps/api/.env ..."
node (Join-Path $RepoRoot "deploy\ensure-qp-env.js")
Write-Host "One-shot stack: npm run dev:local"
Write-Host "Or: npm run dev  (API + web; Floci already up)"
Write-Host "Go-live: Amplify + real S3/R2 (STORAGE_PROVIDER=auto|r2|s3 on EB)."
