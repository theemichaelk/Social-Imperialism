# Feature: Social Imperialism SERP Engine (complements SerpAPI)

**Domain:** socialimperialism.com — Integrations, SEO, Video Studio, Content Hub  
**Status:** Live (July 2026)  
**Audit rule:** [AUDIT_ACCURACY_RULE.md](./AUDIT_ACCURACY_RULE.md)

> **Additive feature doc.** Does not replace SerpAPI, THEE_MICHAEL SEO Intelligence, or Keyword Research. **Social Imperialism SERP** is the preferred tenant provider when `siSerpBaseUrl` is set; SerpAPI remains legacy fallback.

---

## What it is

**Social Imperialism SERP Engine** — browser-rendered live search across **Google, Bing, Yandex, Baidu, DuckDuckGo, and Ecosia**, with optional **page extraction** (`extract=N`) for AI grounding, SEO research, and automation.

| Capability | Social Imperialism SERP | SerpAPI (existing) |
|------------|-------------------------|-------------------|
| Multi-engine | ✅ six engines + megasearch | Mostly Google-centric |
| Browser-rendered SERP | ✅ default path | Vendor-managed |
| Page extract in one call | ✅ `extract=1..5` | Limited |
| Self-host on desktop / worker | ✅ `siSerpBaseUrl` | Paid SaaS key |
| Google Trends autocomplete | ❌ | ✅ when only SerpAPI set |

**Provider priority:** `siSerpBaseUrl` (+ optional `siSerpApiKey`) → **social-imperialism**; else `serpApiKey` → **serpapi**.

---

## SI integration surfaces

| Surface | Path / channel |
|---------|----------------|
| Core client | `packages/core/src/siSerpClient.js` |
| Unified router | `packages/core/src/serpProvider.js` |
| IPC search | `serp-search` (unchanged) |
| Provider status | `get-serp-provider-status` |
| Integrations UI | `integrationCatalog.ts` → Data & Research |
| Video Studio | `web-research` → `serp-search` |
| Content Hub | `ContentHubUtilitiesPanel` |
| Keyword related terms | `keywordResearch.js` → `serpRelatedTerms` |
| Campaign Mastery | `hasSerpOrSeo` includes `siSerpBaseUrl` |
| API metrics | `handlerRegistry` → `Social Imperialism SERP` |

Legacy key aliases still read: `openSerpBaseUrl`, `openSerpApiKey` (migration only — UI shows **siSerp***).

---

## Integrations → Data & Research

| Key | Purpose |
|-----|---------|
| `siSerpBaseUrl` | SERP API root, e.g. `http://127.0.0.1:7000` on desktop worker |
| `siSerpApiKey` | Optional bearer token for hosted SERP API |
| `serpApiKey` | Legacy SerpAPI fallback |

**Operator:** run the Social Imperialism SERP Docker service on the same host as the desktop app or local API worker (`port 7000`, `shm-size=2g` for headless browser). Cloud web app cannot reach `localhost` — point worker at a reachable URL or use desktop bridge.

---

## IPC: `serp-search`

```json
{
  "query": "small business automation",
  "engine": "google",
  "mega": true,
  "engines": ["google", "bing"],
  "limit": 10,
  "extract": 2,
  "extractMode": "auto",
  "lang": "EN",
  "region": "US"
}
```

**Response:** `success`, `data[]`, `provider` (`social-imperialism` | `serpapi`), `serpFeatures[]`, `clusters[]`, `relatedTerms[]`.

---

## Use by product area (complements sibling brains)

### AI & agents

- RAG: `extract=2` → `data[].extracted.content` markdown for Gemini/OpenRouter/Video Studio Research
- Imperialism Brain: cite `provider` + ranks from live block only
- Prompt Vault (`feature: seo`): seed from `relatedTerms` / `serpFeatures`

See: [IMPERIALISM_BRAIN.md](./IMPERIALISM_BRAIN.md), [PROMPT_VAULT.md](./PROMPT_VAULT.md)

### SEO

- THEE_MICHAEL SEO Intelligence REST may still use server `SERP_API_KEY`; IPC path uses Social Imperialism SERP when configured
- Rank / competitor workflows: megasearch + `site:` filters
- AEO/GEO: PAA + AI overview from `serpFeatures`

See: [THEE_MICHAEL_SEO_INTELLIGENCE.md](./THEE_MICHAEL_SEO_INTELLIGENCE.md)

### Automation & Video Studio

- Research stage: `{ query, extract: 1 }` before script proposal
- 12 pipelines unchanged; only `research` capability gate

See: [IMPERIAL_VIDEO_STUDIO.md](./IMPERIAL_VIDEO_STUDIO.md)

### Campaign Mastery & Onboarding

- `hasSerpOrSeo` when Social Imperialism SERP, SerpAPI, or DomDetailer connected

See: [CAMPAIGN_MASTERY.md](./CAMPAIGN_MASTERY.md), [ONBOARDING_INTELLIGENCE.md](./ONBOARDING_INTELLIGENCE.md)

---

## Agent contract

1. Do not remove SerpAPI documentation — Social Imperialism SERP is preferred when keys present.
2. Same IPC channel `serp-search` — router selects provider.
3. Video Studio counts unchanged (12 · 52 · 620 skills).
4. THEE_MICHAEL gates unchanged — SERP is read-only research.
5. User-facing name: **Social Imperialism SERP** — never expose third-party product names in UI copy.

---

## Verification

```bash
node -e "const p=require('./packages/core/src/serpProvider'); console.log(p.getSerpProviderStatus({ siSerpBaseUrl:'http://127.0.0.1:7000' }));"
```

Integrations → Test **Social Imperialism SERP** → `serp-search` with `extract: 1`.