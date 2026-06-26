# Deploy Social Imperialism API to AWS App Runner (GitHub + monorepo)
param(
  [string]$ServiceName = "social-imperialism-api",
  [string]$Region = "us-east-1",
  [string]$RepoUrl = "https://github.com/theemichaelk/Social-Imperialism",
  [string]$ConnectionArn = "arn:aws:codeconnections:us-east-1:647366717768:connection/1ddb664e-694c-468e-9f95-a4a913e16812",
  [string]$AmplifyUrl = "https://main.d204r2r6gar3c8.amplifyapp.com",
  [string]$ApiDomain = "api.socialimperialism.com",
  [string]$RoleName = "SocialImperialismApiRunnerRole"
)

$DeployDir = $PSScriptRoot
$StateFile = Join-Path $DeployDir "apprunner-state.json"

# --- IAM role for S3 access ---
$roleArn = $null
try { $roleArn = aws iam get-role --role-name $RoleName --query "Role.Arn" --output text 2>$null } catch {}
if (-not $roleArn -or $roleArn -eq "None") {
  Write-Host "Creating IAM role $RoleName..."
  aws iam create-role --role-name $RoleName --assume-role-policy-document "file://$DeployDir/apprunner-trust-policy.json" | Out-Null
  aws iam put-role-policy --role-name $RoleName --policy-name "S3SocialImperialism" --policy-document "file://$DeployDir/apprunner-s3-policy.json" | Out-Null
  Start-Sleep -Seconds 10
  $roleArn = aws iam get-role --role-name $RoleName --query "Role.Arn" --output text
}
Write-Host "Instance role: $roleArn"

# --- Load secrets from local .env (never printed) ---
$repoRoot = Split-Path $DeployDir -Parent
$apiEnv = Join-Path $repoRoot "apps\api\.env"
$desktopEnv = Join-Path $repoRoot "apps\desktop\.env"
$envVars = [ordered]@{
  NODE_ENV = "production"
  PORT = "8080"
  DATABASE_URL = "file:./packages/db/prisma/saas.db"
  WEB_URL = $AmplifyUrl
  ALLOWED_ORIGINS = "$AmplifyUrl,https://d204r2r6gar3c8.amplifyapp.com,https://d2cu5rkstjz0rg.cloudfront.net,http://social-imperialism.s3-website-us-east-1.amazonaws.com"
  AWS_S3_BUCKET_NAME = "social-imperialism"
  AWS_S3_UPLOAD_PREFIX = "uploads"
  AWS_S3_REGION = "us-east-1"
  DISABLE_SCHEDULER = "0"
}

function Merge-EnvFile($path) {
  if (-not (Test-Path $path)) { return }
  Get-Content $path | ForEach-Object {
    if ($_ -match '^\s*([A-Za-z_][A-Za-z0-9_]*)=(.*)$' -and $_ -notmatch '^\s*#') {
      $k = $Matches[1]
      $v = $Matches[2].Trim('"')
      if ($k -notin @('API_PORT','WEB_URL','DATABASE_URL')) { $envVars[$k] = $v }
    }
  }
}
Merge-EnvFile $apiEnv
Merge-EnvFile $desktopEnv
if (-not $envVars.JWT_SECRET) { $envVars.JWT_SECRET = "si-prod-" + [guid]::NewGuid().ToString("N") }

$runtimeEnv = @{}
foreach ($k in $envVars.Keys) { $runtimeEnv[$k] = [string]$envVars[$k] }

# --- Check existing service ---
$existing = aws apprunner list-services --region $Region --query "ServiceSummaryList[?ServiceName=='$ServiceName'].ServiceArn" --output text 2>$null
if ($existing -and $existing -ne "None") {
  Write-Host "App Runner service exists: $existing"
  $serviceArn = $existing
} else {
  $config = @{
    ServiceName = $ServiceName
    SourceConfiguration = @{
      AuthenticationConfiguration = @{ ConnectionArn = $ConnectionArn }
      AutoDeploymentsEnabled = $true
      CodeRepository = @{
        RepositoryUrl = $RepoUrl
        SourceCodeVersion = @{ Type = "BRANCH"; Value = "main" }
        CodeConfiguration = @{
          ConfigurationSource = "API"
          CodeConfigurationValues = @{
            Runtime = "NODEJS_22"
            BuildCommand = "npm install && npm run db:generate && npm run db:push && npm run db:seed"
            StartCommand = "npm run start:api"
            Port = "8080"
            RuntimeEnvironmentVariables = $runtimeEnv
          }
        }
      }
    }
    InstanceConfiguration = @{
      Cpu = "1024"
      Memory = "2048"
      InstanceRoleArn = $roleArn
    }
    HealthCheckConfiguration = @{
      Protocol = "HTTP"
      Path = "/health"
      Interval = 10
      Timeout = 5
      HealthyThreshold = 1
      UnhealthyThreshold = 5
    }
  } | ConvertTo-Json -Depth 10

  $configFile = Join-Path $DeployDir "apprunner-service.json"
  [System.IO.File]::WriteAllText($configFile, $config)

  Write-Host "Creating App Runner service $ServiceName..."
  $result = aws apprunner create-service --region $Region --cli-input-json "file://$configFile" --output json | ConvertFrom-Json
  $serviceArn = $result.Service.ServiceArn
  $serviceUrl = $result.Service.ServiceUrl
  Write-Host "Created: $serviceArn"
  Write-Host "URL: https://$serviceUrl"
}

# Wait for RUNNING
Write-Host "Waiting for service to reach RUNNING..."
for ($i = 0; $i -lt 40; $i++) {
  $status = aws apprunner describe-service --service-arn $serviceArn --region $Region --query "Service.Status" --output text
  $serviceUrl = aws apprunner describe-service --service-arn $serviceArn --region $Region --query "Service.ServiceUrl" --output text
  Write-Host "  Status: $status"
  if ($status -eq "RUNNING") { break }
  Start-Sleep -Seconds 15
}

# Custom domain
Write-Host "Associating custom domain $ApiDomain..."
try {
  aws apprunner associate-custom-domain --service-arn $serviceArn --domain-name $ApiDomain --region $Region --enable-www-subdomain $false --output json | Out-Null
} catch {
  Write-Host "Custom domain may already be associated or pending."
}

$domainStatus = aws apprunner describe-custom-domains --service-arn $serviceArn --region $Region --output json 2>$null | ConvertFrom-Json

# Update Amplify env vars
$apiUrl = "https://$ApiDomain"
if ($serviceUrl) { $apiUrl = "https://$serviceUrl" }
Write-Host "Updating Amplify to use API: $apiUrl"
aws amplify update-app --app-id d204r2r6gar3c8 --environment-variables "AMPLIFY_MONOREPO_APP_ROOT=apps/web,NEXT_PUBLIC_API_URL=$apiUrl,API_URL=$apiUrl" --region $Region | Out-Null
aws amplify start-job --app-id d204r2r6gar3c8 --branch-name main --job-type RELEASE --region $Region | Out-Null

@{
  serviceArn = $serviceArn
  serviceUrl = $serviceUrl
  apiDomain = $ApiDomain
  amplifyApiUrl = $apiUrl
  roleArn = $roleArn
  customDomains = $domainStatus
} | ConvertTo-Json -Depth 5 | Set-Content $StateFile

Write-Host ""
Write-Host "API deploy complete."
Write-Host "  App Runner: https://$serviceUrl"
Write-Host "  Custom domain (after DNS): https://$ApiDomain"
Write-Host "  Amplify redeploy triggered with NEXT_PUBLIC_API_URL=$apiUrl"