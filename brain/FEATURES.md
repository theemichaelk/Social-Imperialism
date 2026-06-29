# Social Imperialism — Feature Catalog

Desktop (Electron) and web/SaaS share IPC channel parity. This catalog is the brain's feature index.

**Audit accuracy rule (mandatory):** Before any feature update, comply with [features/AUDIT_ACCURACY_RULE.md](./features/AUDIT_ACCURACY_RULE.md). Run `npm run audit:accuracy`, `npm run test:sovereign-scan`, and production QA (**152/152** page features, **138/138** section features — re-count after test changes). Feature indexes live in `brain/features/*.md`.

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

## Site blueprint (June 2026)

Public marketing pages (`/`, `/founder`, footer, nav) self-update from `apps/web/src/lib/siteBlueprint.ts`, which derives module count, features grid, platforms, and stats from `nav.ts` + brain catalog. See [features/SITE_BLUEPRINT.md](./features/SITE_BLUEPRINT.md).

## Page focus UX (June 2026)

| Surface | Coverage |
|---------|----------|
| `PageShell` + `PageFocusRail` | 24 authenticated module routes in `pageFocus.ts` |
| `ManageableTabNav` focus mode | **7** tab-heavy pages: Dashboard, Browse Posts, History, Settings, Integrations, Content Library, Account Creator |
| `ContentHubTabNav` focus mode | Content Hub (dedicated tab catalog) |
| Sidebar hints | All nav items in `nav.ts` |

## THEE_MICHAEL Security Control (June 2026)

**Status:** Live  
**User-facing:** THEE_MICHAEL Security Control  
**Brain:** [SOVEREIGN_THREAT_CAPTURE.md](./SOVEREIGN_THREAT_CAPTURE.md) · **Feature indexes:** [features/THEE_MICHAEL_SECURITY.md](./features/THEE_MICHAEL_SECURITY.md), [features/SOVEREIGN_THREAT_CAPTURE.md](./features/SOVEREIGN_THREAT_CAPTURE.md)

| Capability | API / Core | Web |
|------------|------------|-----|
| Edge scan + rate limit | `sovereignThreatShield` on `/api/invoke/*` | Client `api.ts` reports `SOVEREIGN_*` |
| Capture + AES-256-GCM seal | `capture-sovereign-threat` | `SovereignThreatPanel` |
| **Accept / Deny / Undo** | `thee-michael-decide-threat`, `thee-michael-undo-action` | Pending queue + full history |
| Action history | `get-thee-michael-action-history` | History filters in panel |
| Kinetic 2FA | `request-kinetic-2fa-challenge`, `verify-kinetic-2fa` | Settings → Guardian & API |
| Decrypt / release | `decrypt-sovereign-threat-telemetry`, `approve-sovereign-threat-release` | Admin-only; Guardian gate |
| False-positive cleanup | `admin-clear-sovereign-false-positives` | Panel button |
| Partner status | `GET /api/v1/sovereign/status` | Integrations hub |
| Kinetic 2FA delivery | Email (SES/Acumbamail) + Guardian webhook | Security Control panel |
| Desktop native IPC | `apps/desktop/index.js` (**11** handlers) | Electron app |
| S3 landing shield | `s3-website/sovereign-landing-shield.js` | Static site |
| Prompt Vault seed | `pv_seed_sovereign_threat` | `feature: sovereign` |

Persistent requirement for all past, current, and future modules — every action pending until THEE_MICHAEL Accept or Deny.

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