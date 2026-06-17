const axios = require('axios');
const reddit = require('./platforms/reddit');

const UA = 'SocialImperialism/1.0 SEO-Tools';

async function serpRequest(keys, params) {
  if (!keys.serpApiKey) {
    throw new Error('Add SerpAPI key in Settings → API Integrations (serpApiKey).');
  }
  const res = await axios.get('https://serpapi.com/search.json', {
    params: { ...params, api_key: keys.serpApiKey },
    timeout: 25000,
    headers: { 'User-Agent': UA },
  });
  return res.data;
}

function parseTotalResults(searchInfo) {
  const raw = searchInfo?.total_results;
  if (typeof raw === 'number') return raw;
  if (typeof raw === 'string') {
    const n = parseInt(raw.replace(/,/g, ''), 10);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function kgrTool(keyword, keys) {
  const term = String(keyword || '').trim();
  if (!term) throw new Error('Keyword required');

  const q = `allintitle:"${term.replace(/"/g, '')}"`;
  const data = await serpRequest(keys, { engine: 'google', q, num: 10 });
  const allintitle = parseTotalResults(data.search_information)
    ?? (data.organic_results?.length || 0);

  let searchVolume = null;
  let momentum = null;
  try {
    const trend = await serpRequest(keys, {
      engine: 'google_trends',
      q: term,
      data_type: 'TIMESERIES',
    });
    const timeline = trend.interest_over_time?.timeline_data || [];
    if (timeline.length) {
      const vals = timeline.slice(-12).map((d) => parseInt(d.values?.[0]?.value || 0, 10));
      const avg = Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
      searchVolume = Math.max(avg * 120, 50);
      if (timeline.length >= 2) {
        const prev = parseInt(timeline[timeline.length - 5]?.values?.[0]?.value || avg, 10);
        momentum = prev > 0 ? `${avg >= prev ? '+' : ''}${Math.round(((avg - prev) / prev) * 100)}%` : 'Stable';
      }
    }
  } catch (e) {
    console.warn('KGR trends fallback:', e.message);
  }

  if (!searchVolume) searchVolume = Math.max(allintitle * 80, 100);

  const kgr = searchVolume > 0 ? allintitle / searchVolume : null;
  let rating = 'Competitive';
  if (kgr !== null && kgr < 0.25) rating = 'Golden';
  else if (kgr !== null && kgr < 1) rating = 'Good';

  return {
    keyword: term,
    allintitle,
    searchVolume,
    kgr: kgr !== null ? Number(kgr.toFixed(4)) : null,
    rating,
    momentum,
    topResults: (data.organic_results || []).slice(0, 5).map((r) => ({
      title: r.title,
      link: r.link,
    })),
  };
}

async function redditTopicHunter(keyword, keys) {
  const term = String(keyword || '').trim();
  if (!term) throw new Error('Keyword or topic required');

  const posts = await reddit.searchPosts(term, keys, 20);
  const subMap = {};

  posts.forEach((p) => {
    const sub = p.subreddit || 'unknown';
    if (!subMap[sub]) subMap[sub] = { subreddit: sub, posts: 0, totalUps: 0 };
    subMap[sub].posts += 1;
    subMap[sub].totalUps += p.ups || p.stats?.likes || 0;
  });

  return {
    keyword: term,
    posts: posts.map((p) => ({
      title: (p.content || '').split('\n')[0]?.slice(0, 160),
      subreddit: p.subreddit,
      url: p.url,
      ups: p.stats?.likes || 0,
      comments: p.stats?.comments || 0,
      author: p.author,
    })),
    subreddits: Object.values(subMap).sort((a, b) => b.totalUps - a.totalUps),
    count: posts.length,
  };
}

async function quoraQuestionFinder(keyword, keys) {
  const term = String(keyword || '').trim();
  if (!term) throw new Error('Keyword required');

  const data = await serpRequest(keys, {
    engine: 'google',
    q: `site:quora.com ${term}`,
    num: 20,
  });

  const questions = (data.organic_results || [])
    .filter((r) => r.link?.includes('quora.com'))
    .map((r) => ({
      question: r.title,
      link: r.link,
      snippet: r.snippet,
    }));

  return { keyword: term, questions, count: questions.length };
}

async function checkUrlIndexed(url, keys) {
  try {
    const data = await serpRequest(keys, { engine: 'google', q: url, num: 5 });
    const organic = data.organic_results || [];
    const normalized = url.replace(/\/$/, '').split('?')[0];
    const indexed = organic.some((r) => {
      if (!r.link) return false;
      const link = r.link.replace(/\/$/, '').split('?')[0];
      return link === normalized || link.startsWith(normalized) || normalized.startsWith(link);
    });
    return { url, indexed, foundUrl: organic[0]?.link || null };
  } catch (e) {
    return { url, indexed: false, error: e.message };
  }
}

async function bulkIndexChecker(urlsText, keys) {
  const lines = String(urlsText || '').split(/\r?\n/).map((u) => u.trim()).filter(Boolean);
  if (!lines.length) throw new Error('Paste at least one URL (one per line).');

  const results = [];
  for (const url of lines.slice(0, 25)) {
    results.push(await checkUrlIndexed(url, keys));
    await sleep(350);
  }
  return {
    results,
    checked: results.length,
    indexed: results.filter((r) => r.indexed).length,
  };
}

async function bulkLinkIndexer(urlsText, keys, options = {}) {
  const lines = String(urlsText || '').split(/\r?\n/).map((u) => u.trim()).filter(Boolean);
  if (!lines.length) throw new Error('Paste at least one URL (one per line).');

  let host = options.host || '';
  if (!host && lines[0]) {
    try { host = new URL(lines[0]).hostname; } catch (e) { /* invalid URL */ }
  }
  const indexNowKey = options.indexNowKey || keys.indexNowKey;
  const results = [];

  if (indexNowKey && host) {
    try {
      await axios.post(
        'https://api.indexnow.org/indexnow',
        {
          host,
          key: indexNowKey,
          keyLocation: `https://${host}/${indexNowKey}.txt`,
          urlList: lines.slice(0, 100),
        },
        { headers: { 'Content-Type': 'application/json' }, timeout: 15000 },
      );
      lines.slice(0, 100).forEach((url) => {
        results.push({ url, status: 'submitted', method: 'IndexNow' });
      });
    } catch (e) {
      lines.forEach((url) => {
        results.push({ url, status: 'failed', method: 'IndexNow', error: e.message });
      });
    }
  } else {
    lines.slice(0, 50).forEach((url) => {
      results.push({
        url,
        status: 'queued',
        method: 'Manual',
        note: 'Add indexNowKey in Settings or verify via Bulk Index Checker after submitting in Search Console.',
      });
    });
  }

  return {
    results,
    count: results.length,
    host,
    note: indexNowKey
      ? 'URLs submitted via IndexNow. Allow 24–72h then run Bulk Index Checker.'
      : 'URLs queued. Submit via Google Search Console / Bing Webmaster, or add indexNowKey in Settings.',
  };
}

async function googleScraper(query, keys, num = 10) {
  const q = String(query || '').trim();
  if (!q) throw new Error('Search query required');
  const data = await serpRequest(keys, { engine: 'google', q, num: Math.min(num, 20) });
  return {
    query: q,
    total: parseTotalResults(data.search_information),
    results: (data.organic_results || []).map((r) => ({
      position: r.position,
      title: r.title,
      link: r.link,
      snippet: r.snippet,
      displayed_link: r.displayed_link,
    })),
  };
}

async function bingScraper(query, keys, count = 10) {
  const q = String(query || '').trim();
  if (!q) throw new Error('Search query required');
  const data = await serpRequest(keys, { engine: 'bing', q, count: Math.min(count, 20) });
  return {
    query: q,
    results: (data.organic_results || []).map((r) => ({
      position: r.position,
      title: r.title,
      link: r.link,
      snippet: r.snippet,
    })),
  };
}

async function peopleAlsoAsk(keyword, keys) {
  const term = String(keyword || '').trim();
  if (!term) throw new Error('Keyword required');
  const data = await serpRequest(keys, { engine: 'google', q: term, num: 5 });
  const questions = (data.related_questions || []).map((q) => ({
    question: q.question,
    snippet: q.snippet,
    title: q.title,
    link: q.link,
  }));
  return { keyword: term, questions, count: questions.length };
}

function groupingTool(keywordsText) {
  const lines = String(keywordsText || '').split(/\r?\n/).map((k) => k.trim()).filter(Boolean);
  if (!lines.length) throw new Error('Paste keywords (one per line).');

  const groups = {};
  lines.forEach((kw) => {
    const words = kw.toLowerCase().split(/\s+/).filter(Boolean);
    const theme = words.length >= 2 ? words.slice(0, 2).join(' ') : (words[0] || kw);
    if (!groups[theme]) groups[theme] = [];
    groups[theme].push(kw);
  });

  const clustered = Object.entries(groups)
    .map(([theme, terms]) => ({ theme, terms, count: terms.length }))
    .sort((a, b) => b.count - a.count);

  return { groups: clustered, total: lines.length };
}

async function youtubeAutocomplete(seed, keys) {
  const q = String(seed || '').trim();
  if (!q) throw new Error('Seed keyword required');

  try {
    const data = await serpRequest(keys, { engine: 'google_autocomplete', q, client: 'youtube' });
    const suggestions = (data.suggestions || []).map((s) => s.value || s).filter(Boolean);
    if (suggestions.length) return { seed: q, suggestions, source: 'YouTube Autocomplete' };
  } catch (e) {
    console.warn('YouTube autocomplete client:', e.message);
  }

  const data = await serpRequest(keys, { engine: 'google', q: `${q} site:youtube.com`, num: 5 });
  const suggestions = (data.related_searches || []).map((r) => r.query).filter(Boolean);
  return { seed: q, suggestions, source: 'Google Related (YouTube)' };
}

async function googleAutocomplete(seed, keys) {
  const q = String(seed || '').trim();
  if (!q) throw new Error('Seed keyword required');
  const data = await serpRequest(keys, { engine: 'google_autocomplete', q });
  return {
    seed: q,
    suggestions: (data.suggestions || []).map((s) => s.value || s).filter(Boolean),
    source: 'Google Autocomplete',
  };
}

async function googleSuggestions(seed, keys) {
  const q = String(seed || '').trim();
  if (!q) throw new Error('Seed keyword required');
  const data = await serpRequest(keys, { engine: 'google', q, num: 5 });
  const suggestions = (data.related_searches || []).map((r) => ({
    query: r.query,
    link: r.link,
  }));
  return { seed: q, suggestions, count: suggestions.length, source: 'Google Related Searches' };
}

const TOOL_RUNNERS = {
  kgr: (p, keys) => kgrTool(p.keyword, keys),
  'reddit-topics': (p, keys) => redditTopicHunter(p.keyword, keys),
  'quora-questions': (p, keys) => quoraQuestionFinder(p.keyword, keys),
  'bulk-index-check': (p, keys) => bulkIndexChecker(p.urls, keys),
  'bulk-index-submit': (p, keys) => bulkLinkIndexer(p.urls, keys, p),
  'google-scrape': (p, keys) => googleScraper(p.query, keys, p.num),
  'bing-scrape': (p, keys) => bingScraper(p.query, keys, p.num),
  paa: (p, keys) => peopleAlsoAsk(p.keyword, keys),
  grouping: (p) => groupingTool(p.keywords),
  'youtube-autocomplete': (p, keys) => youtubeAutocomplete(p.seed, keys),
  'google-autocomplete': (p, keys) => googleAutocomplete(p.seed, keys),
  'google-suggestions': (p, keys) => googleSuggestions(p.seed, keys),
};

async function runTool(toolId, payload, keys) {
  const runner = TOOL_RUNNERS[toolId];
  if (!runner) throw new Error(`Unknown tool: ${toolId}`);
  const data = await runner(payload || {}, keys);
  return { success: true, toolId, data };
}

function listTools() {
  return [
    { id: 'kgr', name: 'KGR Tool', desc: 'Keyword Golden Ratio — allintitle ÷ search volume', needsSerp: true },
    { id: 'reddit-topics', name: 'Reddit Topic Hunter', desc: 'Hot posts & subreddits for a topic', needsSerp: false },
    { id: 'quora-questions', name: 'Quora Question Finder', desc: 'Discover Quora questions via Google', needsSerp: true },
    { id: 'bulk-index-submit', name: 'Bulk Link Indexer', desc: 'Batch submit URLs (IndexNow)', needsSerp: false },
    { id: 'bulk-index-check', name: 'Bulk Link Index Checker', desc: 'Check if URLs appear in Google', needsSerp: true },
    { id: 'google-scrape', name: 'Google Scraper', desc: 'Organic SERP results', needsSerp: true },
    { id: 'bing-scrape', name: 'Bing Scraper', desc: 'Bing organic results', needsSerp: true },
    { id: 'paa', name: 'People Also Ask', desc: 'PAA questions for a keyword', needsSerp: true },
    { id: 'grouping', name: 'Grouping Tool', desc: 'Cluster keywords by theme', needsSerp: false },
    { id: 'youtube-autocomplete', name: 'YouTube Auto Complete', desc: 'YouTube search suggestions', needsSerp: true },
    { id: 'google-autocomplete', name: 'Google Auto Complete', desc: 'Google type-ahead suggestions', needsSerp: true },
    { id: 'google-suggestions', name: 'Google Suggestions', desc: 'Related searches at bottom of SERP', needsSerp: true },
  ];
}

module.exports = {
  runTool,
  listTools,
  kgrTool,
  redditTopicHunter,
  quoraQuestionFinder,
  bulkIndexChecker,
  bulkLinkIndexer,
  googleScraper,
  bingScraper,
  peopleAlsoAsk,
  groupingTool,
  youtubeAutocomplete,
  googleAutocomplete,
  googleSuggestions,
};