# Feature: Sovereign Threat Capture Layer

**Domain:** socialimperialism.com  
**Status:** Live (June 2026)  
**Brain:** [../SOVEREIGN_THREAT_CAPTURE.md](../SOVEREIGN_THREAT_CAPTURE.md)

## Scope

Applies to every module — past, current, and future:

- Mission Control, Create & Publish, Discovery & Replies, Growth Labs, Automation, Accounts, System
- Landing pages, funnels, forms, OAuth, Partner API, webhooks
- Imperialism Brain, Live Support, Guardian, Prompt Vault, content workflows
- All `brain/*.md` and `brain/features/*.md` memory files

## User-facing

| Surface | Behavior |
|---------|----------|
| Settings → Guardian & API | Sovereign Threat panel below Guardian |
| API errors `SOVEREIGN_*` | Request contained; no exploit detail exposed |
| Live freeze | Sensitive channels blocked until admin release |

## Admin-only

| Action | Requirement |
|--------|-------------|
| View sealed telemetry | Kinetic 2FA + authorized email |
| Approve production release | Kinetic 2FA + Guardian approval ticket |
| Decrypt attack vectors | Never shown to non-admin users |

## Security event template

Stored in Brain — see banner block in [SOVEREIGN_THREAT_CAPTURE.md](../SOVEREIGN_THREAT_CAPTURE.md).

## Platform coverage

| Surface | Implementation |
|---------|----------------|
| SaaS API `/api/invoke` | `sovereignThreatShield` middleware |
| Partner API `/api/v1/invoke` | Same middleware |
| Auth login failures | `sovereignAuthFailureCapture` |
| Web app | `SovereignThreatBanner`, `SovereignThreatPanel`, `api.ts` client hook |
| Desktop Electron | Native IPC in `apps/desktop/index.js` |
| Static S3 landing | `s3-website/sovereign-landing-shield.js` |
| Kinetic 2FA | Email + Guardian webhook delivery in production |

## Development checklist (every PR)

- [ ] New routes pass sovereignThreatShield or document exemption
- [ ] No credentials in logs or Brain docs
- [ ] Production changes require THEE_MICHAEL / kinetic path when security-impacting
- [ ] Brain/agent docs updated if new surface added