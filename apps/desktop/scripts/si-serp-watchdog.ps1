# Keeps local OpenSERP running on port 7000 for Social Imperialism.
$ErrorActionPreference = 'SilentlyContinue'
$StartScript = Join-Path (Split-Path -Parent $PSScriptRoot) "scripts\start-si-serp-desktop.ps1"
$HealthUrl = "http://127.0.0.1:7000/health"
$IntervalSec = 30

function Test-SerpHealthy {
    try {
        $r = Invoke-WebRequest -Uri $HealthUrl -TimeoutSec 8 -UseBasicParsing
        return $r.StatusCode -eq 200
    } catch {
        return $false
    }
}

while ($true) {
    if (-not (Test-SerpHealthy)) {
        Write-Host "[$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')] OpenSERP down - restarting..."
        & $StartScript
        Start-Sleep -Seconds 8
    }
    Start-Sleep -Seconds $IntervalSec
}