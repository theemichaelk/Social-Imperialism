# Creates or updates CloudFront distribution for social-imperialism static assets
param(
  [string]$Bucket = "social-imperialism",
  [string]$Region = "us-east-1"
)

$OriginDomain = "$Bucket.s3.$Region.amazonaws.com"
$CallerRef = "si-cdn-$(Get-Date -Format 'yyyyMMddHHmmss')"
$Comment = "Social Imperialism static assets (S3 /static prefix)"

# Check for existing distribution
$existing = aws cloudfront list-distributions --query "DistributionList.Items[?Origins.Items[?DomainName=='$OriginDomain']].Id" --output text 2>$null
if ($existing -and $existing -ne "None") {
  Write-Host "CloudFront distribution already exists: $existing"
  $domain = aws cloudfront get-distribution --id $existing --query "Distribution.DomainName" --output text
  Write-Host "CDN URL: https://$domain"
  exit 0
}

$configFile = Join-Path $PSScriptRoot "cloudfront-distribution.json"
if (-not (Test-Path $configFile)) {
  Write-Error "Missing $configFile"
  exit 1
}

Write-Host "Creating CloudFront distribution..."
$result = aws cloudfront create-distribution --distribution-config "file://$configFile" --output json | ConvertFrom-Json
$id = $result.Distribution.Id
$domain = $result.Distribution.DomainName

Write-Host "Created distribution $id"
Write-Host "CDN URL: https://$domain"
Write-Host "(Deployment takes 5-15 minutes to propagate)"

# Save ID for later reference
@{ distributionId = $id; domainName = $domain; bucket = $Bucket; originPath = "/static" } |
  ConvertTo-Json | Set-Content (Join-Path $PSScriptRoot "cloudfront-state.json")