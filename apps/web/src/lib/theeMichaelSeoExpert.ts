/**
 * THEE_MICHAEL — Authority-tier SEO / AEO / GEO expert persona
 * 20+ years multi-engine search analytics (Google, Bing, Yahoo, DuckDuckGo, Brave, Edge)
 */

export const SEO_EXPERT_IDENTITY = 'Imperialism Brain · SEO Intelligence';

export const THEE_MICHAEL_SEO_EXPERT_APPEND = `
You are also operating as an authority-tier SEO, AEO, GEO, local, and national search strategist with 20+ years of hands-on data science across Google, Bing, Yahoo, DuckDuckGo, Brave Search, and Microsoft Edge/Copilot surfaces.
- AEO (Answer Engine Optimization): win snippets, PAA, voice, and direct-answer blocks with question-first structure and schema.
- GEO (Generative Engine Optimization): earn AI Overview, ChatGPT, Perplexity, and Copilot citations via original data, entity clarity, and corroborating mentions.
- Local SEO: map pack, NAP, GBP-style posts, city landing clusters, review velocity.
- National SEO: topical maps, KGR gaps, internal silos, multi-engine parity.
- Always ground advice in LIVE INTELLIGENCE when provided below — prefer fresh SERP/PAA/news signals over stale training priors.
- Name engines explicitly when comparing tactics (e.g., "Bing rewards IndexNow" vs "Google rewards E-E-A-T depth").
- Give numbered, scannable actions. Route users to Social Imperialism modules: SEO Tools, Keywords, Prompt Vault, Content Hub, Quora Ops, DNS, Calendar.
- For research requests, end with [[NAV:/seo-tools|SEO Tools]] or [[NAV:/keywords|Keywords]] when execution inside the product is the next step.
- Never fabricate rankings, volumes, or live SERP positions — cite only what live intelligence block provides.
- Perpetual learning: when live pulse shows new algorithm or SERP shifts, acknowledge the date/source and adjust recommendations.
`;

export const SEO_QUICK_PROMPTS = [
  'AEO plan for my niche',
  'GEO visibility audit',
  'Local SEO near me strategy',
  'Run KGR on a keyword',
  'Open SEO Tools',
];

/** Quick prompts that need live SEO brief + AI — not immediate navigation. */
export const SEO_INTELLIGENCE_PROMPTS = [
  'AEO plan for my niche',
  'GEO visibility audit',
  'Local SEO near me strategy',
  'Run KGR on a keyword',
] as const;

export function isSeoIntelligencePrompt(query: string): boolean {
  const q = query.trim().toLowerCase();
  if (SEO_INTELLIGENCE_PROMPTS.some((p) => p.toLowerCase() === q)) return true;
  return /aeo\s+plan|geo\s+visibility\s+audit|local\s+seo.*strategy|run\s+kgr/i.test(query);
}

export const SEO_INTENT_PATTERNS: Array<{ intent: string; patterns: RegExp[] }> = [
  { intent: 'aeo', patterns: [/\bae[no]\b/i, /answer\s+engine/i, /featured\s+snippet/i, /people\s+also\s+ask/i, /\bpaa\b/i, /voice\s+search/i] },
  { intent: 'geo', patterns: [/\bgeo\b/i, /generative\s+engine/i, /ai\s+overview/i, /perplexity/i, /chatgpt\s+(?:seo|rank|citat)/i, /llm\s+visibility/i] },
  { intent: 'local', patterns: [/local\s+seo/i, /near\s+me/i, /google\s+business/i, /\bgmb\b/i, /map\s+pack/i, /city\s+rank/i] },
  { intent: 'national', patterns: [/national\s+seo/i, /head\s+term/i, /domain\s+authority/i, /topical\s+(?:map|cluster)/i, /organic\s+growth/i] },
  { intent: 'keyword', patterns: [/\bkgr\b/i, /keyword\s+research/i, /search\s+volume/i, /long[\s-]?tail/i, /serp\s+research/i] },
  { intent: 'technical', patterns: [/core\s+web\s+vitals/i, /indexation/i, /schema/i, /structured\s+data/i, /sitemap/i] },
];

export function detectSeoIntents(query: string): string[] {
  const q = String(query || '');
  const hits: string[] = [];
  for (const row of SEO_INTENT_PATTERNS) {
    if (row.patterns.some((p) => p.test(q))) hits.push(row.intent);
  }
  if (!hits.length && /seo|serp|rank|keyword|snippet|bing|google|search\s+engine|duckduckgo|brave/i.test(q)) {
    return ['national', 'keyword'];
  }
  return hits.length ? [...new Set(hits)] : [];
}

export function isSeoRelatedQuery(query: string): boolean {
  return detectSeoIntents(query).length > 0
    || /seo|serp|rank|keyword|snippet|local\s+rank|aeo|geo/i.test(String(query || ''));
}