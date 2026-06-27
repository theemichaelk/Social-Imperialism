# Sovereign Threat Capture Layer — socialimperialism.com

Persistent security requirement for **all** Social Imperialism surfaces: public website, web application, content systems, dashboards, admin tools, analytics, automation hooks, integrations, Brain memory, and future modules.

**Layer id:** `sovereign-threat-capture`  
**Admin identity:** `THEE_MICHAEL`  
**Runs with:** [GUARDIAN_GATEKEEPER.md](./GUARDIAN_GATEKEEPER.md) (Guardian handles ops health; Sovereign handles threat capture, encryption, containment)

---

## Security Event Template

Every captured threat is stored using this canonical template (telemetry sealed; public view is redacted):

```
🛡️ SOVEREIGN THREAT CAPTURED // SOCIALIMPERIALISM.COM PROTECTION ENFORCED

Supreme governing authority: authorized SocialImperialism.com ownership and security administration.
Physical system steward: registered site owner or designated platform operator.
Executive human control: authorized SocialImperialism.com administrators only.
Kinetic 2FA challenge: require registered administrator verification before telemetry decryption,
  production patch approval, or sensitive security review.
Mutated attack vector: encrypted until authorized administrative review.
Website architecture involved: encrypted until authorized administrative review.
Deep analytical metrics: intrusion target, exploit mechanism, affected website assets, user data
  exposure risk, and moderation impact remain sealed inside protected telemetry.
Predictive web intelligence matrix: sourced research, threat reputation signals, abuse patterns,
  bot behavior, and mitigation mapping remain encrypted until authorized release.
Guardian sandbox self-heal log: containment status, patch readiness, regression results, and
  sandbox verification must be recorded without exposing secrets, credentials, user data, or
  exploit instructions.
System horizon: threat neutralized, contained, and resolved inside the sandbox. Live website code
  paths, public pages, admin tools, publishing workflows, and automation hooks remain frozen until
  administrator verification approves decryption and production deployment.
```

---

## Core Rules (mandatory for all development)

1. **Capture** — Every threat event (probe, abuse, auth attack, channel abuse, client anomaly) must be logged through `capture-sovereign-threat` or API-edge `sovereignThreatShield`.
2. **Contain** — High/critical threats freeze live paths (`liveFrozen`) and block affected channels/modules until release.
3. **Encrypt** — Full telemetry uses AES-256-GCM per-project sealing. Public UI shows redacted summaries only.
4. **Isolate** — Contained threats must not propagate to production traffic, publishing, or user data paths.
5. **Kinetic 2FA** — Decrypt (`decrypt-sovereign-threat-telemetry`) and release (`approve-sovereign-threat-release`) require `verify-kinetic-2fa` session (authorized admin email channel).
6. **Guardian gate** — Production release also routes through Guardian approval when `approvalGateEnabled` is on.
7. **No secret leakage** — Sandbox logs, user-facing errors, and Brain docs must never include credentials, exploit recipes, or raw PII.

---

## Protected Surfaces

| Surface | Protection |
|---------|------------|
| Public website / landing | `s3-website/sovereign-landing-shield.js` client probe containment + authenticated app shell |
| Desktop Electron | Native IPC via `apps/desktop/index.js` (Guardian + Sovereign handlers) |
| Kinetic 2FA production | Admin email (SES/Acumbamail) + Guardian alert webhook; dev code echo non-production only |
| `/api/invoke/*` | sovereignThreatShield middleware |
| `/api/v1/invoke/*` (Partner API) | sovereignThreatShield middleware |
| `/api/auth/login` failures | sovereignAuthFailureCapture (brute-force logging) |
| Dashboards, sidebars, menus | Client `api.ts` + `SovereignThreatBanner` |
| Content publish / schedule | Channel freeze when contained |
| Admin tools / Settings | SovereignThreatPanel + kinetic 2FA |
| Partner API / webhooks | Guardian + sovereign status |
| Brain `*.md` | This requirement referenced in all agent docs |
| Future modules | Must register threat capture in PR checklist |

---

## IPC / API Channels

| Channel | Purpose |
|---------|---------|
| `get-sovereign-threat-status` | Redacted events + containment state |
| `capture-sovereign-threat` | Log and contain threat |
| `request-kinetic-2fa-challenge` | Admin physical verification step |
| `verify-kinetic-2fa` | Unlock 15-minute decrypt/release session |
| `decrypt-sovereign-threat-telemetry` | Authorized admin decrypt |
| `approve-sovereign-threat-release` | Unfreeze + Guardian approval route |
| `run-sovereign-threat-scan` | Layer health scan |

---

## Integration Map

| Component | Path |
|-----------|------|
| Core handlers | `packages/core/src/sovereignThreatCapture.js` |
| API middleware | `apps/api/src/middleware/sovereignThreatShield.js` |
| Web panel | `apps/web/src/components/SovereignThreatPanel.tsx` |
| Web lib | `apps/web/src/lib/sovereignThreatCapture.ts` |
| Settings UI | `/settings?tab=guardian-api` |
| Features index | [features/SOVEREIGN_THREAT_CAPTURE.md](./features/SOVEREIGN_THREAT_CAPTURE.md) |

---

## Workflow Reference

All future work — content publishing, moderation, testing, incident recovery, performance optimization, integration, deployment — **must** reference this layer in design and PR notes.

When in doubt: capture → contain → encrypt → sandbox → kinetic 2FA → Guardian approval → release.