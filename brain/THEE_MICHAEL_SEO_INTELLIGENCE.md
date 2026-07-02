# THEE_MICHAEL SEO Intelligence Layer

> Canonical reference for AEO, GEO, local, and national SEO augmentation in Imperialism Brain.
> Audit rule: [features/AUDIT_ACCURACY_RULE.md](features/AUDIT_ACCURACY_RULE.md)

## Overview

v1.2.33 adds a perpetual-learning SEO intelligence layer to **Imperialism Brain** (Live Support) and the **live guide action planner**. THEE_MICHAEL operates as an authority-tier search strategist with 20+ years of multi-engine analytics across:

| Engine | SerpAPI | Notes |
|--------|---------|-------|
| Google | `google` | AI Overviews, PAA, Local Pack, Discover |
| Bing | `bing` | Copilot, Edge, IndexNow |
| Yahoo | `yahoo` | Bing-backed syndication |
| DuckDuckGo | `duckduckgo` | Privacy segment; instant answers |
| Brave | — | Framework parity; independent index mindset |
| Edge | `bing` | Copilot citation layer |

## Frameworks

| Acronym | Full name | Primary SI modules |
|---------|-----------|-------------------|
| **AEO** | Answer Engine Optimization | SEO Tools, Keywords, Prompt Vault, Content Hub |
| **GEO** | Generative Engine Optimization | SEO Tools, Growth Lab, Quora Ops, Engagement |
| **Local** | Local SEO | SEO Tools, Keywords, DNS, Calendar |
| **National** | National SEO | SEO Tools, Keywords, Content Hub, Brand |

## API Routes

Mounted at `/api/seo` (auth required):

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/frameworks` | List engines + framework pillars |
| `GET` | `/detect?q=` | Quick SEO intent detection |
| `POST` | `/intelligence/brief` | Full live brief (SERP + pulse + recommendations) |
| `POST` | `/intelligence/live-pulse` | News/PAA freshness pull |

## Client Integration

| File | Role |
|------|------|
| `apps/web/src/lib/theeMichaelSeoExpert.ts` | Expert persona + intent patterns |
| `apps/web/src/lib/seoIntelligence.ts` | Brief fetch + session learning memory |
| `apps/web/src/lib/liveSupportAgent.ts` | Augmented prompts + SEO routes |
| `apps/web/src/components/LiveSupportPanel.tsx` | Live SERP pulse before AI reply |
| `apps/api/src/seo/seoIntelligenceEngine.js` | Core engine |
| `apps/api/src/guide/guide_actions.js` | AEO/GEO/local/national navigation plans |

## Live Data Requirements

- **SerpAPI key** (`SERP_API_KEY` / `serpApiKey`) under **Integrations → Connections** unlocks:
  - Multi-engine SERP snapshots (Google, Bing, DuckDuckGo)
  - PAA clusters
  - Google News pulse for perpetual learning
- Without SerpAPI: framework knowledge + SI module routing still works; live pulse returns connect guidance.

## Session Learning

Client stores last 12 insights in `localStorage` key `si_seo_learning`. Each successful brief appends SERP leaders and pulse insights for cross-turn context.

## Guide Action Keywords

Natural language triggers:

- **AEO**: `answer engine`, `featured snippet`, `PAA`, `people also ask`
- **GEO**: `generative engine`, `AI overview`, `LLM visibility`, `Perplexity`
- **Local**: `local SEO`, `near me`, `GMB`, `map pack`
- **National**: `national SEO`, `head term`, `topical map`, `domain authority`