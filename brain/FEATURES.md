# Social Imperialism — Feature Catalog

Desktop (Electron) and web/SaaS share IPC channel parity. This catalog is the brain's feature index.

## Grok Engine (browser — no API)

**Status:** Live (June 2026)  
**Brain:** [GROK.md](./GROK.md) · **Skill:** [skills/grok-imagine/SKILL.md](./skills/grok-imagine/SKILL.md)

| Sub-feature | Description | Desktop | Web/SaaS |
|-------------|-------------|---------|----------|
| Native browser launcher | Real Chrome, Edge, Opera, Firefox with persistent cookies | `settings.html` → Native Browser | Settings (desktop bridge) |
| Grok session login | x.ai credentials + auto-fill; manual CAPTCHA | `settings.html` → Grok Engine | Settings → Grok tab |
| Grok Text | New-chat prompts with campaign keywords | Content Hub, `grok-integrate.js` | Content Hub |
| **Grok Imagine** | Text-to-image via grok.com/imagine in Edge | Content Hub, scripts | Content Hub |
| Grok Video + Extend | Keyword video with ~1min wait + auto-extend | Content Hub | Content Hub |
| Grok Infographic | Analysis + Imagine composite | Content Hub | Content Hub |
| Asset storage | PNG/MP4 saved to `grok-assets/` | Local | Via desktop worker |

**Default browser:** Microsoft Edge, dedicated `edge/grok` profile.

## Prompt Vault (June 2026)

| Capability | Desktop / API | Web |
|------------|---------------|-----|
| Create from keyword | IPC `create-prompt-vault-from-keyword` | `/prompt-vault` + picker |
| Search / load / delete / export | IPC channels in `promptVault.js` | `PromptVaultPanel`, `PromptVaultPicker` |
| Feature routing | `feature` tag per template | Content Hub, Grok, Keywords pickers |
| Brain doc | [PROMPT_VAULT.md](./PROMPT_VAULT.md) | Linked from Settings overview |

## Content Hub (existing + June 2026 parity pass)

- AI generation, RSS, stock media, publish queue, calendar scheduling
- Thumbnail studio (FLUX, FAL, Grok Imagine, Advanced Workflow) — **web tabs: Thumbnails, Grok & Infographic**
- Grok bar on: `content-hub`, `design-studio`, `brand`, `integrations`, `dns`, `content-library` — **web `GrokToolbar` on all six surfaces**
- **Web tabs added:** Media/Video, Repurpose, Q&A Composer, Comments inbox, Post Analytics, Content Utilities
- **Desktop tabs unchanged** — full tab set already in `content-hub.html`

## Settings parity (June 2026)

| Panel | Desktop | Web |
|-------|---------|-----|
| Strategy Playbooks | `settings.html` → Playbooks | Settings → Strategy Playbooks |
| Traffic & Rankings | `settings.html` → Traffic | Settings → Traffic & Rankings |
| Account Intelligence | `settings.html` → Intelligence | Settings → Account Intelligence |
| Native Browser | Grok tab + API Keys | Settings → Grok + `NativeBrowserPanel` |

## Integrations parity (June 2026)

| Panel | Desktop | Web |
|-------|---------|-----|
| Email auto-reply campaigns | `integrations.html` (toggle + test send) | Integrations → Email Campaigns |
| S3 storage health | `integrations.html` AWS card | `S3StatusPanel` on Connections tab |
| Partner API / Webhooks | Desktop basic | Web full hub (unchanged) |

## Scheduler parity

- Web `/scheduler` now includes `BackgroundRunPanel` (slot CRUD) — same component as `/rules`
- Desktop: `calendar.html#scheduler` (unchanged)

## Sovereign Threat Capture Layer (June 2026)

**Status:** Live  
**Brain:** [SOVEREIGN_THREAT_CAPTURE.md](./SOVEREIGN_THREAT_CAPTURE.md) · **Feature index:** [features/SOVEREIGN_THREAT_CAPTURE.md](./features/SOVEREIGN_THREAT_CAPTURE.md)

| Capability | API / Core | Web |
|------------|------------|-----|
| Edge scan + rate limit | `sovereignThreatShield` on `/api/invoke/*` | Client `api.ts` reports `SOVEREIGN_*` |
| Capture + AES-256-GCM seal | `capture-sovereign-threat` | `SovereignThreatPanel` |
| Kinetic 2FA | `request-kinetic-2fa-challenge`, `verify-kinetic-2fa` | Settings → Guardian & API |
| Decrypt / release | `decrypt-sovereign-threat-telemetry`, `approve-sovereign-threat-release` | Admin-only; Guardian gate |
| Partner status | `GET /api/v1/sovereign/status` | Integrations hub |
| Prompt Vault seed | `pv_seed_sovereign_threat` | `feature: sovereign` |

Persistent requirement for all past, current, and future modules — see security event template in Brain doc.

## Settings & integrations (existing)

- Live connection probes (13+ real API tests including Grok session)
- Global API keys, OAuth account hub, billing, tutorials
- Setup Academy tutorials include **Grok Imagine + Edge Setup** (`tut_grok`)

## IPC channels (Grok)

```
grok-ping, get-grok-settings, save-grok-settings, grok-connect, grok-get-status,
grok-ask-text, grok-imagine, grok-generate-video, grok-generate-infographic,
grok-close-browser, grok-build-prompt-preview
```

## Scripts

| Script | Purpose |
|--------|---------|
| `apps/desktop/scripts/launch-grok-edge.js` | Open grok.com in Edge with saved profile |
| `apps/desktop/scripts/run-grok-imagine-edge.js` | Full Imagine generation run |
| `apps/desktop/scripts/seed-grok-credentials.js` | Seed brain defaults into local storage |