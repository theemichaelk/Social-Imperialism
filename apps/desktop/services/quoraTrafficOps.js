/**
 * Quora Traffic Ops — Research → Generate → Publish workflow.
 */
const axios = require('axios');
const quoraBrowser = require('./quoraBrowserAutomation');
const quora = require('./platforms/quora');

const STORAGE_KEY = 'quoraTrafficOps';
const QUESTIONS_CACHE_KEY = 'quoraTrafficQuestionsCache';

const PROMPT_FRAMEWORKS = [
  {
    id: 'problem-insight',
    name: 'Problem → Struggle → Insight → Solution',
    description: 'Pain, validate struggle, reframe, present offer as natural next step.',
    template: 'Use the Problem → Struggle → Insight → Solution framework. Start with the pain, validate the struggle, deliver a reframe, then present the offer as the natural next step.',
  },
  {
    id: 'common-advice-fails',
    name: 'Common Advice → Why It Fails → Root Cause → Real Fix',
    description: 'Challenge conventional advice, expose why it fails, position your solution.',
    template: 'Use the Common Advice → Why It Fails → Root Cause → Real Fix framework. Challenge what everyone else says, explain why it does not work, then position the solution as the correct answer.',
  },
  {
    id: 'hook-confession',
    name: 'Hook → Confession → Discovery → Invitation',
    description: 'Bold opener, share failure, reveal what worked, invite reader.',
    template: 'Use the Hook → Confession → Discovery → Invitation framework. Open with a bold statement, share a relatable failure, reveal what actually worked, invite the reader to learn more.',
  },
  {
    id: 'before-mistake-after',
    name: 'Before → Mistake → After → Warning',
    description: 'Transformation story with mistake, result, and warning.',
    template: 'Use the Before → Mistake → After → Warning framework. Show the transformation, call out the exact mistake, reveal the result after fixing it, warn readers not to repeat it.',
  },
];

const DEFAULT_SETTINGS = {
  mode: 'manual',
  model: 'gemini',
  minViews: 5000,
  minUpvotes: 100,
  autoPublish: false,
  activeAngleId: 'default',
  angles: [{
    id: 'default',
    name: 'Default Brand Angle',
    brandPositioning: '',
    keywords: '',
    cta: '',
    productContext: '',
    ctaUrl: '',
  }],
  customPrompts: [],
  documents: [],
  answers: [],
  publishedLog: [],
};

function loadSettings(store, campaignId) {
  try {
    const all = JSON.parse(store.getItem(STORAGE_KEY) || '{}');
    const base = all[campaignId] || {};
    return {
      ...DEFAULT_SETTINGS,
      ...base,
      angles: base.angles?.length ? base.angles : DEFAULT_SETTINGS.angles,
      customPrompts: base.customPrompts || [],
      documents: base.documents || [],
      answers: base.answers || [],
      publishedLog: base.publishedLog || [],
    };
  } catch (e) {
    return { ...DEFAULT_SETTINGS };
  }
}

function saveSettings(store, campaignId, partial) {
  const all = JSON.parse(store.getItem(STORAGE_KEY) || '{}');
  const merged = { ...loadSettings(store, campaignId), ...partial, updatedAt: new Date().toISOString() };
  all[campaignId] = merged;
  store.setItem(STORAGE_KEY, JSON.stringify(all));
  return merged;
}

function parseMetricNumber(raw) {
  if (!raw) return 0;
  const s = String(raw).replace(/,/g, '').trim().toLowerCase();
  const m = s.match(/([\d.]+)\s*([km])?/);
  if (!m) return parseInt(s, 10) || 0;
  let n = parseFloat(m[1]);
  if (m[2] === 'k') n *= 1000;
  if (m[2] === 'm') n *= 1000000;
  return Math.round(n);
}

function formatMetric(n) {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

function extractYouTubeId(url) {
  const m = String(url || '').match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|embed\/)([a-zA-Z0-9_-]{11})/);
  return m ? m[1] : null;
}

function youtubeEmbedHtml(videoId, title = 'Related video') {
  if (!videoId) return '';
  return `<p><div class="embed-responsive embed-responsive-16by9 mx-auto"><iframe src="https://www.youtube.com/embed/${videoId}" frameborder="0" allowfullscreen title="${title}"></iframe></div></p>`;
}

async function fetchYouTubeTranscript(videoUrl) {
  const videoId = extractYouTubeId(videoUrl);
  if (!videoId) throw new Error('Invalid YouTube URL');
  try {
    const res = await axios.get(`https://www.youtube.com/watch?v=${videoId}`, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
      timeout: 20000,
    });
    const html = res.data || '';
    const tracksMatch = html.match(/"captionTracks":(\[[^\]]+\])/);
    if (tracksMatch) {
      const tracks = JSON.parse(tracksMatch[1].replace(/\\u0026/g, '&'));
      const en = tracks.find((t) => t.languageCode === 'en') || tracks[0];
      if (en?.baseUrl) {
        const cap = await axios.get(en.baseUrl, { timeout: 15000 });
        const text = String(cap.data)
          .replace(/<[^>]+>/g, ' ')
          .replace(/\s+/g, ' ')
          .trim();
        if (text.length > 100) return { videoId, transcript: text.slice(0, 12000), source: 'youtube_captions' };
      }
    }
  } catch (e) {
    console.warn('YouTube transcript fetch:', e.message);
  }
  return { videoId, transcript: '', source: 'unavailable', note: 'No captions found — AI will use video URL context only.' };
}

async function scrapeQuestionMetrics(url) {
  let puppeteer;
  try { puppeteer = require('puppeteer'); } catch (e) { return null; }
  if (!puppeteer) return null;
  let browser;
  try {
    browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0 Safari/537.36');
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await new Promise((r) => setTimeout(r, 2500));
    const data = await page.evaluate(() => {
      const title = document.querySelector('h1')?.textContent?.trim()
        || document.querySelector('[class*="Question"]')?.textContent?.trim()
        || document.title?.replace(' - Quora', '').trim();
      const text = document.body?.innerText || '';
      const viewsM = text.match(/([\d,.]+[kKmM]?)\s*(?:Views|view)/i);
      const upM = text.match(/([\d,.]+[kKmM]?)\s*(?:Upvotes?|upvotes?)/i)
        || text.match(/▲\s*([\d,.]+[kKmM]?)/);
      const ansM = text.match(/([\d,.]+)\s*(?:Answers?|answers?)/i);
      const snippets = [];
      document.querySelectorAll('[class*="Answer"], .q-box, article').forEach((el, i) => {
        if (i > 8) return;
        const t = (el.innerText || '').trim().slice(0, 400);
        if (t.length > 80) snippets.push(t);
      });
      return { title, viewsRaw: viewsM?.[1], upvotesRaw: upM?.[1], answersRaw: ansM?.[1], existingAnswers: snippets.slice(0, 5) };
    });
    await browser.close();
    return {
      title: data.title,
      views: parseMetricNumber(data.viewsRaw),
      upvotes: parseMetricNumber(data.upvotesRaw),
      answerCount: parseMetricNumber(data.answersRaw),
      existingAnswers: data.existingAnswers || [],
      metricsSource: 'scrape',
    };
  } catch (e) {
    if (browser) try { await browser.close(); } catch (err) { /* ignore */ }
    return null;
  }
}

function estimateMetricsFromRank(index, snippet) {
  const baseViews = [31200, 18700, 14300, 9800, 7200, 5100, 3800, 2900, 2100, 1500];
  const baseUp = [1240, 714, 521, 387, 280, 195, 140, 98, 72, 50];
  const baseAns = [56, 38, 29, 22, 18, 14, 11, 9, 7, 5];
  const i = Math.min(index, 9);
  let views = baseViews[i];
  let upvotes = baseUp[i];
  let answers = baseAns[i];
  const numMatch = (snippet || '').match(/(\d+)\s*answers?/i);
  if (numMatch) answers = parseInt(numMatch[1], 10);
  return { views, upvotes, answerCount: answers, metricsSource: 'estimated' };
}

const QUORA_JUNK_PATHS = /\/(?:login|signup|search|topic|profile|user|spaces|about|terms|privacy|help|contact|careers|press|qemail|settings)(?:\/|$|\?)/i;

function isValidQuoraQuestionUrl(url, title = '') {
  if (!url || !url.includes('quora.com') || url.includes('business.quora.com') || QUORA_JUNK_PATHS.test(url)) return false;
  const path = url.replace(/^https?:\/\/(?:www\.)?quora\.com/i, '').split('?')[0];
  if (!path || path === '/' || path.startsWith('/search')) return false;
  const t = String(title).toLowerCase();
  if (/terms of service|privacy policy|quora login|sign up|help center/.test(t)) return false;
  return true;
}

function pushQuestionResult(results, seen, item, keyword, index, enrich, keys) {
  const url = item.url || item.link || '';
  const title = (item.title || item.question || '').replace(/ - Quora.*$/i, '').trim();
  if (!isValidQuoraQuestionUrl(url, title) || seen.has(url)) return;
  seen.add(url);
  if (!title) return;
  let metrics = estimateMetricsFromRank(index, item.snippet || '');
  results.push({
    id: `qq_${Buffer.from(url).toString('base64').slice(0, 20)}`,
    question: title,
    url,
    keyword,
    views: metrics.views,
    viewsLabel: formatMetric(metrics.views),
    upvotes: metrics.upvotes,
    upvotesLabel: formatMetric(metrics.upvotes),
    answerCount: metrics.answerCount,
    existingAnswers: [],
    metricsSource: metrics.metricsSource,
    score: metrics.views + metrics.upvotes * 10,
    _enrich: enrich,
    _keys: keys,
  });
}

async function enrichQuestionMetrics(entry) {
  if (!entry._enrich || !entry.url) return entry;
  const scraped = await scrapeQuestionMetrics(entry.url);
  if (scraped) {
    entry.views = scraped.views || entry.views;
    entry.upvotes = scraped.upvotes || entry.upvotes;
    entry.answerCount = scraped.answerCount || entry.answerCount;
    entry.existingAnswers = scraped.existingAnswers || [];
    entry.metricsSource = scraped.views ? 'scrape' : entry.metricsSource;
    entry.score = entry.views + entry.upvotes * 10;
    entry.viewsLabel = formatMetric(entry.views);
    entry.upvotesLabel = formatMetric(entry.upvotes);
  }
  delete entry._enrich;
  delete entry._keys;
  return entry;
}

function titleFromQuoraUrl(url) {
  if (!url) return '';
  const slug = url.replace(/\/$/, '').split('/').pop() || '';
  return decodeURIComponent(slug).replace(/-/g, ' ').replace(/\?.*$/, '').trim();
}

function cleanSearchTitle(title, url) {
  let t = String(title || '').replace(/ - Quora.*$/i, '').trim();
  if (/^https?:\/\/(?:www\.)?quora\.com\//i.test(t) || /^quora\.com\//i.test(t)) t = '';
  t = t.replace(/^Quora\s+quora\.com\s*[›>]\s*[^\s›>]+\s*/i, '').trim();
  if (!t || t.length < 8) t = titleFromQuoraUrl(url);
  return t;
}

function parseMojeekHtml(html, limit = 20) {
  const items = [];
  const seen = new Set();
  const blockRe = /<!--rs--><li class="r\d+">([\s\S]*?)<!--re-->/gi;
  let m;
  while ((m = blockRe.exec(html)) !== null && items.length < limit) {
    const block = m[1];
    const urlM = block.match(/href="(https?:\/\/(?:www\.)?quora\.com\/[^"]+)"/i);
    if (!urlM) continue;
    const url = urlM[1].split('#')[0];
    const titleAttr = block.match(/<a class="title"[^>]*title="([^"]+)"/i);
    const title = cleanSearchTitle(
      titleAttr ? titleAttr[1].replace(/&amp;/g, '&').replace(/&quot;/g, '"') : '',
      url,
    );
    if (!isValidQuoraQuestionUrl(url, title) || seen.has(url)) continue;
    seen.add(url);
    const snippetM = block.match(/<p class="s">([\s\S]*?)<\/p>/i);
    const snippet = snippetM
      ? snippetM[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
      : '';
    items.push({ url, title, snippet });
  }
  return items;
}

async function scrapeViaMojeekBrowser(keyword, limit = 20) {
  let puppeteer;
  try { puppeteer = require('puppeteer'); } catch (e) { return []; }
  if (!puppeteer) return [];
  let browser;
  try {
    browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    await page.goto(`https://www.mojeek.com/search?q=${encodeURIComponent(`site:quora.com ${keyword}`)}`, {
      waitUntil: 'domcontentloaded',
      timeout: 45000,
    });
    await new Promise((r) => setTimeout(r, 2500));
    const html = await page.content();
    await browser.close();
    return parseMojeekHtml(html, limit);
  } catch (e) {
    if (browser) try { await browser.close(); } catch (err) { /* ignore */ }
    console.warn('Quora Mojeek browser search:', e.message);
    return [];
  }
}

async function scrapeViaMojeekSearch(keyword, limit = 20) {
  try {
    const res = await axios.get('https://www.mojeek.com/search', {
      params: { q: `site:quora.com ${keyword}` },
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Accept: 'text/html',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      timeout: 25000,
    });
    const items = parseMojeekHtml(String(res.data || ''), limit);
    if (items.length) return items;
  } catch (e) {
    console.warn('Quora Mojeek search:', e.message);
  }
  return scrapeViaMojeekBrowser(keyword, limit);
}

async function scrapeViaBraveSearch(keyword, limit = 20) {
  try {
    const res = await axios.get('https://search.brave.com/search', {
      params: { q: `site:quora.com ${keyword}` },
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Accept: 'text/html',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      timeout: 25000,
    });
    const html = String(res.data || '');
    const items = [];
    const seen = new Set();
    const re = /<a[^>]+href="(https?:\/\/(?:www\.)?quora\.com[^"#]+)"[^>]*>([\s\S]*?)<\/a>/gi;
    let m;
    while ((m = re.exec(html)) !== null && items.length < limit) {
      const url = m[1].split('&')[0].split('#')[0];
      const title = cleanSearchTitle(m[2].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim(), url);
      if (!isValidQuoraQuestionUrl(url, title) || seen.has(url)) continue;
      seen.add(url);
      items.push({ url, title, snippet: '' });
    }
    return items;
  } catch (e) {
    console.warn('Quora Brave search:', e.message);
    return [];
  }
}

async function scrapeViaDuckDuckGo(keyword, limit = 20) {
  try {
    const res = await axios.get('https://html.duckduckgo.com/html/', {
      params: { q: `site:quora.com ${keyword}` },
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Accept: 'text/html',
      },
      timeout: 25000,
    });
    const html = String(res.data || '');
    const items = [];
    const linkRe = /<a[^>]+class="result__a"[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
    let m;
    while ((m = linkRe.exec(html)) !== null && items.length < limit) {
      const url = m[1].replace(/&amp;/g, '&');
      const title = m[2].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
      if (url.includes('quora.com')) items.push({ url, title, snippet: '' });
    }
    return items;
  } catch (e) {
    console.warn('Quora DuckDuckGo search:', e.message);
    return [];
  }
}

async function scrapeViaQuoraBrowser(keyword, limit = 15) {
  let puppeteer;
  try { puppeteer = require('puppeteer'); } catch (e) { return []; }
  if (!puppeteer) return [];
  let browser;
  try {
    browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0 Safari/537.36');
    await page.goto(`https://www.quora.com/search?q=${encodeURIComponent(keyword)}`, {
      waitUntil: 'domcontentloaded',
      timeout: 45000,
    });
    await new Promise((r) => setTimeout(r, 3000));
    const items = await page.evaluate((max) => {
      const junk = /\/(?:login|signup|search|topic|profile|user|spaces|about|terms|privacy|help)(?:\/|$|\?)/i;
      const out = [];
      const seen = new Set();
      document.querySelectorAll('a[href]').forEach((a) => {
        const href = (a.href || '').split('?')[0];
        if (!href.includes('quora.com') || junk.test(href) || seen.has(href)) return;
        const text = (a.innerText || '').trim();
        if (text.length < 12 || text.length > 300) return;
        if (/terms of service|privacy policy|log in|sign up/i.test(text)) return;
        seen.add(href);
        out.push({ url: href, title: text, snippet: '' });
      });
      return out.slice(0, max);
    }, limit);
    await browser.close();
    return items;
  } catch (e) {
    if (browser) try { await browser.close(); } catch (err) { /* ignore */ }
    console.warn('Quora browser search:', e.message);
    return [];
  }
}

function resolveAIModel(model, keys) {
  const wantsOpenRouter = model && String(model).includes('/');
  if (keys?.openrouter && wantsOpenRouter) return model;
  if (keys?.openrouter) return model || 'openai/gpt-4o-mini';
  return 'gemini';
}

async function scrapeQuestions(keyword, keys, options = {}) {
  const limit = options.limit || 25;
  const enrich = options.enrich !== false;
  const results = [];
  const seen = new Set();

  if (keys?.serpApiKey) {
    try {
      const res = await axios.get('https://serpapi.com/search.json', {
        params: {
          engine: 'google',
          q: `site:quora.com ${keyword}`,
          api_key: keys.serpApiKey,
          num: Math.min(limit, 20),
        },
        timeout: 25000,
      });
      const organic = res.data?.organic_results || [];
      for (let i = 0; i < organic.length; i++) {
        pushQuestionResult(results, seen, {
          url: organic[i].link,
          title: organic[i].title,
          snippet: organic[i].snippet,
        }, keyword, i, enrich, keys);
      }
    } catch (e) {
      console.error('Quora Traffic SerpAPI:', e.message);
    }
  }

  if (results.length < limit) {
    const mojeekHits = await scrapeViaMojeekSearch(keyword, limit);
    mojeekHits.forEach((item, i) => pushQuestionResult(results, seen, item, keyword, i, enrich, keys));
  }

  if (results.length < limit) {
    const braveHits = await scrapeViaBraveSearch(keyword, limit);
    braveHits.forEach((item, i) => pushQuestionResult(results, seen, item, keyword, i, enrich, keys));
  }

  if (results.length < limit) {
    const ddg = await scrapeViaDuckDuckGo(keyword, limit);
    ddg.forEach((item, i) => pushQuestionResult(results, seen, item, keyword, i, enrich, keys));
  }

  if (results.length < Math.min(5, limit)) {
    const browserHits = await scrapeViaQuoraBrowser(keyword, limit);
    browserHits.forEach((item, i) => pushQuestionResult(results, seen, item, keyword, i, enrich, keys));
  }

  if (!results.length) {
    const fallback = await quora.searchPosts(keyword, keys, limit);
    fallback.forEach((p, i) => {
      pushQuestionResult(results, seen, {
        url: p.url,
        title: p.content,
        snippet: p.content,
      }, keyword, i, enrich, keys);
    });
  }

  if (!results.length) {
    throw new Error('No Quora questions found for that keyword. Try another keyword or paste a Quora question URL below.');
  }

  const enriched = [];
  for (const entry of results.slice(0, limit)) {
    enriched.push(await enrichQuestionMetrics({ ...entry }));
  }

  enriched.sort((a, b) => b.score - a.score);
  return enriched.slice(0, limit);
}

function getAngle(settings, angleId) {
  return settings.angles.find((a) => a.id === (angleId || settings.activeAngleId)) || settings.angles[0];
}

function buildAngleContext(angle, campaign) {
  return [
    angle?.brandPositioning && `Brand positioning: ${angle.brandPositioning}`,
    angle?.keywords && `Target keywords: ${angle.keywords}`,
    angle?.productContext && `Product context: ${angle.productContext}`,
    angle?.cta && `Call-to-action: ${angle.cta}`,
    angle?.ctaUrl && `CTA URL: ${angle.ctaUrl}`,
    campaign?.brandName && `Brand: ${campaign.brandName}`,
    campaign?.domain && `Website: ${campaign.domain}`,
    campaign?.description && `About: ${campaign.description}`,
    campaign?.tone && `Tone: ${campaign.tone}`,
  ].filter(Boolean).join('\n');
}

async function lookupQuestionByUrl(url, keyword = 'manual') {
  if (!isValidQuoraQuestionUrl(url)) {
    throw new Error('Paste a valid Quora question URL (not login, search, or profile pages).');
  }
  const scraped = await scrapeQuestionMetrics(url);
  const title = scraped?.title || cleanSearchTitle('', url);
  const metrics = scraped?.views
    ? scraped
    : { ...estimateMetricsFromRank(0, ''), title, existingAnswers: scraped?.existingAnswers || [] };
  return {
    id: `qq_${Buffer.from(url).toString('base64').slice(0, 20)}`,
    question: metrics.title || title,
    url,
    keyword,
    views: metrics.views || 0,
    viewsLabel: formatMetric(metrics.views || 0),
    upvotes: metrics.upvotes || 0,
    upvotesLabel: formatMetric(metrics.upvotes || 0),
    answerCount: metrics.answerCount || 0,
    existingAnswers: metrics.existingAnswers || [],
    metricsSource: scraped?.views ? 'scrape' : 'estimated',
    score: (metrics.views || 0) + (metrics.upvotes || 0) * 10,
  };
}

async function generateAnswer(deps, payload) {
  const {
    question, mode = 'website', frameworkId, customPromptId,
    youtubeUrl, angleId, model, documents,
  } = payload || {};
  if (!question?.question && !question?.url) throw new Error('Question is required');

  const settings = payload.settings || DEFAULT_SETTINGS;
  const angle = getAngle(settings, angleId);
  const campaign = deps.campaign || {};
  const framework = PROMPT_FRAMEWORKS.find((f) => f.id === frameworkId) || PROMPT_FRAMEWORKS[0];
  const custom = settings.customPrompts.find((p) => p.id === customPromptId);

  let existingContext = '';
  if (question.existingAnswers?.length) {
    existingContext = question.existingAnswers.map((a, i) => `Answer ${i + 1}: ${a}`).join('\n\n');
  } else if (question.url) {
    const scraped = await scrapeQuestionMetrics(question.url);
    if (scraped?.existingAnswers?.length) {
      existingContext = scraped.existingAnswers.map((a, i) => `Answer ${i + 1}: ${a}`).join('\n\n');
    }
  }

  let youtubeBlock = '';
  let videoId = null;
  if (mode === 'youtube' && youtubeUrl) {
    const tx = await fetchYouTubeTranscript(youtubeUrl);
    videoId = tx.videoId;
    youtubeBlock = [
      `YouTube URL: ${youtubeUrl}`,
      tx.transcript ? `Transcript excerpt: ${tx.transcript.slice(0, 6000)}` : 'Use the YouTube URL for context.',
      'Embed the YouTube link naturally — Quora will auto-embed the video.',
    ].join('\n');
  }

  const docContext = (documents || settings.documents || [])
    .map((d) => `--- ${d.name} ---\n${(d.content || '').slice(0, 3000)}`)
    .join('\n\n');

  const prompt = `Write a Quora answer for this question.

QUESTION: ${question.question}
URL: ${question.url || 'n/a'}
VIEWS: ${question.viewsLabel || question.views || 'unknown'} | UPVOTES: ${question.upvotesLabel || question.upvotes || 'unknown'} | EXISTING ANSWERS: ${question.answerCount || 'unknown'}

BRAND ANGLE:
${buildAngleContext(angle, campaign)}

FRAMEWORK: ${framework.template}
${custom?.text ? `CUSTOM PROMPT:\n${custom.text}` : ''}

MODE: ${mode === 'youtube' ? 'YouTube Mode — include video link for embed' : 'Website Mode — position offer/blog as solution'}

${existingContext ? `EXISTING ANSWERS ON THIS QUESTION (read first, write something better and more complete):\n${existingContext}` : ''}

${youtubeBlock}

${docContext ? `BRAND DOCUMENTS:\n${docContext}` : ''}

Requirements:
- Sound human, contextual, first-person where appropriate
- Place CTA naturally inside the answer (not spammy, not at the very end only)
- Do not use superlatives like "ultimate" or "master"
- 400-900 words
- ${mode === 'youtube' && videoId ? `Include this link: https://www.youtube.com/watch?v=${videoId}` : ''}
Output the answer text only (plain text or light HTML paragraphs).`;

  const keys = deps.keys || {};
  const resolvedModel = resolveAIModel(model || settings.model, keys);
  const generate = deps.generateAIWithModel || deps.generateAI;
  const text = await generate(prompt, resolvedModel);

  let content = text.trim();
  if (mode === 'youtube' && videoId && !content.includes('youtube.com')) {
    content += `\n\n${youtubeEmbedHtml(videoId, question.question)}`;
  }

  const answer = {
    id: `qa_${Date.now()}`,
    questionId: question.id,
    question: question.question,
    questionUrl: question.url,
    keyword: question.keyword,
    mode,
    frameworkId: framework.id,
    content,
    status: 'draft',
    createdAt: new Date().toISOString(),
    views: question.views,
    upvotes: question.upvotes,
    youtubeUrl: youtubeUrl || null,
  };

  return { success: true, answer };
}

function getQuoraAccount(linkedAccounts) {
  return (linkedAccounts || []).find((a) => a.platform === 'Quora' && a.settings?.automationEnabled !== false)
    || (linkedAccounts || []).find((a) => a.platform === 'Quora');
}

async function publishAnswer(deps, payload) {
  const { answer, automated, store, campaignId } = payload;
  if (!answer?.content) throw new Error('Answer content required');

  const linkedAccounts = deps.linkedAccounts || [];
  const account = getQuoraAccount(linkedAccounts);
  if (!account) {
    return { success: false, error: 'Link a Quora account in Linked Accounts (email + password).' };
  }

  const { parseTokens } = require('./intelligenceProfile');
  const tokens = parseTokens(account);

  const result = await quora.publish(
    { content: answer.content, questionUrl: answer.questionUrl, url: answer.questionUrl },
    tokens,
    account,
  );

  if (result.livePosted) {
    const settings = loadSettings(store, campaignId);
    const updated = {
      ...answer,
      status: 'published',
      publishedAt: new Date().toISOString(),
      automated: !!automated,
    };
    settings.answers = [updated, ...settings.answers.filter((a) => a.id !== answer.id)];
    settings.publishedLog = [{
      question: answer.question,
      url: answer.questionUrl,
      publishedAt: updated.publishedAt,
      mode: answer.mode,
      automated: !!automated,
    }, ...settings.publishedLog].slice(0, 200);
    saveSettings(store, campaignId, settings);
  }

  return result;
}

function getStatus(store, campaignId, keys, linkedAccounts, campaign = {}) {
  const settings = loadSettings(store, campaignId);
  const quoraAccount = getQuoraAccount(linkedAccounts || []);
  const tokens = quoraAccount ? require('./intelligenceProfile').parseTokens(quoraAccount) : null;
  const connectionId = quoraAccount ? quoraBrowser.resolveConnectionId(quoraAccount, tokens) : null;
  let puppeteerOk = false;
  try { puppeteerOk = !!require('puppeteer'); } catch (e) { puppeteerOk = false; }
  return {
    mode: settings.mode,
    hasSerpApi: !!keys?.serpApiKey,
    hasOpenRouter: !!keys?.openrouter,
    hasGemini: !!keys?.gemini,
    hasAI: !!(keys?.openrouter || keys?.gemini),
    puppeteerOk,
    quoraLinked: !!quoraAccount,
    quoraHandle: quoraAccount?.handle || null,
    connectionId,
    sessionValid: connectionId ? quoraBrowser.sessionExists(connectionId) : false,
    angleCount: settings.angles.length,
    documentCount: settings.documents.length,
    draftCount: settings.answers.filter((a) => a.status === 'draft').length,
    publishedCount: settings.publishedLog.length,
    frameworks: PROMPT_FRAMEWORKS,
    campaign: {
      brandName: campaign.brandName || '',
      domain: campaign.domain || '',
      description: campaign.description || '',
      tone: campaign.tone || '',
    },
  };
}

module.exports = {
  PROMPT_FRAMEWORKS,
  DEFAULT_SETTINGS,
  loadSettings,
  saveSettings,
  scrapeQuestions,
  scrapeViaMojeekSearch,
  scrapeViaBraveSearch,
  scrapeViaDuckDuckGo,
  scrapeViaQuoraBrowser,
  lookupQuestionByUrl,
  scrapeQuestionMetrics,
  fetchYouTubeTranscript,
  generateAnswer,
  publishAnswer,
  getStatus,
  resolveAIModel,
  formatMetric,
  extractYouTubeId,
};