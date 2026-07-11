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
  Write-Host "Created .env from .env.example — add API keys for cloud providers."
} elseif (Test-Path ".env") {
  Write-Host ".env already exists — skipping."
}

Write-Host "Installing Piper TTS (optional offline narration)..."
& $venvPy -m pip install piper-tts 2>$null
if ($LASTEXITCODE -ne 0) { Write-Host "  [skip] piper-tts — cloud TTS providers will be used instead" }

if (Get-Command npx -ErrorAction SilentlyContinue) {
  Write-Host "Warming HyperFrames npx cache..."
  npx --yes hyperframes --version 2>$null
  if ($LASTEXITCODE -ne 0) { Write-Host "  [skip] HyperFrames cache-warm failed — first render may fetch on demand" }
}

Pop-Location
Write-Host ""
Write-Host "Done! OpenMontage ready at $vendor"
Write-Host "  Social Imperialism: vendor/OpenMontage (or OPENMONTAGE_ROOT)"
Write-Host "  Standalone clone:   git clone https://github.com/calesthio/OpenMontage.git && cd OpenMontage && make setup"
Write-Host "  No make (mac/Linux): bash deploy/setup-openmontage.sh"
Write-Host "  Optional: add API keys to .env / Settings -> Integrations"