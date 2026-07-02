# THEE_MICHAEL — Omnipresent Predictive Overlord Protocol

**Product:** [socialimperialism.com](https://www.socialimperialism.com)  
**Version:** v1.2.30 foundation  
**Identity:** `THEE_MICHAEL` (unified system mind, live support, self-correcting execution)

## Vision

THEE_MICHAEL operates with **active spatial awareness**, **predictive user modelling**, and **continuous codebase symbiosis**. He navigates the live browser, ingests configuration payloads, surfaces proactive interventions, and gates risky mutations behind cryptographic confirmation.

## Architecture

| Protocol | Capability | Implementation |
|----------|------------|----------------|
| Alpha — Hyper-Ingestion | File/text/CSV/API sheet parse → enclave | `overlordEnclave.ts`, `theeMichaelOverlord.ts` |
| Beta — Page Mutation | `router.push`, UI highlight, typing simulation | `liveSupportActions.ts`, `OverlordProtocolHost.tsx` |
| Gamma — Symbiosis | Health correlation, Issue Control audit route | `buildInterventionsForContext`, `get-page-health` |
| Delta — Predictive Matrix | Dwell-time interventions, Success Velocity Index | `OverlordInterventionBanner`, telemetry session |

## Surfaces

| Surface | Path |
|---------|------|
| Core engine | `apps/web/src/lib/theeMichaelOverlord.ts` |
| Session enclave | `apps/web/src/lib/overlordEnclave.ts` |
| Protocol host | `apps/web/src/components/OverlordProtocolHost.tsx` |
| Cognitive trace | `apps/web/src/components/OverlordCognitiveTrace.tsx` |
| Interventions | `apps/web/src/components/OverlordInterventionBanner.tsx` |
| Risk gate | `apps/web/src/components/OverlordConfirmModal.tsx` |
| Field guard | `apps/web/src/components/OverlordFieldGuard.tsx` |
| Live console | `apps/web/src/components/LiveSupportPanel.tsx` |

## Security Guardrails

- **Polymorphic enclave:** secrets in transient `sessionStorage` + in-memory map; TTL 12m; never in chat logs.
- **Redaction:** `redactSecrets()` strips tokens before AI prompts.
- **Confirmation gate:** high-risk requests require typing challenge code (`OverlordConfirmModal`).
- **Rollback:** `saveCheckpoint` / `rollbackCheckpoint` on failed guarded execution.
- **Sovereign layer:** complements [SOVEREIGN_THREAT_CAPTURE.md](./SOVEREIGN_THREAT_CAPTURE.md) and Guardian.

## Events

- `si-overlord-trace` — cognitive trace steps
- `si-overlord-intervention` — proactive banners
- `si-overlord-ui-mutate` — field highlight / autofill
- `si-overlord-confirm` — risk confirmation modal
- `si-overlord-flash` — spatial attention flash

## Live Guide Action Control (v1.2.31)

Structured actions — not just chat replies.

| Layer | Path |
|-------|------|
| Action planner | `apps/api/src/guide/guide_actions.js` |
| Guide APIs | `apps/api/src/routes/guide.js` |
| Client executor | `apps/web/src/lib/guide_executor.ts` |
| Poll host (4s) | `apps/web/src/components/GuideExecutorHost.tsx` |
| Admin push UI | `apps/web/src/components/LiveGuideRedirectPanel.tsx` → `/dashboard/admin` |

**APIs:** `POST /api/guide/actions/plan` · `GET /api/guide/remote/poll` · `POST /api/guide/remote/push` (admin)

**Action types:** `navigate`, `open_url`, `disable_simple_mode`, `expand_advanced_rail`, `restore_hidden_tabs`, `select_tab`, `highlight`, `expand_sidebar_section`, `flash_screen`, `message`, `wait`

**Social Imperialism module map** ([socialimperialism.com](https://www.socialimperialism.com)):

| User says | SI module (left sidebar) |
|-----------|--------------------------|
| "I don't see Prompt Vault in the sidebar" | Discovery & Replies → **Prompt Vault** (Focus mode off, tabs expanded) |
| "Open Integrations / connect platform" | System → **Integrations → Connections** |
| "Go to https://…" | New tab (external) or in-app route (socialimperialism.com) |
| "Google Trends / SERP research" | Discovery & Replies → **SEO Tools** |
| "Pending AI replies" | Discovery & Replies → **AI Replies → Pending** |
| "Campaign Command / verified nodes" | System → **Campaign Command** |

Full catalog: Mission Control, Create & Publish, Discovery & Replies, Growth Labs, Automation, Accounts, System — see `apps/api/src/guide/guide_actions.js`.

## Roadmap (post v1.2.31)

- Video/screencast frame analysis (Protocol Alpha full)
- Per-tenant Success Velocity benchmarking against network top 1%
- Desktop Electron parity for UI mutation
- PR/changelog millisecond sync (Protocol Gamma full)

## Audit

Comply with [features/AUDIT_ACCURACY_RULE.md](./features/AUDIT_ACCURACY_RULE.md) — run `npm run audit:accuracy` before release claims.