# Feature: Onboarding Intelligence

**Domain:** socialimperialism.com  
**Status:** Live (July 2026)  
**Route:** `/onboarding` (Setup Wizard)

## Components

| Surface | Path |
|---------|------|
| Intelligence lib | `apps/web/src/lib/onboardingIntelligence.ts` |
| Expert persona | `apps/web/src/lib/theeMichaelOnboardingExpert.ts` |
| Brand research API | `apps/api/src/onboarding/brandResearchOrchestrator.js` |
| Email sequences | `apps/api/src/onboarding/onboardingEmailSequences.js` |
| Live Support | `apps/web/src/lib/liveSupportAgent.ts` → `ONBOARDING_EXPERT_APPEND` |

## Capabilities

- Brand research orchestration (keywords, monitors, auto-rules seed)
- **SERP (complement):** Integrations step may configure **Social Imperialism SERP** (self-hosted) or SerpAPI — see [SOCIAL_IMPERIALISM_SERP.md](./SOCIAL_IMPERIALISM_SERP.md); does not alter wizard IPC channel list
- Verified node campaign bootstrap
- Onboarding drip email sequences
- Live Support routing for stuck setup steps

## IPC channels (wizard)

- `get-setup-status`, `save-settings`, `set-active-campaign`
- `generate-keywords`, `save-watched-monitors`, `save-auto-rules`
- `seed-verified-campaign`, `list-verified-campaigns`

## Audit accuracy rule (mandatory)

Before any past/current/future update, comply with [AUDIT_ACCURACY_RULE.md](./AUDIT_ACCURACY_RULE.md): verify claims against code, run `node apps/api/_audit-accuracy-check.js`, run production QA, update Brain docs if counts change.