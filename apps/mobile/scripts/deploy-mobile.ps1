# Build Expo web static export and publish to S3 + web public/mobile
# Usage: powershell -ExecutionPolicy Bypass -File apps/mobile/scripts/deploy-mobile.ps1

$ErrorActionPreference = "Stop"

# scripts/ -> mobile/ -> apps/ -> repo root
$Mobile = Split-Path $PSScriptRoot -Parent
$Root = Split-Path (Split-Path $Mobile -Parent) -Parent
$WebPublicMobile = Join-Path $Root "apps\web\public\mobile"
$Bucket = "social-imperialism"
$Region = "us-east-1"

Write-Host "=== Social Imperialism Mobile Deploy ===" -ForegroundColor Cyan
Write-Host "Root:   $Root"
Write-Host "Mobile: $Mobile"

if (-not (Test-Path (Join-Path $Mobile "package.json"))) {
  throw "Mobile package.json not found at $Mobile"
}

Set-Location $Mobile

Write-Host "`n[1/5] Typecheck..." -ForegroundColor Yellow
npx tsc --noEmit
if ($LASTEXITCODE -ne 0) { throw "Typecheck failed" }

Write-Host "`n[2/5] Expo export (web static)..." -ForegroundColor Yellow
$distPath = Join-Path $Mobile "dist"
if (Test-Path $distPath) {
  Remove-Item -Recurse -Force $distPath
}
if (-not $env:EXPO_PUBLIC_API_URL) { $env:EXPO_PUBLIC_API_URL = "https://api.socialimperialism.com" }
if (-not $env:EXPO_PUBLIC_WEB_URL) { $env:EXPO_PUBLIC_WEB_URL = "https://www.socialimperialism.com" }
npx expo export --platform web
if ($LASTEXITCODE -ne 0) { throw "Expo export failed" }

if (-not (Test-Path $distPath)) { throw "dist/ missing after export" }

Write-Host "`n[3/5] Copy to apps/web/public/mobile..." -ForegroundColor Yellow
if (Test-Path $WebPublicMobile) {
  Remove-Item -Recurse -Force $WebPublicMobile
}
New-Item -ItemType Directory -Force -Path $WebPublicMobile | Out-Null
Copy-Item -Path (Join-Path $distPath "*") -Destination $WebPublicMobile -Recurse -Force

Write-Host "`n[4/5] Upload to S3 static/mobile + bucket root mobile/..." -ForegroundColor Yellow
aws s3 sync $distPath "s3://$Bucket/static/mobile/" --delete --region $Region
if ($LASTEXITCODE -ne 0) { throw "S3 static/mobile sync failed" }
aws s3 sync $distPath "s3://$Bucket/mobile/" --delete --region $Region
if ($LASTEXITCODE -ne 0) { throw "S3 mobile/ sync failed" }

if (Test-Path $WebPublicMobile) {
  aws s3 sync $WebPublicMobile "s3://$Bucket/builds/web/public/mobile/" --delete --region $Region
}

Write-Host "`n[5/5] Done" -ForegroundColor Green
Write-Host "Local:  $WebPublicMobile"
Write-Host "CDN:    s3://$Bucket/static/mobile/"
Write-Host "Site:   s3://$Bucket/mobile/"
Write-Host "URL:    https://www.socialimperialism.com/mobile/"
Write-Host "API:    $env:EXPO_PUBLIC_API_URL"
