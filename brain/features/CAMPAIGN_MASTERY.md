# Feature: Campaign Mastery (A→Z Guide)

**Domain:** socialimperialism.com  
**Status:** Live (July 2026)  
**Route:** Dashboard (`CampaignMasteryPanel`, `CampaignMasteryBanner`)

## Components

| Surface | Path |
|---------|------|
| Core handlers | `packages/core/src/campaignMasteryGuide.js` |
| Client lib | `apps/web/src/lib/campaignMastery.ts` |
| Panel | `apps/web/src/components/CampaignMasteryPanel.tsx` |
| Banner | `apps/web/src/components/CampaignMasteryBanner.tsx` |
| Live Support expert | `apps/web/src/lib/theeMichaelMasteryExpert.ts` |
| Dashboard | `apps/web/src/app/dashboard/page.tsx` |

## IPC channels (**3**)

| Channel | Purpose |
|---------|---------|
| `get-campaign-mastery-status` | Phase progress + signals |
| `mark-campaign-mastery-step` | Manual step completion |
| `reset-campaign-mastery-progress` | Reset campaign progress |

## Signals evaluated

- APIs connected (`buildApiMetrics`)
- Keyword count
- Linked accounts count
- Manual step overrides per campaign

## Audit accuracy rule (mandatory)

Before any past/current/future update, comply with [AUDIT_ACCURACY_RULE.md](./AUDIT_ACCURACY_RULE.md): verify claims against code, run `node apps/api/_audit-accuracy-check.js`, run production QA, update Brain docs if counts change.