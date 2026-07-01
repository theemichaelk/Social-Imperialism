# Deploy API to AWS Elastic Beanstalk (Node.js, no Docker required)
param(
  [string]$AppName = "social-imperialism-api",
  [string]$EnvName = "si-api-prod",
  [string]$Region = "us-east-1",
  [string]$Bucket = "social-imperialism",
  [string]$AmplifyUrl = "https://www.socialimperialism.com"
)

$ErrorActionPreference = "Continue"
$RepoRoot = Split-Path $PSScriptRoot -Parent
$DeployDir = $PSScriptRoot
$ZipPath = Join-Path $env:TEMP "si-api-eb.zip"
$Staging = Join-Path $env:TEMP "si-api-eb-staging"

if (Test-Path $Staging) { Remove-Item $Staging -Recurse -Force }
if (Test-Path $ZipPath) { Remove-Item $ZipPath -Force }
New-Item -ItemType Directory -Path $Staging | Out-Null

Write-Host "Staging deployment bundle..."
$items = @(
  "package.json", "package-lock.json", "Procfile", ".ebextensions", "packages", "apps/api"
# oauth-console-setup.json is under apps/api/src (bundled)
)
foreach ($item in $items) {
  $src = Join-Path $RepoRoot $item
  if (Test-Path $src) { Copy-Item $src (Join-Path $Staging $item) -Recurse -Force }
}

# @si/core requires apps/desktop services + saasAi at runtime
New-Item -ItemType Directory -Path (Join-Path $Staging "apps\desktop") -Force | Out-Null
Copy-Item (Join-Path $RepoRoot "apps\desktop\package.json") (Join-Path $Staging "apps\desktop\") -Force
Copy-Item (Join-Path $RepoRoot "apps\desktop\coreRequire.js") (Join-Path $Staging "apps\desktop\") -Force
Copy-Item (Join-Path $RepoRoot "apps\desktop\services") (Join-Path $Staging "apps\desktop\services") -Recurse -Force
Copy-Item (Join-Path $RepoRoot "apps\desktop\saasAi.js") (Join-Path $Staging "apps\desktop\") -Force -ErrorAction SilentlyContinue
if (-not (Test-Path (Join-Path $Staging "apps\desktop\coreRequire.js"))) {
  throw "EB bundle missing apps/desktop/coreRequire.js — SaaS handler registry will fail at runtime"
}

# Secrets go in bundled .env files (EB option_settings has a 4096-char CloudFormation limit)
$rdsStatePath = Join-Path $DeployDir "rds-state.json"
$rdsDbUrl = $null
if (Test-Path $rdsStatePath) {
  $rdsState = Get-Content $rdsStatePath | ConvertFrom-Json
  if ($rdsState.databaseUrl) { $rdsDbUrl = $rdsState.databaseUrl }
}
if (-not $rdsDbUrl) {
  Write-Host "Fetching DATABASE_URL from existing EB environment..."
  $rdsDbUrl = aws elasticbeanstalk describe-configuration-settings `
    --application-name $AppName `
    --environment-name $EnvName `
    --region $Region `
    --query "ConfigurationSettings[0].OptionSettings[?OptionName=='DATABASE_URL'].Value" `
    --output text 2>$null
  if (-not $rdsDbUrl -or $rdsDbUrl -eq "None") {
    throw "DATABASE_URL not found. Run deploy/rds-setup.ps1 or set databaseUrl in deploy/rds-state.json."
  }
}

$envVars = [ordered]@{
  NODE_ENV = "production"
  PORT = "8080"
  DATABASE_URL = $rdsDbUrl
  WEB_URL = $AmplifyUrl
  ALLOWED_ORIGINS = "$AmplifyUrl,https://d204r2r6gar3c8.amplifyapp.com,https://d2cu5rkstjz0rg.cloudfront.net,https://api.socialimperialism.com,https://socialimperialism.com,https://www.socialimperialism.com"
  AWS_S3_BUCKET_NAME = "social-imperialism"
  AWS_S3_UPLOAD_PREFIX = "uploads"
  AWS_S3_REGION = "us-east-1"
  DISABLE_SCHEDULER = "0"
  SAAS_MODE = "1"
  SEED_ON_DEPLOY = $(if ($rdsDbUrl) { "1" } else { "0" })
  VERIFIED_NODE_LIVE_WRITE = "1"
}
function Merge-Env($path) {
  if (-not (Test-Path $path)) { return }
  Get-Content $path | ForEach-Object {
    if ($_ -match '^\s*([A-Za-z_][A-Za-z0-9_]*)=(.*)$' -and $_ -notmatch '^\s*#') {
      $k = $Matches[1]; $v = $Matches[2].Trim('"')
      if ($k -notin @('API_PORT','WEB_URL','DATABASE_URL')) { $envVars[$k] = $v }
    }
  }
}
Merge-Env (Join-Path $RepoRoot "apps\api\.env")
Merge-Env (Join-Path $RepoRoot "apps\desktop\.env")
if (-not $envVars.JWT_SECRET) {
  $existingJwt = aws elasticbeanstalk describe-configuration-settings `
    --application-name $AppName `
    --environment-name $EnvName `
    --region $Region `
    --query "ConfigurationSettings[0].OptionSettings[?OptionName=='JWT_SECRET'].Value" `
    --output text 2>$null
  if ($existingJwt -and $existingJwt -ne "None") {
    $envVars.JWT_SECRET = $existingJwt
  } else {
    $envVars.JWT_SECRET = "si-prod-" + [guid]::NewGuid().ToString("N")
    Write-Host "Generated new JWT_SECRET (set in EB console to persist across deploys)."
  }
}

$apiEnvLines = @()
foreach ($k in $envVars.Keys) { $apiEnvLines += "$k=$($envVars[$k])" }
$apiEnvPath = Join-Path $Staging "apps\api\.env"
New-Item -ItemType Directory -Path (Split-Path $apiEnvPath) -Force | Out-Null
Set-Content -Path $apiEnvPath -Value $apiEnvLines -Encoding UTF8
Copy-Item $apiEnvPath (Join-Path $Staging "apps\desktop\.env") -Force

Write-Host "Creating zip (Unix paths for Elastic Beanstalk)..."
if (Test-Path $ZipPath) { Remove-Item $ZipPath -Force }
python (Join-Path $DeployDir "make-eb-zip.py") $Staging $ZipPath
if (-not (Test-Path $ZipPath)) { throw "Zip creation failed: $ZipPath" }
$versionLabel = "v-$(Get-Date -Format 'yyyyMMdd-HHmmss')"
$s3Key = "builds/eb/$versionLabel.zip"

Write-Host "Uploading to s3://$Bucket/$s3Key ..."
aws s3 cp $ZipPath "s3://$Bucket/$s3Key" --region $Region

# EB application
$appExists = aws elasticbeanstalk describe-applications --application-names $AppName --region $Region --query "Applications[0].ApplicationName" --output text 2>$null
if (-not $appExists -or $appExists -eq "None") {
  Write-Host "Creating EB application $AppName..."
  aws elasticbeanstalk create-application --application-name $AppName --region $Region | Out-Null
}

Write-Host "Creating application version $versionLabel..."
aws elasticbeanstalk create-application-version `
  --application-name $AppName `
  --version-label $versionLabel `
  --source-bundle S3Bucket=$Bucket,S3Key=$s3Key `
  --region $Region | Out-Null

$ebEnvOnly = @("NODE_ENV","PORT","DATABASE_URL","WEB_URL","ALLOWED_ORIGINS","AWS_S3_BUCKET_NAME","AWS_S3_UPLOAD_PREFIX","AWS_S3_REGION","DISABLE_SCHEDULER","SAAS_MODE","SEED_ON_DEPLOY","JWT_SECRET","VERIFIED_NODE_LIVE_WRITE")
$optionSettings = @(
  @{ Namespace = "aws:autoscaling:launchconfiguration"; OptionName = "IamInstanceProfile"; Value = "SocialImperialismEbInstanceProfile" },
  @{ Namespace = "aws:elasticbeanstalk:environment"; OptionName = "ServiceRole"; Value = "aws-elasticbeanstalk-service-role" }
)
foreach ($k in $ebEnvOnly) {
  if ($envVars.Contains($k)) {
    $optionSettings += @{ Namespace = "aws:elasticbeanstalk:application:environment"; OptionName = $k; Value = [string]$envVars[$k] }
  }
}

$envExists = aws elasticbeanstalk describe-environments --application-name $AppName --environment-names $EnvName --region $Region --query "Environments[0].Status" --output text 2>$null

$optsFile = Join-Path $DeployDir "eb-options.json"
[System.IO.File]::WriteAllText($optsFile, ($optionSettings | ConvertTo-Json -Depth 3))

if ($envExists -and $envExists -ne "None" -and $envExists -ne "Terminated") {
  Write-Host "Updating environment $EnvName..."
  aws elasticbeanstalk update-environment `
    --environment-name $EnvName `
    --version-label $versionLabel `
    --option-settings "file://$($optsFile -replace '\\','/')" `
    --region $Region | Out-Null
} else {
  Write-Host "Creating environment $EnvName (takes 5-10 min)..."
  $solutionStack = aws elasticbeanstalk list-available-solution-stacks --region $Region --query "SolutionStacks[?contains(@, '64bit Amazon Linux 2023 v') && contains(@, 'Node.js 22')]" --output text | Select-Object -First 1
  if (-not $solutionStack) {
    $solutionStack = aws elasticbeanstalk list-available-solution-stacks --region $Region --query "SolutionStacks[?contains(@, 'Node.js 20')]" --output text | Select-Object -First 1
  }
  Write-Host "Platform: $solutionStack"

  aws elasticbeanstalk create-environment `
    --application-name $AppName `
    --environment-name $EnvName `
    --version-label $versionLabel `
    --solution-stack-name $solutionStack `
    --option-settings "file://$($optsFile -replace '\\','/')" `
    --region $Region | Out-Null
}

Write-Host "Waiting for environment..."
for ($i = 0; $i -lt 60; $i++) {
  $info = aws elasticbeanstalk describe-environments --environment-names $EnvName --region $Region --query "Environments[0].{Status:Status,Health:Health,CNAME:CNAME}" --output json 2>$null | ConvertFrom-Json
  Write-Host "  $($info.Status) / $($info.Health) -> $($info.CNAME)"
  if ($info.Status -eq "Ready" -and $info.Health -eq "Green") { break }
  if ($info.Status -eq "Ready" -and $info.Health -eq "Yellow") { break }
  Start-Sleep -Seconds 15
}

$cname = $info.CNAME
$ebUrl = "http://$cname"
$apiUrl = "https://api.socialimperialism.com"
Write-Host "EB URL: $ebUrl"
Write-Host "Public API URL (after CloudFront + DNS): $apiUrl"

aws amplify update-app --app-id d204r2r6gar3c8 --environment-variables "AMPLIFY_MONOREPO_APP_ROOT=apps/web,NEXT_PUBLIC_API_URL=$apiUrl,API_URL=$apiUrl" --region $Region | Out-Null
aws amplify start-job --app-id d204r2r6gar3c8 --branch-name main --job-type RELEASE --region $Region | Out-Null

@{
  application = $AppName
  environment = $EnvName
  cname = $cname
  ebUrl = $ebUrl
  apiUrl = $apiUrl
  versionLabel = $versionLabel
} | ConvertTo-Json | Set-Content (Join-Path $DeployDir "eb-state.json")

Write-Host "Amplify updated with API_URL=$apiUrl and redeploy triggered."
Write-Host "Test: curl $apiUrl/health"