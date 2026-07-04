# Amplify web deploy — git-connected apps use start-job; manual apps upload a pre-built zip.
param(
  [string]$AppId = "d204r2r6gar3c8",
  [string]$Branch = "main",
  [string]$RepoRoot = "E:\OneDrive\Documents\Factory AI.02.20.26\Social Imperialism",
  [switch]$ForceZip
)

$appMeta = aws amplify get-app --app-id $AppId --region us-east-1 --output json 2>$null | ConvertFrom-Json
$repository = $appMeta.app.repository
if ($repository -and -not $ForceZip) {
  Write-Host "Amplify app is git-connected ($repository) — triggering rebuild from $Branch..."
  $job = aws amplify start-job `
    --app-id $AppId `
    --branch-name $Branch `
    --job-type RELEASE `
    --region us-east-1 `
    --output json | ConvertFrom-Json
  $jobId = $job.jobSummary.jobId
  Write-Host "Started Amplify job $jobId (RELEASE from git)"
  Write-Host "Monitor: aws amplify get-job --app-id $AppId --branch-name $Branch --job-id $jobId --region us-east-1"
  Write-Host "URL: https://main.${AppId}.amplifyapp.com"
  exit 0
}

$webRoot = Join-Path $RepoRoot "apps\web"
if (-not (Test-Path (Join-Path $webRoot ".next"))) {
  Write-Error ".next missing - run: npm run build -w @si/web"
  exit 1
}

$zipPath = Join-Path $env:TEMP "si-amplify-full.zip"
$staging = Join-Path $env:TEMP "si-amplify-staging"
if (Test-Path $staging) { Remove-Item $staging -Recurse -Force }
if (Test-Path $zipPath) { Remove-Item $zipPath -Force }

Write-Host "Staging full web app with .next..."
New-Item -ItemType Directory -Path "$staging/apps/web" -Force | Out-Null
Copy-Item "$RepoRoot/amplify.yml" "$staging/amplify.yml"
Copy-Item "$RepoRoot/package.json" "$staging/package.json"
Copy-Item "$RepoRoot/package-lock.json" "$staging/package-lock.json"

$webItems = @("package.json", "next.config.js", "tsconfig.json", "next-env.d.ts", "public", "src", ".next", "scripts")
foreach ($item in $webItems) {
  $src = Join-Path $webRoot $item
  if (Test-Path $src) {
    Copy-Item $src "$staging/apps/web/$item" -Recurse -Force
  }
}

Write-Host "Creating zip (this may take a minute)..."
Compress-Archive -Path "$staging/*" -DestinationPath $zipPath -Force
$sizeMb = [math]::Round((Get-Item $zipPath).Length / 1MB, 1)
Write-Host "Zip size: ${sizeMb} MB"

Write-Host "Creating Amplify deployment job..."
$deploy = aws amplify create-deployment --app-id $AppId --branch-name $Branch --region us-east-1 --output json | ConvertFrom-Json
$jobId = $deploy.jobId
$uploadUrl = $deploy.zipUploadUrl

Write-Host "Uploading to Amplify (job $jobId)..."
curl.exe -X PUT -T $zipPath -H "Content-Type: application/zip" $uploadUrl

Write-Host "Starting deployment..."
aws amplify start-deployment --app-id $AppId --branch-name $Branch --job-id $jobId --region us-east-1 --output json

Write-Host ""
Write-Host "Monitor: aws amplify get-job --app-id $AppId --branch-name $Branch --job-id $jobId --region us-east-1"
Write-Host "URL: https://main.${AppId}.amplifyapp.com"