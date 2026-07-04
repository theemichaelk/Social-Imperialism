/**
 * THEE_MICHAEL SEO Intelligence Engine
 * AEO · GEO · Local · National · Multi-engine live SERP augmentation
 */
const axios = require('axios');
const path = require('path');

const UA = 'SocialImperialism-SEO-Intel/1.2.33';
const BRIEF_CACHE = new Map();
const CACHE_TTL_MS = 8 * 60 * 1000;

const SEARCH_ENGINES = [
  {
    id: 'google',
    label: 'Google',
    serpEngine: 'google',
    shareNote: 'Dominant US search; powers AI Overviews, PAA, Local Pack, Discover.',
    signals: ['E-E-A-T', 'Core Web Vitals', 'structured data', 'entity clarity', 'helpful content'],
  },
  {
    id: 'bing',
    label: 'Bing',
    serpEngine: 'bing',
    shareNote: 'Powers Copilot, Edge sidebar, Windows search; rewards clarity + schema.',
    signals: ['IndexNow', 'Bing Webmaster', 'entity markup', 'freshness', 'multimedia'],
  },
  {
    id: 'yahoo',
    label: 'Yahoo',
    serpEngine: 'yahoo',
    shareNote: 'Bing-backed syndication; still matters for finance, news, legacy audiences.',
    signals: ['Bing parity', 'news sitemaps', 'brand SERP hygiene'],
  },
  {
    id: 'duckduckgo',
    label: 'DuckDuckGo',
    serpEngine: 'duckduckgo',
    shareNote: 'Privacy-first; blends Bing + own crawler; rewards direct answers.',
    signals: ['instant answers', 'clean titles', 'FAQ blocks', 'no tracking bloat'],
  },
  {
    id: 'brave',
    label: 'Brave Search',
    serpEngine: null,
    shareNote: 'Independent index + Goggles; growing privacy segment; mirror Google/Bing hygiene.',
    signals: ['independent index', 'summaries', 'schema', 'canonical discipline'],
  },
  {
    id: 'edge',
    label: 'Microsoft Edge',
    serpEngine: 'bing',
    shareNote: 'Bing/Copilot surface in browser; treat as Bing + conversational citation layer.',
    signals: ['Copilot citations', 'Bing parity', 'IndexNow', 'author bios'],
  },
];

const FRAMEWORKS = {
  aeo: {
    id: 'aeo',
    label: 'Answer Engine Optimization',
    acronym: 'AEO',
    description: 'Win featured snippets, PAA, voice answers, and AI citation blocks with direct, structured answers.',
    pillars: [
      'Question-first H2/H3 hierarchy mapped to PAA clusters',
      '40–60 word direct answer lede before depth',
      'FAQ + HowTo + Article schema with speakable markup',
      'Entity-linked author bios and corroborating sources',
      'Freshness signals on volatile queries (dates, stats, changelogs)',
    ],
    siModules: ['SEO Tools', 'Keywords', 'Prompt Vault', 'Content Hub'],
    nextActions: [
      'Run PAA in SEO Tools for seed keyword',
      'Cluster winners in Keywords monitor',
      'Draft answer-first posts in Create → Studio',
    ],
  },
  geo: {
    id: 'geo',
    label: 'Generative Engine Optimization',
    acronym: 'GEO',
    description: 'Optimize for ChatGPT, Perplexity, Gemini, Copilot, and AI Overviews that cite authoritative sources.',
    pillars: [
      'Citable statistics with primary-source links',
      'Original frameworks, tables, and proprietary data',
      'Brand entity consistency (same name, logo, sameAs schema)',
      'Topical authority clusters — not isolated posts',
      'Earn mentions on Reddit, Quora, and industry roundups',
    ],
    siModules: ['SEO Tools', 'Growth Lab', 'Quora Ops', 'Engagement'],
    nextActions: [
      'Scrape SERP for citation leaders in SEO Tools',
      'Publish original research in Content Hub',
      'Seed Quora Ops answers with source links',
    ],
  },
  local: {
    id: 'local',
    label: 'Local SEO',
    acronym: 'Local',
    description: 'Dominate map pack, near-me, and city+service queries with NAP consistency and review velocity.',
    pillars: [
      'Google Business Profile completeness + weekly posts',
      'NAP consistency across citations and DNS records',
      'Location pages with unique copy per city/neighborhood',
      'Review acquisition cadence and response SLA',
      'LocalBusiness + Service schema with geo coordinates',
    ],
    siModules: ['SEO Tools', 'Keywords', 'DNS', 'Engagement', 'Calendar'],
    nextActions: [
      'Add city keywords to Keywords monitor',
      'Verify domain/DNS records in DNS module',
      'Schedule local proof posts on Calendar',
    ],
  },
  national: {
    id: 'national',
    label: 'National SEO',
    acronym: 'National',
    description: 'Scale non-geo organic visibility across competitive head terms and category leaders.',
    pillars: [
      'Topical map + internal linking silos',
      'KGR and allintitle gap analysis before writing',
      'Linkable assets and digital PR cadence',
      'Technical crawl budget + indexation hygiene',
      'Multi-engine parity (Google, Bing, DuckDuckGo)',
    ],
    siModules: ['SEO Tools', 'Keywords', 'Content Hub', 'Brand'],
    nextActions: [
      'Run KGR on head terms in SEO Tools',
      'Group keyword clusters with Grouping Tool',
      'Align Brand voice for entity consistency',
    ],
  },
};

const INTENT_PATTERNS = [
  { intent: 'aeo', patterns: [/\bae[no]\b/i, /answer\s+engine/i, /featured\s+snippet/i, /people\s+also\s+ask/i, /\bpaa\b/i, /voice\s+search/i, /zero[\s-]?click/i] },
  { intent: 'geo', patterns: [/\bgeo\b/i, /generative\s+engine/i, /ai\s+overview/i, /chatgpt\s+citat/i, /perplexity/i, /copilot\s+search/i, /llm\s+visibility/i] },
  { intent: 'local', patterns: [/local\s+seo/i, /near\s+me/i, /google\s+business/i, /\bgmb\b/i, /map\s+pack/i, /city\s+rank/i, /\bnearby\b/i, /service\s+area/i] },
  { intent: 'national', patterns: [/national\s+seo/i, /organic\s+growth/i, /head\s+term/i, /competitive\s+keyword/i, /domain\s+authority/i, /topical\s+map/i] },
  { intent: 'keyword', patterns: [/\bkgr\b/i, /keyword\s+research/i, /search\s+volume/i, /long[\s-]?tail/i, /serp\s+research/i] },
  { intent: 'technical', patterns: [/core\s+web\s+vitals/i, /indexation/i, /crawl/i, /schema/i, /structured\s+data/i, /canonical/i, /sitemap/i] },
];

function classifyIntent(query) {
  const q = String(query || '');
  const hits = [];
  for (const row of INTENT_PATTERNS) {
    if (row.patterns.some((p) => p.test(q))) hits.push(row.intent);
  }
  if (!hits.length) {
    if (/seo|rank|serp|google|bing|search/i.test(q)) return ['national', 'keyword'];
    return ['general'];
  }
  return [...new Set(hits)];
}

function extractKeyword(query) {
  const q = String(query || '').trim();
  const quoted = q.match(/["']([^"']{2,80})["']/);
  if (quoted) return quoted[1].trim();

  const forMatch = q.match(/\b(?:for|keyword|term|query|rank(?:ing)?)\s+["']?([a-z0-9][\w\s\-]{2,60})/i);
  if (forMatch) return forMatch[1].replace(/[?.!,]$/, '').trim();

  const stop = new Set(['how', 'what', 'why', 'when', 'where', 'the', 'a', 'an', 'my', 'our', 'best', 'good', 'help', 'with', 'for', 'seo', 'local', 'national', 'aeo', 'geo', 'daily', 'growth', 'audit', 'platform', 'health']);
  const words = q.toLowerCase().replace(/[^\w\s-]/g, ' ').split(/\s+/).filter((w) => w.length > 2 && !stop.has(w));
  if (words.length >= 2) return words.slice(0, 4).join(' ');
  if (words.length === 1) return words[0];
  return null;
}

function extractLocation(query) {
  const q = String(query || '');
  const inCity = q.match(/\b(?:in|near|around)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/);
  if (inCity) return inCity[1];
  const zip = q.match(/\b\d{5}(?:-\d{4})?\b/);
  if (zip) return zip[0];
  return null;
}

function cacheKey(parts) {
  return JSON.stringify(parts);
}

function getCached(key) {
  const entry = BRIEF_CACHE.get(key);
  if (!entry) return null;
  if (Date.now() - entry.ts > CACHE_TTL_MS) {
    BRIEF_CACHE.delete(key);
    return null;
  }
  return entry.data;
}

function setCache(key, data) {
  BRIEF_CACHE.set(key, { ts: Date.now(), data });
  if (BRIEF_CACHE.size > 200) {
    const oldest = [...BRIEF_CACHE.entries()].sort((a, b) => a[1].ts - b[1].ts)[0];
    if (oldest) BRIEF_CACHE.delete(oldest[0]);
  }
}

async function serpRequest(keys, params) {
  if (!keys?.serpApiKey) return null;
  try {
    const res = await axios.get('https://serpapi.com/search.json', {
      params: { ...params, api_key: keys.serpApiKey },
      timeout: 20000,
      headers: { 'User-Agent': UA },
      validateStatus: () => true,
    });
    if (res.status !== 200) return { error: res.data?.error || `SerpAPI ${res.status}` };
    return res.data;
  } catch (e) {
    return { error: e.message };
  }
}

async function fetchEngineSnapshot(keyword, engineId, keys) {
  const engine = SEARCH_ENGINES.find((e) => e.id === engineId);
  if (!engine?.serpEngine || !keyword) return { engine: engineId, available: false, reason: 'No SerpAPI engine or keyword' };

  const data = await serpRequest(keys, {
    engine: engine.serpEngine,
    q: keyword,
    num: 8,
  });
  if (!data || data.error) {
    return { engine: engineId, label: engine.label, available: false, error: data?.error || 'SerpAPI unavailable' };
  }

  const organic = (data.organic_results || []).slice(0, 5).map((r) => ({
    position: r.position,
    title: r.title,
    link: r.link,
    snippet: (r.snippet || '').slice(0, 200),
  }));

  const paa = (data.related_questions || []).slice(0, 4).map((q) => q.question);
  const related = (data.related_searches || []).slice(0, 4).map((r) => r.query || r);

  return {
    engine: engineId,
    label: engine.label,
    available: true,
    totalResults: data.search_information?.total_results || null,
    organic,
    peopleAlsoAsk: paa,
    relatedSearches: related,
    localPack: !!(data.local_results?.places?.length),
    aiOverview: !!(data.ai_overview || data.answer_box),
  };
}

async function fetchLivePulse(topic, keys) {
  const q = String(topic || 'SEO algorithm updates').trim();
  const pulse = { topic: q, fetchedAt: new Date().toISOString(), sources: [], insights: [] };

  if (keys?.serpApiKey) {
    const newsData = await serpRequest(keys, { engine: 'google', q: `${q} SEO 2026`, tbm: 'nws', num: 5 });
    if (newsData && !newsData.error) {
      pulse.sources = (newsData.news_results || newsData.organic_results || []).slice(0, 5).map((n) => ({
        title: n.title,
        link: n.link,
        source: n.source || n.displayed_link,
        date: n.date,
        snippet: (n.snippet || '').slice(0, 180),
      }));
    }

    const paaData = await serpRequest(keys, { engine: 'google', q: q, num: 3 });
    if (paaData && !paaData.error) {
      const questions = (paaData.related_questions || []).slice(0, 3).map((x) => x.question);
      if (questions.length) pulse.insights.push(`Live PAA cluster: ${questions.join(' · ')}`);
    }
  }

  if (!pulse.sources.length) {
    pulse.sources = [
      {
        title: 'Framework mode — add SERP_API_KEY for live pulse',
        link: 'https://www.socialimperialism.com/integrations?tab=connections',
        source: 'Social Imperialism',
        snippet: 'Connect SerpAPI under Integrations → Connections to unlock real-time SERP, PAA, and news augmentation.',
      },
    ];
    pulse.insights.push('Operating on perpetual framework knowledge until SerpAPI key is connected.');
  } else {
    pulse.insights.push(`Pulled ${pulse.sources.length} live signals for "${q}" across Google news/SERP.`);
  }

  return pulse;
}

async function runSeoToolInvoke(invoke, projectId, orgId, toolId, payload) {
  if (!invoke) return null;
  try {
    const result = await invoke({
      projectId,
      organizationId: orgId,
      channel: 'run-seo-tool',
      args: [{ toolId, payload }],
    });
    return result?.data || result;
  } catch (e) {
    return { error: e.message };
  }
}

function buildRecommendations(intents, keyword, location) {
  const recs = [];
  for (const intent of intents) {
    const fw = FRAMEWORKS[intent];
    if (fw) {
      recs.push({
        framework: fw.acronym,
        label: fw.label,
        actions: fw.nextActions,
        siModules: fw.siModules,
      });
    }
  }
  if (intents.includes('keyword') || keyword) {
    recs.push({
      framework: 'Research',
      label: 'Keyword Intelligence',
      actions: [
        keyword ? `Run KGR on "${keyword}" in SEO Tools` : 'Run KGR on your seed term in SEO Tools',
        'Export PAA questions into Prompt Vault templates',
        'Add winners to Keywords monitor for ongoing SERP tracking',
      ],
      siModules: ['SEO Tools', 'Keywords', 'Prompt Vault'],
    });
  }
  if (location || intents.includes('local')) {
    recs.push({
      framework: 'Local',
      label: 'Geo-Targeted Sprint',
      actions: [
        location ? `Build "${keyword || 'service'} ${location}" landing cluster` : 'Create city + service landing pages',
        'Verify NAP and DNS records',
        'Schedule weekly GBP-style proof posts on Calendar',
      ],
      siModules: ['SEO Tools', 'DNS', 'Calendar', 'Engagement'],
    });
  }
  return recs;
}

function formatBriefForPrompt(brief) {
  if (!brief) return '';
  const lines = [
    '',
    '--- LIVE SEO INTELLIGENCE (THEE_MICHAEL · perpetual learning) ---',
    `Intents: ${(brief.intents || []).join(', ')}`,
    brief.keyword ? `Focus keyword: ${brief.keyword}` : null,
    brief.location ? `Geo target: ${brief.location}` : null,
    `Engines analyzed: ${(brief.engineSnapshots || []).filter((e) => e.available).map((e) => e.label).join(', ') || 'framework-only'}`,
  ].filter(Boolean);

  for (const snap of brief.engineSnapshots || []) {
    if (!snap.available || !snap.organic?.length) continue;
    lines.push(`${snap.label} top result: "${snap.organic[0].title}" (${snap.organic[0].link})`);
    if (snap.peopleAlsoAsk?.length) lines.push(`${snap.label} PAA: ${snap.peopleAlsoAsk.slice(0, 2).join(' | ')}`);
  }

  if (brief.pulse?.insights?.length) {
    lines.push(`Live pulse: ${brief.pulse.insights.join(' ')}`);
  }
  if (brief.pulse?.sources?.[0]?.title) {
    lines.push(`Recent signal: ${brief.pulse.sources[0].title}`);
  }

  for (const rec of (brief.recommendations || []).slice(0, 3)) {
    lines.push(`${rec.framework} next: ${rec.actions[0]}`);
  }

  lines.push('Apply authority-tier advice: cite engines by name, give numbered actions, route user to SI modules.');
  lines.push('--- END SEO INTELLIGENCE ---');
  return lines.join('\n');
}

async function buildIntelligenceBrief(query, context = {}) {
  const q = String(query || '').trim();
  const intents = classifyIntent(q);
  const keyword = extractKeyword(q);
  const location = extractLocation(q);
  const cacheK = cacheKey({ q: q.toLowerCase(), keyword, location });
  const cached = getCached(cacheK);
  if (cached) return { ...cached, fromCache: true };

  const keys = context.keys || {};
  const invoke = context.invoke || null;
  const projectId = context.projectId;
  const orgId = context.organizationId;

  const primaryFrameworks = intents
    .filter((i) => FRAMEWORKS[i])
    .map((i) => FRAMEWORKS[i]);

  const engineIds = ['google', 'bing', 'duckduckgo'];
  const engineSnapshots = [];
  if (keyword && keys.serpApiKey) {
    for (const eid of engineIds) {
      engineSnapshots.push(await fetchEngineSnapshot(keyword, eid, keys));
    }
  } else {
    for (const eid of engineIds) {
      const eng = SEARCH_ENGINES.find((e) => e.id === eid);
      engineSnapshots.push({
        engine: eid,
        label: eng?.label || eid,
        available: false,
        reason: keyword ? 'Add SerpAPI key in Integrations' : 'No extractable keyword',
      });
    }
  }

  let toolInsights = null;
  if (keyword && invoke && projectId && orgId) {
    const paa = await runSeoToolInvoke(invoke, projectId, orgId, 'paa', { keyword });
    const kgr = await runSeoToolInvoke(invoke, projectId, orgId, 'kgr', { keyword });
    toolInsights = { paa: paa?.data || paa, kgr: kgr?.data || kgr };
  }

  const pulseTopic = keyword || (intents.includes('geo') ? 'generative engine optimization' : 'SEO trends');
  const pulse = await fetchLivePulse(pulseTopic, keys);

  const brief = {
    query: q,
    intents,
    keyword,
    location,
    frameworks: primaryFrameworks,
    engines: SEARCH_ENGINES,
    engineSnapshots,
    toolInsights,
    pulse,
    recommendations: buildRecommendations(intents, keyword, location),
    promptAppend: '',
    generatedAt: new Date().toISOString(),
    liveData: !!(keys.serpApiKey && keyword),
  };

  brief.promptAppend = formatBriefForPrompt(brief);
  setCache(cacheK, brief);
  return brief;
}

function listFrameworks() {
  return {
    engines: SEARCH_ENGINES,
    frameworks: Object.values(FRAMEWORKS),
    intents: INTENT_PATTERNS.map((r) => r.intent),
  };
}

function isSeoQuery(query) {
  const intents = classifyIntent(query);
  return !intents.includes('general') || /seo|serp|rank|keyword|snippet|local|aeo|geo|bing|google|search\s+engine/i.test(String(query || ''));
}

async function resolveProjectKeys(projectId, orgId) {
  try {
    const { createPrismaStore } = require('@si/core');
    const { resolveKeysFromStore } = require(path.join(__dirname, '../../../desktop/services/keys'));
    const store = await createPrismaStore({ projectId, organizationId: orgId });
    const raw = store.getItem('globalApiKeys');
    const globalKeys = raw ? JSON.parse(raw) : {};
    return resolveKeysFromStore(store, globalKeys);
  } catch (e) {
    const { resolveKeys } = require(path.join(__dirname, '../../../desktop/services/keys'));
    return resolveKeys({});
  }
}

module.exports = {
  SEARCH_ENGINES,
  FRAMEWORKS,
  classifyIntent,
  extractKeyword,
  extractLocation,
  fetchLivePulse,
  fetchEngineSnapshot,
  buildIntelligenceBrief,
  formatBriefForPrompt,
  listFrameworks,
  isSeoQuery,
  resolveProjectKeys,
};