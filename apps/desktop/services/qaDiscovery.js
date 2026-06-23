const axios = require('axios');
const brandGuidelines = require('./brandGuidelines');
const { normalizePlatform } = require('./platformCatalog');

const UA = 'SocialImperialism/1.0';

const QUESTION_STARTERS = [
  'how', 'what', 'why', 'when', 'where', 'who', 'which', 'can', 'should', 'is', 'are',
  'does', 'do', 'could', 'would', 'anyone', 'recommend', 'best', 'alternative',
];

function loadJson(store, key, fallback) {
  try {
    const raw = store.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (e) {
    return fallback;
  }
}

function isQuestionHeuristic(text) {
  const t = String(text || '').trim();
  if (!t) return false;
  if (t.includes('?')) return true;
  const lower = t.toLowerCase();
  return QUESTION_STARTERS.some((w) => lower.startsWith(`${w} `) || lower.includes(` ${w} `));
}

async function classifyQuestion(text, generateAI) {
  if (!isQuestionHeuristic(text)) {
    return { isQuestion: false, confidence: 0.2, method: 'heuristic' };
  }
  if (!generateAI) {
    return { isQuestion: true, confidence: 0.75, method: 'heuristic' };
  }
  try {
    const raw = await generateAI(
      `Is this social media post primarily a question seeking advice or answers? Reply ONLY JSON: {"isQuestion":boolean,"confidence":0-1}\nPost: "${String(text).substring(0, 400)}"`
    );
    const match = raw.match(/\{[\s\S]*\}/);
    const parsed = match ? JSON.parse(match[0]) : {};
    return {
      isQuestion: !!parsed.isQuestion,
      confidence: parsed.confidence ?? 0.8,
      method: 'nlp',
    };
  } catch (e) {
    return { isQuestion: true, confidence: 0.7, method: 'heuristic-fallback' };
  }
}

function parseHoursElapsed(timeElapsed) {
  const raw = String(timeElapsed || '0');
  const n = parseInt(raw.replace(/\D/g, ''), 10);
  if (raw.includes('d')) return n * 24;
  if (raw.includes('m') && !raw.includes('min')) return n / 60;
  return n || 0;
}

function keywordMatchScore(content, keywords, brand) {
  const lower = String(content || '').toLowerCase();
  let score = 0;
  keywords.forEach((kw) => {
    if (lower.includes(String(kw).toLowerCase())) score += 12;
  });
  if (brand && lower.includes(String(brand).toLowerCase())) score += 8;
  return Math.min(30, score);
}

function computeRankScore(q, campaign, keywords) {
  const views = q.views || 0;
  const engagement = q.engagement || q.comments || 0;
  const hours = parseHoursElapsed(q.timeElapsed);
  const recency = hours <= 6 ? 18 : hours <= 24 ? 14 : hours <= 72 ? 8 : 4;
  const viewScore = Math.min(25, Math.log10(views + 1) * 8);
  const engageScore = Math.min(15, engagement * 0.5);
  const kwScore = keywordMatchScore(q.content, keywords, campaign.brandName);
  const relevance = (q.businessRelevance || 0) + kwScore + recency + viewScore + engageScore;
  const unansweredBoost = q.noBrandAnswer ? 10 : q.noAnswersYet ? 6 : 0;
  return Math.round(Math.min(99, relevance + unansweredBoost + (q.nlpConfidence || 0) * 5));
}

function hasBrandAnswered(question, brand, history) {
  const brandLower = String(brand || '').toLowerCase();
  if (!brandLower) return false;
  return history.some((r) => {
    const samePost = r.externalId && question.externalId && r.externalId === question.externalId;
    const sameUrl = r.url && question.url && r.url === question.url;
    const replyMentionsBrand = String(r.replyContent || '').toLowerCase().includes(brandLower);
    return (samePost || sameUrl) && (r.status === 'Published' || r.status === 'published') && replyMentionsBrand;
  });
}

function gatherKnowledgeSources(store, campaign) {
  const sources = [];
  if (campaign.description) sources.push({ type: 'brand', text: campaign.description });
  if (campaign.domain) sources.push({ type: 'domain', text: campaign.domain });
  if (campaign.affiliateLinks) sources.push({ type: 'affiliate', text: campaign.affiliateLinks });

  const faq = loadJson(store, 'qaFaqSources', []);
  faq.forEach((f) => sources.push({ type: 'faq', text: f }));

  const autoContent = loadJson(store, 'autoContentSettings', {});
  (autoContent.rssUrls || []).forEach((url) => sources.push({ type: 'rss', text: url }));

  const manual = store.getItem('qaManualSources');
  if (manual?.trim()) {
    manual.split('\n').filter(Boolean).forEach((line) => sources.push({ type: 'manual', text: line.trim() }));
  }

  return sources;
}

async function fetchRssSnippets(urls, limit = 3) {
  const snippets = [];
  for (const url of (urls || []).slice(0, 3)) {
    try {
      const res = await axios.get(url, { timeout: 10000 });
      const xml = res.data;
      const itemRegex = /<item[^>]*>([\s\S]*?)<\/item>/gi;
      let match;
      let count = 0;
      while ((match = itemRegex.exec(xml)) && count < limit) {
        const itemXml = match[1];
        const title = (itemXml.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [])[1] || '';
        const desc = (itemXml.match(/<description[^>]*>([\s\S]*?)<\/description>/i) || [])[1] || '';
        const clean = `${title} ${desc}`.replace(/<!\[CDATA\[|\]\]>/g, '').replace(/<[^>]+>/g, '').trim().substring(0, 280);
        if (clean) snippets.push(clean);
        count += 1;
      }
    } catch (e) { /* skip */ }
  }
  return snippets;
}

async function composeAnswer({ question, campaign, store, generateAI, oneTimeOverride }) {
  const sources = gatherKnowledgeSources(store, campaign);
  const rssUrls = sources.filter((s) => s.type === 'rss').map((s) => s.text);
  const rssSnippets = await fetchRssSnippets(rssUrls, 4);
  const sourceBlock = [
    ...sources.filter((s) => s.type !== 'rss').map((s) => `- ${s.type}: ${s.text}`),
    ...rssSnippets.map((s, i) => `- blog/rss excerpt ${i + 1}: ${s}`),
  ].join('\n');

  const prompt = `${brandGuidelines.buildReplySystemPrompt(campaign, { oneTimeOverride })}
You are writing a LONG-FORM, authoritative answer for a Q&A marketing channel.

QUESTION (${question.platform}):
"${question.content}"

KNOWLEDGE SOURCES (cite ideas naturally, link to ${campaign.domain || 'our site'} when relevant):
${sourceBlock || 'Use brand expertise and domain knowledge.'}

Requirements:
- 3-6 paragraphs, high quality, helpful, SEO-friendly
- Position ${campaign.brandName} as the expert without being spammy
- Include practical steps, examples, and a clear CTA
- Suitable for posting on ${question.platform} AND repurposing as a blog section
- Return markdown-friendly text with optional **bold** and bullet lists
Return ONLY the answer body.`;

  return generateAI(prompt);
}

const PLATFORM_FORMAT = {
  Twitter: { maxLen: 280, hashtags: 2 },
  Reddit: { maxLen: 10000, hashtags: 0 },
  LinkedIn: { maxLen: 3000, hashtags: 3 },
  Quora: { maxLen: 8000, hashtags: 0 },
  default: { maxLen: 2000, hashtags: 2 },
};

function formatForPlatform(content, platform) {
  const key = normalizePlatform(platform);
  const rules = PLATFORM_FORMAT[key] || PLATFORM_FORMAT.default;
  let text = String(content || '').trim();
  if (text.length > rules.maxLen) {
    text = `${text.substring(0, rules.maxLen - 3)}...`;
  }
  if (rules.hashtags > 0 && !text.includes('#')) {
    text += `\n\n#${key.replace(/\s/g, '')} #Marketing`;
  }
  return text;
}

function applyThresholds(questions, settings = {}) {
  const minViews = settings.minViews ?? 500;
  const minHours = settings.minTime === '1h' ? 1 : settings.minTime === '6h' ? 6 : settings.minTime === '24h' ? 24 : 0;
  const requireNoBrand = settings.requireNoBrandAnswer !== false;

  return questions.filter((q) => {
    if ((q.views || 0) < minViews) return false;
    if (minHours > 0 && parseHoursElapsed(q.timeElapsed) < minHours) return false;
    if (requireNoBrand && q.brandAnswered) return false;
    return q.isQuestion !== false;
  });
}

async function discoverQuestions(store, keys, campaign, generateAI) {
  const brand = campaign.brandName || 'your brand';
  const audience = campaign.audience || 'professionals';
  const activeCampaignId = store.getItem('activeCampaignId') || 'default';

  let keywords = [];
  try {
    keywords = JSON.parse(store.getItem('keywords') || '[]')
      .filter((k) => k.campaignId === activeCampaignId)
      .map((k) => k.term);
  } catch (e) {}
  const kwStr = keywords.length ? keywords.slice(0, 5).join(' ') : `${brand} ${audience}`;

  const history = loadJson(store, 'aiRepliesHistory', []);
  const rawCandidates = [];

  try {
    const rdRes = await axios.get('https://www.reddit.com/search.json', {
      params: { q: `${kwStr}`, limit: 25, sort: 'new', type: 'link' },
      headers: { 'User-Agent': UA },
      timeout: 15000,
    });
    (rdRes.data?.data?.children || []).forEach((child) => {
      const p = child.data;
      const content = p.title || '';
      if (!content) return;
      const comments = p.num_comments || 0;
      rawCandidates.push({
        platform: `Reddit / ${p.subreddit_name_prefixed || 'r/all'}`,
        views: (p.ups || 0) * 10 + comments * 5,
        engagement: comments,
        comments,
        timeElapsed: `${Math.max(1, Math.floor((Date.now() / 1000 - p.created_utc) / 3600))}h`,
        content,
        url: `https://reddit.com${p.permalink}`,
        externalId: p.id,
        author: `u/${p.author}`,
        noAnswersYet: comments === 0,
        createdAt: p.created_utc * 1000,
      });
    });
  } catch (e) {
    console.error('Reddit Q&A discovery error:', e.message);
    try {
      const { discoverRedditPosts } = require('./webDiscovery');
      const hits = await discoverRedditPosts(kwStr, keys, 15);
      hits.forEach((p) => {
        if (!p.content) return;
        rawCandidates.push({
          platform: 'Reddit',
          views: 100,
          engagement: 0,
          comments: 0,
          timeElapsed: 'recent',
          content: p.content,
          url: p.url,
          externalId: p.externalId,
          author: p.author || 'Reddit',
          noAnswersYet: true,
        });
      });
    } catch (err) {
      console.error('Reddit web Q&A fallback:', err.message);
    }
  }

  if (keys.serpApiKey) {
    try {
      const serpRes = await axios.get('https://serpapi.com/search.json', {
        params: {
          engine: 'google',
          q: `${kwStr} (site:quora.com OR site:reddit.com)`,
          api_key: keys.serpApiKey,
          num: 10,
        },
        timeout: 15000,
      });
      (serpRes.data?.organic_results || []).forEach((r) => {
        if (!r.title) return;
        rawCandidates.push({
          platform: r.link?.includes('quora') ? 'Quora' : 'Web Q&A',
          views: 0,
          engagement: 0,
          timeElapsed: 'recent',
          content: r.title,
          url: r.link,
          noAnswersYet: true,
        });
      });
    } catch (e) {
      console.error('SerpAPI Q&A discovery error:', e.message);
    }
  }

  try {
    const { fetchRealFeed } = require('./feedFetcher');
    const feedPosts = await fetchRealFeed({
      keywords: keywords.length ? keywords.slice(0, 2) : [brand],
      filters: { sort: 'engagement', quick: true },
      keys,
      allowedPlatforms: new Set(),
    });
    feedPosts.forEach((p) => {
      if (!isQuestionHeuristic(p.content)) return;
      rawCandidates.push({
        platform: p.platform || 'Social',
        views: (p.stats?.likes || 0) * 5 + (p.stats?.comments || 0) * 8,
        engagement: (p.stats?.comments || 0),
        comments: p.stats?.comments || 0,
        timeElapsed: 'recent',
        content: p.content,
        url: p.url,
        externalId: p.externalId,
        author: p.author,
        noAnswersYet: (p.stats?.comments || 0) === 0,
      });
    });
  } catch (e) {
    console.error('Feed Q&A discovery error:', e.message);
  }

  const questionCandidates = rawCandidates.filter((c) => isQuestionHeuristic(c.content));
  const questions = [];
  let aiClassifications = 0;
  const AI_CLASSIFY_LIMIT = 12;
  for (const cand of questionCandidates) {
    const classification = (generateAI && aiClassifications < AI_CLASSIFY_LIMIT)
      ? await classifyQuestion(cand.content, generateAI)
      : { isQuestion: true, confidence: 0.78, method: 'heuristic' };
    if (generateAI && aiClassifications < AI_CLASSIFY_LIMIT) aiClassifications += 1;
    if (!classification.isQuestion) continue;

    const brandAnswered = hasBrandAnswered(cand, brand, history);
    const enriched = {
      ...cand,
      isQuestion: true,
      nlpConfidence: classification.confidence,
      classificationMethod: classification.method,
      classification: 'Best Question for Your Business',
      brandAnswered,
      noBrandAnswer: !brandAnswered,
      networkSize: '30M+',
      campaignId: activeCampaignId,
    };
    enriched.rankScore = computeRankScore(enriched, campaign, keywords);
    enriched.businessRelevance = keywordMatchScore(cand.content, keywords, brand);
    questions.push(enriched);
  }

  questions.sort((a, b) => b.rankScore - a.rankScore);
  const top = questions.slice(0, 50);
  store.setItem('unansweredQuestions', JSON.stringify(top));
  store.setItem('bestQuestionsForBusiness', JSON.stringify(top.slice(0, 15)));
  return top;
}

module.exports = {
  isQuestionHeuristic,
  classifyQuestion,
  computeRankScore,
  hasBrandAnswered,
  gatherKnowledgeSources,
  composeAnswer,
  formatForPlatform,
  applyThresholds,
  discoverQuestions,
  parseHoursElapsed,
};