# Open RDS to your current public IP for local API development.
# Run before: npm run start:api
param(
  [string]$Region = "us-east-1",
  [string]$RdsSgName = "si-rds-postgres-sg",
  [int]$Port = 5432
)

$ErrorActionPreference = "Stop"

function Get-PublicIps {
  $v4 = $null; $v6 = $null
  try { $v4 = (Invoke-RestMethod -Uri "https://checkip.amazonaws.com" -TimeoutSec 10).ToString().Trim() } catch {}
  try { $v6 = (curl.exe -s https://icanhazip.com 2>$null).ToString().Trim() } catch {}
  if ($v4 -notmatch '^\d{1,3}(\.\d{1,3}){3}$') { $v4 = $null }
  if ($v6 -notmatch ':') { $v6 = $null }
  if (-not $v4 -and -not $v6) { throw "Could not detect your public IP." }
  return @{ V4 = $v4; V6 = $v6 }
}

$ips = Get-PublicIps
if ($ips.V4) { Write-Host "Public IPv4: $($ips.V4)" }
if ($ips.V6) { Write-Host "Public IPv6: $($ips.V6)" }

$sgId = aws ec2 describe-security-groups `
  --filters "Name=group-name,Values=$RdsSgName" `
  --region $Region `
  --query "SecurityGroups[0].GroupId" `
  --output text
if (-not $sgId -or $sgId -eq "None") { throw "Security group $RdsSgName not found" }

$existing = aws ec2 describe-security-groups --group-ids $sgId --region $Region --output json | ConvertFrom-Json
$perms = $existing.SecurityGroups[0].IpPermissions

if ($ips.V4) {
  $cidr = "$($ips.V4)/32"
  $already = $perms | Where-Object { $_.FromPort -eq $Port -and ($_.IpRanges | Where-Object { $_.CidrIp -eq $cidr }) }
  if (-not $already) {
    Write-Host "Adding IPv4 ingress $cidr -> $sgId port $Port"
    aws ec2 authorize-security-group-ingress --group-id $sgId --protocol tcp --port $Port --cidr $cidr --region $Region | Out-Null
  } else { Write-Host "IPv4 ingress already exists for $cidr" }
}

if ($ips.V6) {
  $cidr6 = "$($ips.V6)/128"
  $already6 = $perms | Where-Object { $_.FromPort -eq $Port -and ($_.Ipv6Ranges | Where-Object { $_.CidrIpv6 -eq $cidr6 }) }
  if (-not $already6) {
    Write-Host "Adding IPv6 ingress $cidr6 -> $sgId port $Port"
    aws ec2 authorize-security-group-ingress --group-id $sgId --ip-permissions "IpProtocol=tcp,FromPort=$Port,ToPort=$Port,Ipv6Ranges=[{CidrIpv6=$cidr6,Description=local-dev}]" --region $Region | Out-Null
  } else { Write-Host "IPv6 ingress already exists for $cidr6" }
}

$rdsPublic = aws rds describe-db-instances `
  --db-instance-identifier si-prod-postgres `
  --region $Region `
  --query "DBInstances[0].PubliclyAccessible" `
  --output text
if ($rdsPublic -ne "True") {
  Write-Host "Enabling RDS publicly-accessible (one-time, may take a few minutes)..."
  aws rds modify-db-instance `
    --db-instance-identifier si-prod-postgres `
    --publicly-accessible `
    --apply-immediately `
    --region $Region | Out-Null
  Write-Host "Wait for RDS modification to complete, then re-run this script."
}

Write-Host ""
Write-Host "DATABASE_URL should be set in apps/api/.env (postgresql://...)"
Write-Host "Test: node apps/api/_test-db-connect.js"
Write-Host "Start API: npm run start:api"