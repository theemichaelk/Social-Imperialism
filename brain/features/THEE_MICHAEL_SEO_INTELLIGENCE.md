# Feature: THEE_MICHAEL SEO Intelligence

**Domain:** socialimperialism.com  
**Status:** Live (July 2026, v1.2.33)  
**Brain:** [../THEE_MICHAEL_SEO_INTELLIGENCE.md](../THEE_MICHAEL_SEO_INTELLIGENCE.md)

## Frameworks

| Acronym | SI modules |
|---------|------------|
| AEO | SEO Tools, Keywords, Prompt Vault, Content Hub |
| GEO | SEO Tools, Growth Lab, Quora Ops, Engagement |
| Local | SEO Tools, Keywords, DNS, Calendar |
| National | SEO Tools, Keywords, Content Hub, Brand |

## Components

| Surface | Path |
|---------|------|
| API routes | `apps/api/src/routes/seoIntel.js` → `/api/seo/*` |
| Engine | `apps/api/src/seo/seoIntelligenceEngine.js` |
| Expert persona | `apps/web/src/lib/theeMichaelSeoExpert.ts` |
| Client brief fetch | `apps/web/src/lib/seoIntelligence.ts` |
| Live Support | `apps/web/src/lib/liveSupportAgent.ts` |
| Guide actions | `apps/api/src/guide/guide_actions.js` |

## REST routes

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/seo/frameworks` | Engines + framework pillars |
| GET | `/api/seo/detect?q=` | Quick SEO intent detection |
| POST | `/api/seo/intelligence/brief` | Full live brief |
| POST | `/api/seo/intelligence/live-pulse` | News/PAA freshness |

## Live data

Requires `SERP_API_KEY` (server env) or tenant **Social Imperialism SERP / SerpAPI** under Integrations → Data & Research for IPC `serp-search`. Without any SERP provider: framework routing still works; live pulse returns connect guidance.

**Complements (does not replace):** [SOCIAL_IMPERIALISM_SERP.md](./SOCIAL_IMPERIALISM_SERP.md) — multi-engine browser SERP + `extract=N` page grounding. Social Imperialism SERP preferred when `siSerpBaseUrl` is set; SerpAPI remains fallback.

## Audit accuracy rule (mandatory)

Before any past/current/future update, comply with [AUDIT_ACCURACY_RULE.md](./AUDIT_ACCURACY_RULE.md): verify claims against code, run `node apps/api/_audit-accuracy-check.js`, run production QA, update Brain docs if counts change.