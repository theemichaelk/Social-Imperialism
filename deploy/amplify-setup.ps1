# Creates Amplify app for Social Imperialism Next.js SSR (pulls from S3 builds/web)
param(
  [string]$AppName = "social-imperialism-web",
  [string]$Bucket = "social-imperialism",
  [string]$Region = "us-east-1"
)

$stateFile = Join-Path $PSScriptRoot "amplify-state.json"

# Check existing apps
$existing = aws amplify list-apps --query "apps[?name=='$AppName'].appId" --output text 2>$null
if ($existing -and $existing -ne "None") {
  Write-Host "Amplify app already exists: $existing"
  $defaultUrl = aws amplify get-app --app-id $existing --query "app.defaultDomain" --output text
  Write-Host "Amplify URL: https://$defaultUrl"
  @{ appId = $existing; defaultDomain = $defaultUrl } | ConvertTo-Json | Set-Content $stateFile
  exit 0
}

Write-Host "Creating Amplify app: $AppName"
$app = aws amplify create-app `
  --name $AppName `
  --platform WEB_COMPUTE `
  --environment-variables "NEXT_PUBLIC_API_URL=https://api.social-imperialism.com,API_URL=https://api.social-imperialism.com" `
  --output json | ConvertFrom-Json

$appId = $app.app.appId
$defaultDomain = $app.app.defaultDomain

Write-Host "Created Amplify app: $appId"
Write-Host "Default domain: https://$defaultDomain"

# Create main branch
Write-Host "Creating main branch..."
aws amplify create-branch --app-id $appId --branch-name main --enable-auto-build --output json | Out-Null

# Note: Amplify requires a Git repo or manual deploy zip for first deployment.
# Upload deploy bundle from S3 builds/web as manual deployment artifact.
Write-Host ""
Write-Host "Next steps (manual or CI):"
Write-Host "  1. Connect GitHub repo OR use manual deploy"
Write-Host "  2. Build spec: amplify.yml at repo root (also at s3://$Bucket/builds/amplify.yml)"
Write-Host "  3. Pre-build syncs s3://$Bucket/builds/web/ (includes .next)"
Write-Host "  4. Start command: npm start (port 3000)"
Write-Host ""
Write-Host "To trigger deploy from local after S3 upload:"
Write-Host "  npm run deploy:all -w @si/web"
Write-Host "  aws amplify start-job --app-id $appId --branch-name main --job-type RELEASE"

@{ appId = $appId; defaultDomain = $defaultDomain; bucket = $Bucket; buildsPrefix = "builds/web" } |
  ConvertTo-Json | Set-Content $stateFile