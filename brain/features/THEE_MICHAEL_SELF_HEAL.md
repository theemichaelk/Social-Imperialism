# Feature: THEE_MICHAEL Self-Heal

**Domain:** socialimperialism.com  
**Status:** Live (July 2026, v1.2.34)  
**Brain:** [../THEE_MICHAEL_SELF_HEAL.md](../THEE_MICHAEL_SELF_HEAL.md)

## Components

| Surface | Path |
|---------|------|
| API routes | `apps/api/src/routes/selfHeal.js` → `/api/self-heal/*` |
| Engine | `apps/api/src/selfHeal/selfHealEngine.js` |
| Scheduler | `apps/api/src/scheduler.js` → `tickDailySelfHeal()` |
| IPC handlers | `packages/core/src/selfHealHandlers.js` |
| Live Support | `apps/web/src/lib/liveSupportAgent.ts` → `SELF_HEAL_EXPERT_APPEND` |
| Panel banner | `apps/web/src/components/LiveSupportPanel.tsx` |

## IPC channels (**4**)

| Channel | Purpose |
|---------|---------|
| `get-self-heal-status` | Journal summary + last audit + recommendations |
| `get-daily-recommendations` | Today's improvement actions |
| `get-self-heal-journal` | Full error/fix journal + learning |
| `run-self-heal-audit-local` | Manual audit trigger (desktop) |

## REST routes

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/self-heal/status` | Status + recommendations |
| GET | `/api/self-heal/journal` | Full journal |
| GET | `/api/self-heal/recommendations/daily` | Daily improvements |
| POST | `/api/self-heal/audit/run` | Manual audit |

## Safe auto-fixes

- Re-process due posts (`process-due-scheduled-posts`)
- Refresh Guardian scan (`run-guardian-scan`)

High-risk fixes require Issue Control / THEE_MICHAEL approval.

## Audit accuracy rule (mandatory)

Before any past/current/future update, comply with [AUDIT_ACCURACY_RULE.md](./AUDIT_ACCURACY_RULE.md): verify claims against code, run `node apps/api/_audit-accuracy-check.js`, run production QA, update Brain docs if counts change.