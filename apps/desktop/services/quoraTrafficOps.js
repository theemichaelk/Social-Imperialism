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
  model: 'openai/gpt-4o-mini',
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

async function scrapeQuestions(keyword, keys, options = {}) {
  const limit = options.limit || 25;
  const enrich = options.enrich !== false;
  const results = [];

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
        const r = organic[i];
        const url = r.link || '';
        if (!url.includes('quora.com')) continue;
        const title = (r.title || '').replace(/ - Quora.*$/i, '').trim();
        let metrics = estimateMetricsFromRank(i, r.snippet);
        if (enrich && url) {
          const scraped = await scrapeQuestionMetrics(url);
          if (scraped) {
            metrics = {
              views: scraped.views || metrics.views,
              upvotes: scraped.upvotes || metrics.upvotes,
              answerCount: scraped.answerCount || metrics.answerCount,
              existingAnswers: scraped.existingAnswers,
              metricsSource: scraped.views ? 'scrape' : metrics.metricsSource,
            };
          }
        }
        results.push({
          id: `qq_${Buffer.from(url).toString('base64').slice(0, 20)}`,
          question: title || r.snippet?.slice(0, 120),
          url,
          keyword,
          views: metrics.views,
          viewsLabel: formatMetric(metrics.views),
          upvotes: metrics.upvotes,
          upvotesLabel: formatMetric(metrics.upvotes),
          answerCount: metrics.answerCount,
          existingAnswers: metrics.existingAnswers || [],
          metricsSource: metrics.metricsSource,
          score: metrics.views + metrics.upvotes * 10,
        });
      }
    } catch (e) {
      console.error('Quora Traffic SerpAPI:', e.message);
    }
  }

  if (!results.length) {
    const fallback = await quora.searchPosts(keyword, keys, limit);
    fallback.forEach((p, i) => {
      const m = estimateMetricsFromRank(i, p.content);
      results.push({
        id: p.externalId,
        question: p.content,
        url: p.url,
        keyword,
        views: m.views,
        viewsLabel: formatMetric(m.views),
        upvotes: m.upvotes,
        upvotesLabel: formatMetric(m.upvotes),
        answerCount: m.answerCount,
        existingAnswers: [],
        metricsSource: 'estimated',
        score: m.views,
      });
    });
  }

  results.sort((a, b) => b.score - a.score);
  return results.slice(0, limit);
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

  const generate = deps.generateAIWithModel || deps.generateAI;
  const text = await generate(prompt, model || settings.model || 'openai/gpt-4o-mini');

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

  if (result.livePosted || result.success) {
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

function getStatus(store, campaignId, keys, linkedAccounts) {
  const settings = loadSettings(store, campaignId);
  const quoraAccount = getQuoraAccount(linkedAccounts || []);
  const connectionId = quoraAccount ? quoraBrowser.resolveConnectionId(quoraAccount, null) : null;
  return {
    mode: settings.mode,
    hasSerpApi: !!keys?.serpApiKey,
    hasOpenRouter: !!keys?.openrouter,
    quoraLinked: !!quoraAccount,
    sessionValid: connectionId ? quoraBrowser.sessionExists(connectionId) : false,
    angleCount: settings.angles.length,
    documentCount: settings.documents.length,
    draftCount: settings.answers.filter((a) => a.status === 'draft').length,
    publishedCount: settings.publishedLog.length,
    frameworks: PROMPT_FRAMEWORKS,
  };
}

module.exports = {
  PROMPT_FRAMEWORKS,
  DEFAULT_SETTINGS,
  loadSettings,
  saveSettings,
  scrapeQuestions,
  scrapeQuestionMetrics,
  fetchYouTubeTranscript,
  generateAnswer,
  publishAnswer,
  getStatus,
  formatMetric,
  extractYouTubeId,
};