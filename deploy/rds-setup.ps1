# Provision RDS PostgreSQL for multi-tenant production and wire EB DATABASE_URL
param(
  [string]$Region = "us-east-1",
  [string]$DbInstanceId = "si-prod-postgres",
  [string]$DbName = "socialimperialism",
  [string]$MasterUsername = "si_admin",
  [string]$EbEnvName = "si-api-prod",
  [string]$EbInstanceSg = "sg-06876d81b3ae7d737",
  [string]$VpcId = "vpc-077e4005d8ba57cc0",
  [string]$DbSubnetGroupName = "si-rds-subnet-group",
  [string[]]$SubnetIds = @("subnet-0fa0b9ef9b3329e87", "subnet-05d721a1ef4b31e96")
)

$ErrorActionPreference = "Stop"
$DeployDir = $PSScriptRoot
$StatePath = Join-Path $DeployDir "rds-state.json"

function Invoke-AwsQuiet {
  param([Parameter(Mandatory)][string[]]$AwsArgs)
  $prev = $ErrorActionPreference
  $ErrorActionPreference = "Continue"
  try {
    $out = & aws @AwsArgs 2>&1
    $code = $LASTEXITCODE
    if ($code -ne 0) { return @{ Ok = $false; Output = $out; Code = $code } }
    return @{ Ok = $true; Output = ($out | Out-String).Trim(); Code = 0 }
  } finally {
    $ErrorActionPreference = $prev
  }
}

function Get-RdsState {
  if (Test-Path $StatePath) { return Get-Content $StatePath | ConvertFrom-Json }
  return $null
}

$describe = Invoke-AwsQuiet -AwsArgs @(
  "rds", "describe-db-instances",
  "--db-instance-identifier", $DbInstanceId,
  "--region", $Region,
  "--output", "json"
)
$existing = $null
if ($describe.Ok -and $describe.Output) {
  $existing = $describe.Output | ConvertFrom-Json
}
if ($existing -and $existing.DBInstances -and $existing.DBInstances.Count -gt 0) {
  $db = $existing.DBInstances[0]
  Write-Host "RDS instance $DbInstanceId already exists ($($db.DBInstanceStatus))"
  $endpoint = $db.Endpoint.Address
  $port = $db.Endpoint.Port
  $state = Get-RdsState
  if (-not $state -or -not $state.password) {
    throw "RDS exists but deploy/rds-state.json is missing password. Recover from Secrets Manager or reset master password."
  }
} else {
  Write-Host "Creating RDS security group..."
  $rdsSgName = "si-rds-postgres-sg"
  $sgLookup = Invoke-AwsQuiet -AwsArgs @(
    "ec2", "describe-security-groups",
    "--filters", "Name=group-name,Values=$rdsSgName", "Name=vpc-id,Values=$VpcId",
    "--region", $Region,
    "--query", "SecurityGroups[0].GroupId",
    "--output", "text"
  )
  $rdsSg = if ($sgLookup.Ok -and $sgLookup.Output -and $sgLookup.Output -ne "None") { $sgLookup.Output } else { $null }
  if (-not $rdsSg) {
    $sgCreate = Invoke-AwsQuiet -AwsArgs @(
      "ec2", "create-security-group",
      "--group-name", $rdsSgName,
      "--description", "Social Imperialism RDS PostgreSQL",
      "--vpc-id", $VpcId,
      "--region", $Region,
      "--query", "GroupId",
      "--output", "text"
    )
    if ($sgCreate.Ok -and $sgCreate.Output) {
      $rdsSg = $sgCreate.Output
    } else {
      $sgRetry = Invoke-AwsQuiet -AwsArgs @(
        "ec2", "describe-security-groups",
        "--filters", "Name=group-name,Values=$rdsSgName", "Name=vpc-id,Values=$VpcId",
        "--region", $Region,
        "--query", "SecurityGroups[0].GroupId",
        "--output", "text"
      )
      if (-not $sgRetry.Ok -or -not $sgRetry.Output -or $sgRetry.Output -eq "None") {
        throw "Failed to resolve RDS security group: $($sgCreate.Output)"
      }
      $rdsSg = $sgRetry.Output
    }
    $ingress = Invoke-AwsQuiet -AwsArgs @(
      "ec2", "authorize-security-group-ingress",
      "--group-id", $rdsSg,
      "--protocol", "tcp",
      "--port", "5432",
      "--source-group", $EbInstanceSg,
      "--region", $Region
    )
    if (-not $ingress.Ok -and ($ingress.Output -notmatch "InvalidPermission.Duplicate")) {
      throw "Failed to authorize RDS SG ingress: $($ingress.Output)"
    }
    Write-Host "RDS SG ready: $rdsSg (allows EB SG $EbInstanceSg on 5432)"
  } else {
    Write-Host "Using existing RDS SG: $rdsSg"
  }

  Write-Host "Ensuring DB subnet group $DbSubnetGroupName..."
  $subnetLookup = Invoke-AwsQuiet -AwsArgs @(
    "rds", "describe-db-subnet-groups",
    "--db-subnet-group-name", $DbSubnetGroupName,
    "--region", $Region,
    "--output", "json"
  )
  if (-not $subnetLookup.Ok) {
    $subnetCreate = Invoke-AwsQuiet -AwsArgs (@(
      "rds", "create-db-subnet-group",
      "--db-subnet-group-name", $DbSubnetGroupName,
      "--db-subnet-group-description", "Social Imperialism RDS subnets",
      "--region", $Region,
      "--subnet-ids"
    ) + $SubnetIds)
    if (-not $subnetCreate.Ok) { throw "Failed to create DB subnet group: $($subnetCreate.Output)" }
    Write-Host "Created DB subnet group with subnets: $($SubnetIds -join ', ')"
  } else {
    Write-Host "Using existing DB subnet group: $DbSubnetGroupName"
  }

  $password = -join ((48..57 + 65..90 + 97..122) | Get-Random -Count 24 | ForEach-Object { [char]$_ })
  $password += "A1!"

  Write-Host "Creating RDS PostgreSQL instance $DbInstanceId (5-10 min)..."
  $create = Invoke-AwsQuiet -AwsArgs @(
    "rds", "create-db-instance",
    "--db-instance-identifier", $DbInstanceId,
    "--db-instance-class", "db.t4g.micro",
    "--engine", "postgres",
    "--engine-version", "16.4",
    "--master-username", $MasterUsername,
    "--master-user-password", $password,
    "--allocated-storage", "20",
    "--storage-type", "gp3",
    "--db-name", $DbName,
    "--vpc-security-group-ids", $rdsSg,
    "--db-subnet-group-name", $DbSubnetGroupName,
    "--no-publicly-accessible",
    "--backup-retention-period", "7",
    "--storage-encrypted",
    "--region", $Region
  )
  if (-not $create.Ok) { throw "Failed to create RDS instance: $($create.Output)" }

  Write-Host "Waiting for RDS to become available..."
  $wait = Invoke-AwsQuiet -AwsArgs @("rds", "wait", "db-instance-available", "--db-instance-identifier", $DbInstanceId, "--region", $Region)
  if (-not $wait.Ok) { throw "RDS did not become available: $($wait.Output)" }

  $dbLookup = Invoke-AwsQuiet -AwsArgs @(
    "rds", "describe-db-instances",
    "--db-instance-identifier", $DbInstanceId,
    "--region", $Region,
    "--query", "DBInstances[0]",
    "--output", "json"
  )
  if (-not $dbLookup.Ok) { throw "Failed to describe RDS instance: $($dbLookup.Output)" }
  $db = $dbLookup.Output | ConvertFrom-Json
  $endpoint = $db.Endpoint.Address
  $port = $db.Endpoint.Port
  if (-not $endpoint) { throw "RDS endpoint missing after create" }

  @{
    dbInstanceId = $DbInstanceId
    engine = "postgres"
    endpoint = $endpoint
    port = $port
    database = $DbName
    username = $MasterUsername
    password = $password
    securityGroup = $rdsSg
    ebSecurityGroup = $EbInstanceSg
    vpcId = $VpcId
    createdAt = (Get-Date).ToString("o")
  } | ConvertTo-Json | Set-Content $StatePath
  Write-Host "Saved credentials to $StatePath (gitignored)"
}

$state = Get-RdsState
if (-not $state) { $state = Get-Content $StatePath | ConvertFrom-Json }
if (-not $endpoint -or -not $port -or -not $state.password) {
  throw "RDS state incomplete (endpoint/port/password). Aborting EB update."
}
$encodedPass = [uri]::EscapeDataString($state.password)
$databaseUrl = "postgresql://${MasterUsername}:${encodedPass}@${endpoint}:${port}/${DbName}?schema=public&sslmode=require"

Write-Host "DATABASE_URL configured for PostgreSQL at ${endpoint}:${port}"

# Update EB environment DATABASE_URL
Write-Host "Updating EB environment $EbEnvName..."
$opts = @(
  @{ Namespace = "aws:elasticbeanstalk:application:environment"; OptionName = "DATABASE_URL"; Value = $databaseUrl },
  @{ Namespace = "aws:elasticbeanstalk:application:environment"; OptionName = "SAAS_MODE"; Value = "1" },
  @{ Namespace = "aws:elasticbeanstalk:application:environment"; OptionName = "SEED_ON_DEPLOY"; Value = "1" }
)
$optsFile = Join-Path $DeployDir "rds-eb-options.json"
[System.IO.File]::WriteAllText($optsFile, ($opts | ConvertTo-Json -Depth 3))
aws elasticbeanstalk update-environment `
  --environment-name $EbEnvName `
  --option-settings "file://$($optsFile -replace '\\','/')" `
  --region $Region | Out-Null

Write-Host "Waiting for EB config update..."
for ($i = 0; $i -lt 20; $i++) {
  $status = aws elasticbeanstalk describe-environments --environment-names $EbEnvName --region $Region --query "Environments[0].{Status:Status,Health:Health}" --output json | ConvertFrom-Json
  Write-Host "  $($status.Status) / $($status.Health)"
  if ($status.Status -eq "Ready") { break }
  Start-Sleep -Seconds 15
}

$state | Add-Member -NotePropertyName databaseUrl -NotePropertyValue $databaseUrl -Force
$state | ConvertTo-Json | Set-Content $StatePath

Write-Host ""
Write-Host "RDS PostgreSQL ready."
Write-Host "  Endpoint: $endpoint"
Write-Host "  Database: $DbName"
Write-Host "  Next: run deploy/api-eb-setup.ps1 to deploy API with migrate + seed"