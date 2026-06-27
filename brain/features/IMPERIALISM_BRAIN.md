# Feature: Imperialism Brain

**Domain:** socialimperialism.com  
**Status:** Live (June 2026)  
**User-facing name:** Imperialism Brain  
**Brain:** [../OMNI_BRAIN_PLANNER.md](../OMNI_BRAIN_PLANNER.md) · [../LIVE_SUPPORT_AGENT.md](../LIVE_SUPPORT_AGENT.md)

## Components

| Surface | Path | User label |
|---------|------|------------|
| Universal prompt bar | `apps/web/src/components/ImperialismBrainPromptBar.tsx` | Imperialism Brain |
| Live Support panel | `apps/web/src/components/LiveSupportPanel.tsx` | Imperialism Brain (eyebrow) |
| Support page | `/support` | Imperialism Brain |
| Sidebar | `nav.ts` → `/support` | Imperialism Brain |
| Planner lib (internal) | `apps/web/src/lib/omniBrainPlanner.ts` | — |
| Support lib | `apps/web/src/lib/liveSupportAgent.ts` | — |

## Internal agent ids (stable, not user-facing)

- `omni-brain-planner` — workflow blueprints
- `live-support-growth` — in-product support

## Prompt Vault seeds

- `pv_seed_omni_brain` (`feature: omni-brain`)
- `pv_seed_live_support` (`feature: support`)

## Audit accuracy rule (mandatory)

Before any past/current/future update, comply with [AUDIT_ACCURACY_RULE.md](./AUDIT_ACCURACY_RULE.md): verify claims against code, run `node apps/api/_audit-accuracy-check.js`, run production QA, update Brain docs if counts change.