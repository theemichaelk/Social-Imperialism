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

$pyLauncher = Get-Command py -ErrorAction SilentlyContinue
$pythonCmd = Get-Command python -ErrorAction SilentlyContinue
if (-not $pyLauncher -and -not $pythonCmd) { throw "Python 3.10+ required (install from python.org or use py launcher)" }

Push-Location $vendor
if (-not (Test-Path ".venv")) {
  Write-Host "Creating Python venv..."
  if ($pyLauncher) {
    & py -3 -m venv .venv
  } else {
    python -m venv .venv
  }
}
$venvPy = Join-Path $vendor ".venv\Scripts\python.exe"
& $venvPy -m pip install --upgrade pip
& $venvPy -m pip install -r requirements.txt

function Install-RemotionComposerNpm {
  $npmLog = Join-Path $env:TEMP "openmontage-npm-install.log"
  npm install 2>&1 | Tee-Object -FilePath $npmLog
  if ($LASTEXITCODE -ne 0) {
    $log = Get-Content $npmLog -Raw -ErrorAction SilentlyContinue
    if ($log -match 'ERR_INVALID_ARG_TYPE') {
      Write-Host "npm install failed (ERR_INVALID_ARG_TYPE) — retrying with npx --yes npm install..."
      npx --yes npm install
    }
    if ($LASTEXITCODE -ne 0) {
      throw "remotion-composer npm install failed — see $npmLog"
    }
  }
}

if (Test-Path "remotion-composer\package.json") {
  Push-Location "remotion-composer"
  if (-not (Test-Path "node_modules")) {
    Write-Host "Installing remotion-composer dependencies..."
    Install-RemotionComposerNpm
  }
  Pop-Location
}

if (-not (Test-Path ".env") -and (Test-Path ".env.example")) {
  Copy-Item ".env.example" ".env"
  Write-Host "Created .env from .env.example — every key is optional; add what you have."
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
Write-Host "  No make (Windows):   py -3 -m venv .venv; .\.venv\Scripts\Activate.ps1; python -m pip install -r requirements.txt; cd remotion-composer; npm install; cd ..; python -m pip install piper-tts; Copy-Item .env.example .env"
Write-Host "  npm ERR_INVALID_ARG_TYPE (Windows): npx --yes npm install  (inside remotion-composer)"
Write-Host "  Agents: pipeline first -> manifest -> stage skill -> tools (AGENT_GUIDE.md Rule Zero)"
Write-Host "  .env — every key is optional; add what you have (.env.example for sections + URLs)"
Write-Host "  Or Settings -> Integrations (desktop syncs FAL, Google, OpenAI, stock keys into .env)"