# Social Imperialism — open on iPhone (Safari OR Expo Go)
$ErrorActionPreference = "Continue"
Set-Location $PSScriptRoot

$ip = (Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.IPAddress -like '192.168.*' } | Select-Object -First 1).IPAddress
if (-not $ip) { $ip = "127.0.0.1" }

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Social Imperialism — iPhone Preview" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "OPTION A — Safari (recommended, no Expo Go):" -ForegroundColor Green
Write-Host "  1. iPhone + PC on SAME Wi-Fi" -ForegroundColor Yellow
Write-Host "  2. Open Safari and go to:" -ForegroundColor Yellow
Write-Host ""
Write-Host "     http://${ip}:8081" -ForegroundColor White -BackgroundColor DarkGreen
Write-Host ""
Write-Host "OPTION B — Expo Go:" -ForegroundColor Green
Write-Host "  Enter URL manually:" -ForegroundColor Yellow
Write-Host "     exp://${ip}:8081" -ForegroundColor White
Write-Host ""
Write-Host "Keep this window open. Ctrl+C to stop." -ForegroundColor Gray
Write-Host ""

npx expo start --lan --port 8081