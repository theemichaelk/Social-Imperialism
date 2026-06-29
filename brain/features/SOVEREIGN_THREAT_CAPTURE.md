# Feature: THEE_MICHAEL Security Control (internal: Sovereign Threat Capture)

**Domain:** socialimperialism.com  
**Status:** Live (June 2026)  
**User-facing:** THEE_MICHAEL Security Control  
**Brain:** [../SOVEREIGN_THREAT_CAPTURE.md](../SOVEREIGN_THREAT_CAPTURE.md) · [THEE_MICHAEL_SECURITY.md](./THEE_MICHAEL_SECURITY.md)

## Scope

Applies to every module — past, current, and future:

- Mission Control, Create & Publish, Discovery & Replies, Growth Labs, Automation, Accounts, System
- Landing pages, funnels, forms, OAuth, Partner API, webhooks
- Imperialism Brain, Live Support, Guardian, Prompt Vault, content workflows
- All `brain/*.md` and `brain/features/*.md` memory files

## User-facing

| Surface | Behavior |
|---------|----------|
| Settings → Guardian & API | **THEE_MICHAEL Security Control** panel (Accept / Deny / History / Undo) |
| API errors `SOVEREIGN_*` | Request held for THEE_MICHAEL review; no exploit detail exposed |
| Live freeze | Sensitive channels blocked until THEE_MICHAEL Accept |

## Admin-only

| Action | Requirement |
|--------|-------------|
| Accept / Deny pending action | Authorized admin (`thee-michael-decide-threat`) |
| Undo past decision | Authorized admin (`thee-michael-undo-action`) |
| View sealed telemetry | Kinetic 2FA + authorized email |
| Approve production release | Kinetic 2FA + Guardian approval ticket |

## IPC channels (**11**)

See [THEE_MICHAEL_SECURITY.md](./THEE_MICHAEL_SECURITY.md) for full channel list.

## Platform coverage

| Surface | Implementation |
|---------|----------------|
| SaaS API `/api/invoke` | `sovereignThreatShield` middleware |
| Partner API `/api/v1/invoke` | Same middleware |
| Auth login failures | `sovereignAuthFailureCapture` |
| Web app | `SovereignThreatBanner`, `SovereignThreatPanel`, `api.ts` |
| Desktop Electron | Native IPC in `apps/desktop/index.js` |
| Static S3 landing | `s3-website/sovereign-landing-shield.js` |
| Kinetic 2FA | Email + Guardian webhook delivery in production |
| Credential false positives | Redacted scan + `admin-clear-sovereign-false-positives` |

## Audit accuracy rule (mandatory)

Before any past/current/future update, comply with [AUDIT_ACCURACY_RULE.md](./AUDIT_ACCURACY_RULE.md): verify claims against code, run `npm run audit:accuracy`, run `npm run test:sovereign-scan`, run production QA, update Brain docs if counts change.

## Development checklist (every PR)

- [ ] [AUDIT_ACCURACY_RULE.md](./AUDIT_ACCURACY_RULE.md) checklist complete
- [ ] New routes pass sovereignThreatShield or document exemption
- [ ] No credentials in logs or Brain docs
- [ ] THEE_MICHAEL Accept/Deny wired for new security-impacting actions
- [ ] Brain/agent docs updated if new surface added