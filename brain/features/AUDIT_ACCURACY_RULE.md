# Audit Accuracy Rule — socialimperialism.com

**Rule id:** `audit-accuracy-rule`  
**Applies to:** All **past**, **current**, and **future** work on SocialImperialism.com — code, Brain memory, features, deployments, agent summaries, and PR notes.

Every feature index in `brain/features/*.md`, every agent doc in `brain/*.md`, and every system update **must** be checked and corrected against this rule before merge or production release.

### Past / current / future obligation

When reviewing **any** change — including retroactive audits of earlier assistant summaries — agents must:

1. **Distrust empty success claims** — "done", "fixed", "deployed", or "verified" without verifier exit 0 is **false** until proven.
2. **Re-count** — module routes, IPC channels, QA features, and user-facing strings from source files; never reuse stale numbers from chat history.
3. **Cross-check user-facing copy** — banner text, error messages, Prompt Vault seeds, S3 landing shield, and settings UI must say **THEE_MICHAEL Security Control**, not "Sovereign" (internal file names may stay `sovereign*`).
4. **Fix + re-run** — correct inaccuracies, then run the full verifier chain below; repeat until all exit 0.
5. **Update this file** — if structure or counts change, update the verified table **before** claiming complete.

---

## Mandatory workflow (every update)

1. **Read verified facts** — table below is authoritative; do not claim more without re-counting.
2. **Run local audit** — `npm run audit:accuracy` (must exit 0).
3. **Run sovereign scan** — `npm run test:sovereign-scan` (must exit 0).
4. **Run production QA** — `API_URL=https://api.socialimperialism.com node apps/api/_test-qa-all-pages.js` and `_test-qa-all-sections.js` (must be 0 BROKEN).
5. **Cross-check Brain** — update `brain/FEATURES.md`, relevant `brain/features/*.md`, and agent docs if counts or surfaces change.
6. **Never overstate** — if a capability is partial, document the exact surface (file path, route, channel). Do not claim "done" without verifier exit 0.

---

## Verified facts (July 2026 — re-count when structure changes)

| Claim | Verified value | How to verify |
|-------|----------------|---------------|
| QA module pages | **29** routes | `apps/api/_test-qa-all-pages.js` `PAGES.length` |
| QA page features | **217** OK (0 ERROR, 0 WEAK) | Production `_test-qa-all-pages.js` summary (re-count after test changes) |
| QA section features | **144** OK | Production `_test-qa-all-sections.js` summary (re-count after test changes) |
| `PageShell` + `PageFocusRail` | **29** module routes | `pageFocus.ts` keys + `apps/web/src/app/**/page.tsx` |
| SaaS IPC handlers | **417** | `node apps/api/_audit-accuracy-check.js` → handler registry count |
| Imperial Video Studio | **12** pipelines · **52** tools · **620** skills | `get-imperial-video-studio-config` |
| Social Imperialism SERP | **2** integration keys · **1** status IPC · same `serp-search` | `packages/core/src/siSerpClient.js` |
| Imperial pipeline A / B | **18** / **8** steps | `get-imperial-pipeline-config` |
| `ManageableTabNav` focus mode | **7** pages | dashboard, browse-posts, history, settings, integrations, content-library, account-creator |
| `ContentHubTabNav` focus mode | **1** page | content-hub |
| User-facing brain name | **Imperialism Brain** | `ImperialismBrainPromptBar`, nav label, support page |
| Internal planner lib | `omniBrainPlanner.ts` | Stable internal id `omni-brain-planner` — not user-facing |
| Admin identity | **THEE_MICHAEL** | Guardian, Security Control, Live Support |
| User-facing security UI | **THEE_MICHAEL Security Control** | `SovereignThreatPanel`, `SovereignThreatBanner` — not "Sovereign" user-facing |
| Security IPC channels | **11** | see `THEE_MICHAEL_SECURITY.md` (internal file: `sovereignThreatCapture.js`) |
| THEE_MICHAEL Accept/Deny | Required before action final | `thee-michael-decide-threat` |
| THEE_MICHAEL action history | Full log + Undo | `get-thee-michael-action-history`, `thee-michael-undo-action` |
| Public marketing pages | Self-update from `nav.ts` | `siteBlueprint.ts` — do not hardcode module counts |
| Sovereign API shield | `/api/invoke/*`, `/api/v1/invoke/*`, auth login capture | `sovereignThreatShield.js`, `auth.js` |
| Desktop Sovereign IPC | Native | `apps/desktop/index.js` registers handlers |
| S3 landing shield | Client-side | `s3-website/sovereign-landing-shield.js` |
| Kinetic 2FA production | Email + Guardian webhook | `sovereignThreatCapture.js` `deliverKineticChallenge` |
| Kinetic 2FA dev only echo | `devCode` non-production | `NODE_ENV !== 'production'` |

---

## Common inaccuracies (do not repeat)

| Wrong claim | Correct statement |
|-------------|-------------------|
| "ManageableTabNav on all 25 pages" | Only **7** tab-heavy pages; others use `PageShell` only or `ContentHubTabNav` |
| "Omni-Brain / Growth Agent" user-facing | User-facing name is **Imperialism Brain** |
| "Sovereign on every HTTP route" | Shield on invoke + partner invoke + auth failures; static landing uses client script |
| "149/149 QA" | **152/152** after THEE_MICHAEL history tests added |
| "135/135 sections" | **138/138** after THEE_MICHAEL history tests added |
| "151/151 QA" (stale) | **152/152** — re-run production QA after any test change |
| "137/137 sections" (stale) | **138/138** — re-run production QA after any test change |
| "SOVEREIGN THREAT CAPTURED" banner | User-facing: **THEE_MICHAEL SECURITY REVIEW REQUIRED** |
| "Kinetic code shown in production API" | Code delivered via **email/webhook** only in production |
| "18 app modules" on landing | **26** authenticated module routes in SaaS |
| "25 module routes" (stale) | **28** — re-count `pageFocus.ts` |
| "26 module routes" (stale) | **28** — re-count `pageFocus.ts` |
| "350 IPC handlers" (stale) | **398** — re-run `npm run audit:accuracy` |
| "371 IPC handlers" (stale) | **398** — re-run `npm run audit:accuracy` |
| "379 IPC handlers" (stale) | **398** — re-run `npm run audit:accuracy` |
| "7 Sovereign IPC channels" | **11** channels — see `THEE_MICHAEL_SECURITY.md` |
| "Sovereign" user-facing brand | User-facing: **THEE_MICHAEL Security Control** |
| "Deployed/fixed without QA" | Must run `audit:accuracy` + `test:sovereign-scan` + production QA |
| "Accept/Deny not implemented" | `thee-michael-decide-threat` + panel buttons verified |

---

## Security + accuracy coupling

All feature updates must also comply with [SOVEREIGN_THREAT_CAPTURE.md](../SOVEREIGN_THREAT_CAPTURE.md). Accuracy audits do not replace security containment — both are required.

---

## Feature index files (this folder)

| File | Feature |
|------|---------|
| [AUDIT_ACCURACY_RULE.md](./AUDIT_ACCURACY_RULE.md) | This rule — mandatory for all updates |
| [SOVEREIGN_THREAT_CAPTURE.md](./SOVEREIGN_THREAT_CAPTURE.md) | Security layer |
| [IMPERIALISM_BRAIN.md](./IMPERIALISM_BRAIN.md) | Planner + Live Support |
| [GUARDIAN_GATEKEEPER.md](./GUARDIAN_GATEKEEPER.md) | Ops health + approvals |
| [PAGE_FOCUS_UX.md](./PAGE_FOCUS_UX.md) | Focus rails + tab UX |
| [PROMPT_VAULT.md](./PROMPT_VAULT.md) | Prompt templates |
| [GROK_ENGINE.md](./GROK_ENGINE.md) | Grok browser automation |
| [SITE_BLUEPRINT.md](./SITE_BLUEPRINT.md) | Public pages self-update from nav + brain |
| [THEE_MICHAEL_SECURITY.md](./THEE_MICHAEL_SECURITY.md) | THEE_MICHAEL Security Control — Accept/Deny/Undo |
| [AETHELGARD_PROTOCOL.md](./AETHELGARD_PROTOCOL.md) | THEE_MICHAEL v3.0-Aethelgard — pipelines, R2, lead capture |
| [DESIGN_STUDIO.md](./DESIGN_STUDIO.md) | Design Studio — Imperialism Design Compositor |
| [THEE_MICHAEL_SELF_HEAL.md](./THEE_MICHAEL_SELF_HEAL.md) | Self-heal journal, daily audit, recommendations |
| [THEE_MICHAEL_SEO_INTELLIGENCE.md](./THEE_MICHAEL_SEO_INTELLIGENCE.md) | AEO/GEO/local/national SEO intelligence |
| [THEE_MICHAEL_OVERLORD.md](./THEE_MICHAEL_OVERLORD.md) | Predictive overlord + live guide actions |
| [ISSUE_CONTROL_PLANE.md](./ISSUE_CONTROL_PLANE.md) | THEE_MICHAEL GitOps issue console |
| [CAMPAIGN_MASTERY.md](./CAMPAIGN_MASTERY.md) | A→Z campaign mastery guide |
| [ONBOARDING_INTELLIGENCE.md](./ONBOARDING_INTELLIGENCE.md) | Setup wizard brand research + drip |

---

## Agent obligation

When implementing, documenting, or summarizing any Social Imperialism change:

- Cite **file paths and counts** from this rule or re-run the audit script.
- Update this file's verified table if structure changes.
- Add the audit checklist to any new `brain/features/*.md` feature index.
- Add the audit rule block to any new `brain/*.md` agent doc.

## Brain docs with audit rule (mandatory reference)

| Doc | Role |
|-----|------|
| `brain/BRAIN.md` | Master index |
| `brain/AGENTS.md` | Agent registry |
| `brain/FEATURES.md` | Feature catalog |
| `brain/GROWTH_ENGINE.md` | Growth brain engine |
| `brain/GUARDIAN_GATEKEEPER.md` | Guardian agent |
| `brain/LIVE_SUPPORT_AGENT.md` | Live support agent |
| `brain/OMNI_BRAIN_PLANNER.md` | Imperialism Brain planner |
| `brain/PROMPT_VAULT.md` | Prompt Vault |
| `brain/GROK.md` | Grok Engine |
| `brain/SOVEREIGN_THREAT_CAPTURE.md` | Sovereign security layer |
| `brain/THEE_MICHAEL_SELF_HEAL.md` | Self-heal + daily improvements |
| `brain/THEE_MICHAEL_SEO_INTELLIGENCE.md` | SEO intelligence layer |
| `brain/THEE_MICHAEL_OVERLORD.md` | Predictive overlord protocol |
| `brain/features/*.md` | Per-feature indexes |
| `brain/features/SITE_BLUEPRINT.md` | Public pages self-update rule |
| `apps/web/src/lib/siteBlueprint.ts` | Marketing nav, footer, stats source |