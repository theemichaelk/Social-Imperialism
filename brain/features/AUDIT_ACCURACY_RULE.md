# Audit Accuracy Rule — socialimperialism.com

**Rule id:** `audit-accuracy-rule`  
**Applies to:** All past, current, and future work on SocialImperialism.com — code, Brain memory, features, deployments, agent summaries, and PR notes.

Every feature index in `brain/features/*.md`, every agent doc in `brain/*.md`, and every system update **must** be checked and corrected against this rule before merge or production release.

---

## Mandatory workflow (every update)

1. **Read verified facts** — table below is authoritative; do not claim more without re-counting.
2. **Run local audit** — `node apps/api/_audit-accuracy-check.js` (must exit 0).
3. **Run production QA** — `API_URL=https://api.socialimperialism.com node apps/api/_test-qa-all-pages.js` and `_test-qa-all-sections.js` (must be 0 BROKEN).
4. **Cross-check Brain** — update `brain/FEATURES.md`, relevant `brain/features/*.md`, and agent docs if counts or surfaces change.
5. **Never overstate** — if a capability is partial, document the exact surface (file path, route, channel).

---

## Verified facts (June 2026 — re-count when structure changes)

| Claim | Verified value | How to verify |
|-------|----------------|---------------|
| QA module pages | **24** routes | `apps/api/_test-qa-all-pages.js` `PAGES.length` |
| QA page features | **151** OK | Production `_test-qa-all-pages.js` summary |
| QA section features | **137** OK | Production `_test-qa-all-sections.js` summary |
| `PageShell` + `PageFocusRail` | **24** module routes | `pageFocus.ts` keys + `apps/web/src/app/**/page.tsx` |
| `ManageableTabNav` focus mode | **7** pages | dashboard, browse-posts, history, settings, integrations, content-library, account-creator |
| `ContentHubTabNav` focus mode | **1** page | content-hub |
| User-facing brain name | **Imperialism Brain** | `ImperialismBrainPromptBar`, nav label, support page |
| Internal planner lib | `omniBrainPlanner.ts` | Stable internal id `omni-brain-planner` — not user-facing |
| Admin identity | **THEE_MICHAEL** | Guardian, Sovereign, Live Support |
| Sovereign IPC channels | **7** | see `SOVEREIGN_THREAT_CAPTURE.md` |
| Sovereign API shield | `/api/invoke/*`, `/api/v1/invoke/*`, auth login capture | `sovereignThreatShield.js`, `auth.js` |
| Desktop Sovereign IPC | Native | `apps/desktop/index.js` registers handlers |
| S3 landing shield | Client-side | `s3-website/sovereign-landing-shield.js` |
| Kinetic 2FA production | Email + Guardian webhook | `sovereignThreatCapture.js` `deliverKineticChallenge` |
| Kinetic 2FA dev only echo | `devCode` non-production | `NODE_ENV !== 'production'` |

---

## Common inaccuracies (do not repeat)

| Wrong claim | Correct statement |
|-------------|-------------------|
| "ManageableTabNav on all 24 pages" | Only **7** tab-heavy pages; others use `PageShell` only or `ContentHubTabNav` |
| "Omni-Brain / Growth Agent" user-facing | User-facing name is **Imperialism Brain** |
| "Sovereign on every HTTP route" | Shield on invoke + partner invoke + auth failures; static landing uses client script |
| "149/149 QA" | **151/151** after sovereign tests added |
| "135/135 sections" | **137/137** after sovereign tests added |
| "Kinetic code shown in production API" | Code delivered via **email/webhook** only in production |
| "18 app modules" on landing | **24** authenticated module routes in SaaS |

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
| `brain/features/*.md` | Per-feature indexes |