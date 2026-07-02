# THEE_MICHAEL Self-Heal & Daily Improvement Protocol

> Self-documenting errors · daily self-audit · safe auto-fixes · user recommendations
> Audit rule: [features/AUDIT_ACCURACY_RULE.md](features/AUDIT_ACCURACY_RULE.md)
> SEO layer: [THEE_MICHAEL_SEO_INTELLIGENCE.md](THEE_MICHAEL_SEO_INTELLIGENCE.md)

## Overview

v1.2.34 extends Imperialism Brain with a perpetual self-improvement loop:

1. **Document** every error with root cause, suggested fix, and learning takeaway
2. **Audit** daily across Guardian, integrations, queues, keywords, and SEO intelligence
3. **Auto-fix** safe issues (due posts requeue, guardian rescan) with journal entries
4. **Recommend** prioritized user improvements from accumulated SEO + health + engagement data

## Storage Keys (ProjectSetting + store)

| Key | Content |
|-----|---------|
| `selfHealErrorJournal` | Errors + fixes with resolution status |
| `selfHealAuditLog` | Daily audit results (30 entries max) |
| `selfHealDailyRecommendations` | Top 12 prioritized improvement actions |
| `selfHealLearningMemory` | Learned patterns from errors/fixes/audits |

## API Routes (`/api/self-heal`)

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/status` | Journal summary + last audit + recommendations |
| GET | `/journal` | Full error/fix journal + learning |
| GET | `/recommendations/daily` | Today's improvement actions |
| POST | `/audit/run` | Manual self-heal audit (same as daily scheduler) |

## Scheduler

`apps/api/src/scheduler.js` runs `tickDailySelfHeal()` every 24h (configurable via `SCHEDULER_SELF_HEAL_MS`). Also runs 2 minutes after API startup.

## Safe Auto-Fixes

| Fix | Channel | Learning |
|-----|---------|----------|
| Re-process due posts | `process-due-scheduled-posts` | Clears scheduling backlog |
| Refresh Guardian scan | `run-guardian-scan` | Surfaces token/integration issues early |

High-risk fixes still require Issue Control / THEE_MICHAEL approval.

## Issue Control Integration

`interceptRuntimeIssue` now appends to `selfHealErrorJournal` with root cause + patch reference.

## Live Support Integration

- Panel shows **Today's top improvements** banner on open
- Prompts include `SELF_HEAL_EXPERT_APPEND` + daily recommendations + journal context
- User can say **"run audit now"** or **"what should I improve today?"**

## IPC Handlers

- `get-self-heal-status`
- `get-daily-recommendations`
- `get-self-heal-journal`
- `run-self-heal-audit-local`