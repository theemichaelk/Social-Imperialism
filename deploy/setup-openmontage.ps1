# Clone and bootstrap OpenMontage for Imperial Video Studio
param(
  [string]$RepoRoot = "E:\OneDrive\Documents\Factory AI.02.20.26\Social Imperialism",
  [string]$OmUrl = "https://github.com/calesthio/OpenMontage.git"
)

$ErrorActionPreference = "Stop"
$vendor = Join-Path $RepoRoot "vendor\OpenMontage"

if (-not (Test-Path $vendor)) {
  Write-Host "Cloning OpenMontage..."
  git clone --depth 1 $OmUrl $vendor
}

$py = Get-Command python -ErrorAction SilentlyContinue
if (-not $py) { throw "Python 3.10+ required" }

Push-Location $vendor
if (-not (Test-Path ".venv")) {
  Write-Host "Creating Python venv..."
  python -m venv .venv
}
$venvPy = Join-Path $vendor ".venv\Scripts\python.exe"
& $venvPy -m pip install --upgrade pip
& $venvPy -m pip install -r requirements.txt

if (Test-Path "remotion-composer\package.json") {
  Push-Location "remotion-composer"
  if (-not (Test-Path "node_modules")) {
    Write-Host "Installing remotion-composer dependencies..."
    npm install
  }
  Pop-Location
}

if (-not (Test-Path ".env") -and (Test-Path ".env.example")) {
  Copy-Item ".env.example" ".env"
}

Pop-Location
Write-Host "OpenMontage ready at $vendor"
Write-Host "Set OPENMONTAGE_ROOT=$vendor for custom paths"