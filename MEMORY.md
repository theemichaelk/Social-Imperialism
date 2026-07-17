# Permanent Memory

## Project
- Social Imperialism desktop + web/SaaS app in progress.
- Stack: Electron, Node.js, HTML/JS/CSS, Next.js web, Prisma API.
- Local storage (`node-localstorage`) for desktop settings persistence.
- Agent brain docs: `brain/BRAIN.md`, `brain/FEATURES.md`, `brain/GROK.md`
- Mobile: `apps/mobile` Expo Command Center v2.2. Offline cache (`lib/cache.ts`, `invokeWithCache`), push (`lib/push.ts`, `/api/mobile/device-token`), deploy via `npm run deploy:mobile` → S3 `mobile/` + `static/mobile/` + `public/mobile`. URL: https://www.socialimperialism.com/mobile/

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
- Admin GSC + GA4 traffic: `GET /api/admin/traffic` + Dashboard Analytics / Admin panels. Env: `GOOGLE_SERVICE_ACCOUNT_JSON`, `GSC_SITE_URL`, `GA4_PROPERTY_ID`. Docs: `docs/ADMIN_GSC_GA4.md`

## Local storage (Floci — free S3 emulator)
- **Zero-touch:** `npm run dev` or double-click `start-si.bat` (Docker + QP env + Floci + API + web)
- App only: `npm run dev:app`. Docs: `docs/FLOCI_LOCAL.md`
- Amplify = go-live only, not day-to-day dev.
- UI console optional: clone [floci-ui](https://github.com/floci-io/floci-ui) → `docker compose up`