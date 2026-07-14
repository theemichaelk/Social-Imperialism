# Start shared local OpenSERP on port 7000 (Quantum, Social Imperialism, Autonomous Ghost)
$Root = Split-Path -Parent $PSScriptRoot
$SerpDir = Join-Path $Root "tools\openserp"
$Exe = Join-Path $SerpDir "openserp.exe"
$FallbackExe = "C:\Users\PC54\openserp-study\openserp.exe"
$BaseUrl = "http://127.0.0.1:7000"

if (-not (Test-Path $Exe)) {
    if (Test-Path $FallbackExe) {
        $Exe = $FallbackExe
        $SerpDir = Split-Path -Parent $FallbackExe
    } else {
        Write-Host "OpenSERP not installed. Run: npm run si-serp:setup"
        exit 1
    }
}

$existing = Get-NetTCPConnection -LocalPort 7000 -State Listen -ErrorAction SilentlyContinue
if ($existing) {
    Write-Host "OpenSERP already listening on $BaseUrl"
    exit 0
}

Write-Host "Starting OpenSERP at $BaseUrl ..."
Start-Process -FilePath $Exe -ArgumentList "serve","-a","127.0.0.1","-p","7000" -WorkingDirectory $SerpDir -WindowStyle Hidden
Start-Sleep -Seconds 5

try {
    $health = Invoke-WebRequest -Uri "$BaseUrl/health" -TimeoutSec 15 -UseBasicParsing
    Write-Host "Health OK ($($health.StatusCode)) - OpenSERP ready"
} catch {
    Write-Host "Server starting. Probe: curl.exe $BaseUrl/health"
}