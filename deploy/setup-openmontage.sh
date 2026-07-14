#!/usr/bin/env bash
# Bootstrap OpenMontage for Imperial Video Studio (macOS/Linux — no make required)
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
VENDOR="${OPENMONTAGE_ROOT:-$REPO_ROOT/vendor/OpenMontage}"
OM_URL="${OPENMONTAGE_GIT_URL:-https://github.com/calesthio/OpenMontage.git}"

if [[ ! -d "$VENDOR/.git" ]]; then
  echo "Cloning OpenMontage..."
  mkdir -p "$(dirname "$VENDOR")"
  git clone --depth 1 "$OM_URL" "$VENDOR"
fi

cd "$VENDOR"

PYTHON="${PYTHON:-python3}"
if ! command -v "$PYTHON" >/dev/null 2>&1; then
  echo "ERROR: python3 not found. Install Python 3.10+."
  exit 1
fi

if [[ ! -d .venv ]]; then
  echo "Creating .venv..."
  "$PYTHON" -m venv .venv
fi

# shellcheck disable=SC1091
source .venv/bin/activate

python -m pip install --upgrade pip
python -m pip install -r requirements.txt

if [[ -f remotion-composer/package.json ]]; then
  echo "Installing remotion-composer..."
  (cd remotion-composer && npm install)
fi

python -m pip install piper-tts || echo "[skip] piper-tts — cloud TTS will be used"

if [[ ! -f .env ]] && [[ -f .env.example ]]; then
  cp .env.example .env
  echo "Created .env from .env.example — every key is optional; add what you have"
elif [[ -f .env ]]; then
  echo ".env already exists — skipping"
fi

if command -v npx >/dev/null 2>&1; then
  echo "Warming HyperFrames npx cache..."
  npx --yes hyperframes --version >/dev/null 2>&1 || echo "[skip] HyperFrames cache-warm failed"
fi

echo ""
echo "Done! OpenMontage ready at $VENDOR"
echo "  Activate: source $VENDOR/.venv/bin/activate"
echo "  No make? This script is the manual equivalent of: make setup"
echo "  Agents: pipeline first -> manifest -> stage skill -> tools (AGENT_GUIDE.md Rule Zero)"
echo "  API keys (optional — more keys = more tools): .env or Settings -> Integrations"