# Permanent Memory

## Project
- Social Imperialism desktop + web/SaaS app in progress.
- Stack: Electron, Node.js, HTML/JS/CSS, Next.js web, Prisma API.
- Local storage (`node-localstorage`) for desktop settings persistence.
- Agent brain docs: `brain/BRAIN.md`, `brain/FEATURES.md`, `brain/GROK.md`

## Grok Engine (browser session — no API)
- Platform: **grok** · URL: https://grok.com/
- Credentials: stored in desktop `grokEngineSettings` (local storage) — never commit passwords to git
- Default browser: **Microsoft Edge**, dedicated profile `edge/grok`
- Profile path: `%APPDATA%\Social Imperialism\native-browser-profiles\edge\grok`
- Assets: `%APPDATA%\Social Imperialism\grok-assets\`
- Skill: `brain/skills/grok-imagine/SKILL.md`
- IPC: `grok-imagine`, `grok-ask-text`, `grok-generate-video`, `grok-generate-infographic`
- Script: `apps/desktop/scripts/run-grok-imagine-edge.js`

## SaaS admin (separate from Grok)
- Seed login: set `SEED_EMAIL` and `SEED_PASSWORD` in `apps/api/.env` (see `.env.example`)