# Register OpenSERP watchdog to start at user logon (always-on sidecar).
$ErrorActionPreference = 'Stop'
$Root = Split-Path -Parent $PSScriptRoot
$Watchdog = Join-Path $Root "scripts\si-serp-watchdog.ps1"
$TaskName = "SocialImperialism-OpenSerpWatchdog"
$Exe = Join-Path $Root "tools\openserp\openserp.exe"
$FallbackExe = "C:\Users\PC54\openserp-study\openserp.exe"

if (-not (Test-Path $Exe) -and -not (Test-Path $FallbackExe)) {
    Write-Host "Run first: npm run si-serp:setup"
    exit 1
}

$action = New-ScheduledTaskAction `
    -Execute "powershell.exe" `
    -Argument "-NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File `"$Watchdog`""

$trigger = New-ScheduledTaskTrigger -AtLogOn -User $env:USERNAME
$settings = New-ScheduledTaskSettingsSet `
    -AllowStartIfOnBatteries `
    -DontStopIfGoingOnBatteries `
    -StartWhenAvailable `
    -RestartCount 3 `
    -RestartInterval (New-TimeSpan -Minutes 1)

Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger $trigger -Settings $settings -Force | Out-Null

$watchdogArgs = "-NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File `"$Watchdog`""
Start-Process powershell.exe -ArgumentList $watchdogArgs -WindowStyle Hidden
& (Join-Path $Root "scripts\start-si-serp-desktop.ps1")

Write-Host "Installed scheduled task: $TaskName"
Write-Host "OpenSERP watchdog started at http://127.0.0.1:7000"
Write-Host ('Remove with: Unregister-ScheduledTask -TaskName ' + $TaskName + ' -Confirm:$false')