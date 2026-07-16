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
    node deploy/floci-bootstrap.mjs
  } finally {
    Pop-Location
  }
}

Write-Host ""
Write-Host "QP (Quick Path) local env — add to apps/api/.env (and desktop if needed):"
Write-Host @"
STORAGE_PROVIDER=floci
FLOCI_ENDPOINT=http://127.0.0.1:4566
AWS_S3_ENDPOINT=http://127.0.0.1:4566
AWS_S3_FORCE_PATH_STYLE=true
AWS_S3_BUCKET_NAME=social-imperialism
AWS_S3_REGION=us-east-1
AWS_ACCESS_KEY_ID=test
AWS_SECRET_ACCESS_KEY=test
AWS_S3_UPLOAD_PREFIX=social-imperialism/uploads
AWS_S3_PUBLIC_BASE_URL=http://127.0.0.1:4566/social-imperialism
# Leave CLOUDFLARE_R2_* empty or unset for local free storage
"@
Write-Host "Then: npm run dev   (API + web locally — no Amplify deploys)"
Write-Host "Go-live still uses Amplify + real S3/R2 (STORAGE_PROVIDER=auto or s3/r2)."
