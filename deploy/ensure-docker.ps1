# Ensure Docker Desktop is running (Windows). Exit 0 = ready, 1 = not ready.
param(
  [int]$TimeoutSec = 180
)

$ErrorActionPreference = "Continue"

function Test-DockerReady {
  try {
    docker info 1>$null 2>$null
    return ($LASTEXITCODE -eq 0)
  } catch {
    return $false
  }
}

if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
  Write-Warning "Docker CLI not found. Install Docker Desktop: https://www.docker.com/products/docker-desktop/"
  exit 1
}

if (Test-DockerReady) {
  Write-Host "[docker] ready"
  exit 0
}

$candidates = @(
  "$env:ProgramFiles\Docker\Docker\Docker Desktop.exe",
  "${env:ProgramFiles(x86)}\Docker\Docker\Docker Desktop.exe",
  "$env:LOCALAPPDATA\Docker\Docker Desktop.exe"
)
$exe = $candidates | Where-Object { Test-Path $_ } | Select-Object -First 1

if (-not $exe) {
  Write-Warning "Docker Desktop.exe not found. Install Docker Desktop, then re-run."
  exit 1
}

Write-Host "[docker] starting Docker Desktop (first launch can take 1–3 minutes)..."
Start-Process -FilePath $exe -ErrorAction SilentlyContinue | Out-Null

$deadline = (Get-Date).AddSeconds($TimeoutSec)
$n = 0
while ((Get-Date) -lt $deadline) {
  $n++
  if (Test-DockerReady) {
    Write-Host "[docker] ready"
    exit 0
  }
  if ($n % 5 -eq 0) {
    $elapsed = [int]((Get-Date) - $deadline.AddSeconds(-$TimeoutSec)).TotalSeconds
    Write-Host "[docker] waiting for engine... ${elapsed}s"
  }
  Start-Sleep -Seconds 3
}

Write-Warning "[docker] timed out after ${TimeoutSec}s. Open Docker Desktop, wait until it is Running, then run npm run dev again."
exit 1
