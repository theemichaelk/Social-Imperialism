# Feature: Guardian & Self-Healing Gatekeeper

**Domain:** socialimperialism.com  
**Status:** Live (June 2026)  
**Admin identity:** THEE_MICHAEL  
**Brain:** [../GUARDIAN_GATEKEEPER.md](../GUARDIAN_GATEKEEPER.md)

## Surfaces

| Surface | Path |
|---------|------|
| Settings panel | `GuardianGatekeeperPanel.tsx` → `/settings?tab=guardian-api` |
| Core handlers | `packages/core/src/guardianGatekeeper.js` |
| Desktop IPC | `apps/desktop/index.js` |
| Partner API | `GET /api/v1/guardian/status` |
| Sovereign coupling | Release requires kinetic 2FA when `liveFrozen` |

## Web UI capabilities

- Run Guardian scan, setup checklist, alert webhook test
- Approve pending tickets (`approve-guardian-change`)
- Release approved fixes (`release-guardian-fix` + kinetic session when frozen)

## Audit accuracy rule (mandatory)

Before any past/current/future update, comply with [AUDIT_ACCURACY_RULE.md](./AUDIT_ACCURACY_RULE.md): verify claims against code, run `node apps/api/_audit-accuracy-check.js`, run production QA, update Brain docs if counts change.