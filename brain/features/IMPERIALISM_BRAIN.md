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
| Live navigation | `apps/web/src/lib/liveSupportActions.ts` | Auto-redirect from any console |
| Navigator host | `apps/web/src/components/BrainNavigatorHost.tsx` | Toast + sidebar highlight |
| Overlord protocol | `apps/web/src/lib/theeMichaelOverlord.ts` | THEE_MICHAEL predictive execution |
| Overlord host | `apps/web/src/components/OverlordProtocolHost.tsx` | Interventions + UI mutation |
| Brain doc | `brain/THEE_MICHAEL_OVERLORD.md` | Canonical overlord spec |

## Internal agent ids (stable, not user-facing)

- `omni-brain-planner` — workflow blueprints
- `live-support-growth` — in-product support

## Prompt Vault seeds

- `pv_seed_omni_brain` (`feature: omni-brain`)
- `pv_seed_live_support` (`feature: support`)

## Audit accuracy rule (mandatory)

Before any past/current/future update, comply with [AUDIT_ACCURACY_RULE.md](./AUDIT_ACCURACY_RULE.md): verify claims against code, run `node apps/api/_audit-accuracy-check.js`, run production QA, update Brain docs if counts change.