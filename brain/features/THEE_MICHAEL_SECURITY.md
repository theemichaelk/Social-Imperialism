# Feature: THEE_MICHAEL Security Control

**Domain:** socialimperialism.com  
**Status:** Live (June 2026)  
**User-facing name:** THEE_MICHAEL Security Control  
**Internal layer id:** `sovereign-threat-capture` (stable IPC/file names)  
**Brain:** [../SOVEREIGN_THREAT_CAPTURE.md](../SOVEREIGN_THREAT_CAPTURE.md)

## User-facing vs internal (do not confuse)

| User-facing | Internal (code) |
|-------------|-----------------|
| THEE_MICHAEL Security Control | `sovereignThreatCapture.js`, `SovereignThreatPanel.tsx` |
| THEE_MICHAEL banner | `THEE_MICHAEL_BANNER` in `sovereignThreatCapture.ts` |
| Accept / Deny / Undo | `thee-michael-decide-threat`, `thee-michael-undo-action` |
| Settings → Guardian & API | `/settings?tab=guardian-api` |

## Workflow (verified)

1. Threat or blocked request captured → **pending** until THEE_MICHAEL decides.
2. **Accept** — releases containment, action final.
3. **Deny** — keeps block active, action final.
4. **Full history** — `get-thee-michael-action-history` (filter + undo).
5. **Undo** — reverts Accept/Deny, event returns to pending.
6. **Kinetic 2FA** — optional for sealed telemetry decrypt only (not required for Accept/Deny).

## IPC channels (**11** — count from `sovereignThreatCapture.js`)

| Channel | Purpose |
|---------|---------|
| `get-sovereign-threat-status` | Status, events, action history |
| `get-thee-michael-action-history` | Full decision history |
| `thee-michael-decide-threat` | Accept (`approve`) or Deny (`deny`) |
| `thee-michael-undo-action` | Revert a past decision |
| `capture-sovereign-threat` | Log threat |
| `request-kinetic-2fa-challenge` | 2FA challenge |
| `verify-kinetic-2fa` | 2FA verify |
| `decrypt-sovereign-threat-telemetry` | Decrypt sealed telemetry |
| `approve-sovereign-threat-release` | Legacy release + kinetic |
| `admin-clear-sovereign-false-positives` | False-positive cleanup |
| `run-sovereign-threat-scan` | Health scan |

## Key files

- `packages/core/src/sovereignThreatCapture.js`
- `apps/api/src/middleware/sovereignThreatShield.js`
- `apps/web/src/components/SovereignThreatPanel.tsx`
- `apps/web/src/lib/sovereignThreatCapture.ts`

## Audit accuracy rule (mandatory)

Before any past/current/future update, comply with [AUDIT_ACCURACY_RULE.md](./AUDIT_ACCURACY_RULE.md): verify claims against code, run `node apps/api/_audit-accuracy-check.js`, run `npm run test:sovereign-scan`, run production QA, update Brain docs if counts change.