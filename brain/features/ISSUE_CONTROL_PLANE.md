# Feature: Issue Control Plane

**Domain:** socialimperialism.com  
**Status:** Live (July 2026)  
**Route:** `/dashboard/issues` (admin only)  
**Brain:** referenced in [../THEE_MICHAEL_SELF_HEAL.md](../THEE_MICHAEL_SELF_HEAL.md), [../THEE_MICHAEL_OVERLORD.md](../THEE_MICHAEL_OVERLORD.md)

## Components

| Surface | Path |
|---------|------|
| Core handlers | `packages/core/src/issueControlPlane.js` |
| Web-augmented repair | `packages/core/src/webAugmentedRepair.js` |
| Web page | `apps/web/src/app/dashboard/issues/page.tsx` |
| Sidebar | `nav.ts` → `dashboard-issues` (admin only) |
| Guide routing | `apps/api/src/guide/guide_actions.js` → `issue-control` |
| Live Support | `apps/web/src/lib/liveSupportActions.ts` |

## IPC channels

| Channel | Purpose |
|---------|---------|
| `get-active-issues` | Open platform issues |
| `get-issues-ledger` | Full repair ledger |
| `intercept-runtime-issue` | Capture runtime errors (internal) |
| `run-web-augmented-repair` | Web-augmented patch research |
| `approve-issue-patch` | THEE_MICHAEL approve patch |
| `deny-issue-patch` | Deny patch |
| `delete-issue` | Remove issue from queue |
| `edit-issue-patch` | Edit proposed patch |
| `dispatch-issue-diagnostic-email` | Email diagnostic bundle |
| `queue-issue-from-guardian-alert` | Guardian → Issue Control bridge |

## Integration

- `selfHealEngine.js` appends errors to `selfHealErrorJournal`
- `theeMichaelOverlord.ts` surfaces degraded modules → Issue Control CTA
- Requires platform admin (`isPlatformAdmin` / THEE_MICHAEL email)

## Audit accuracy rule (mandatory)

Before any past/current/future update, comply with [AUDIT_ACCURACY_RULE.md](./AUDIT_ACCURACY_RULE.md): verify claims against code, run `node apps/api/_audit-accuracy-check.js`, run production QA, update Brain docs if counts change.