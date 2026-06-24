/**
 * Content Studio — multi-format generation + long-range scheduling.
 */
const { applyContentHumanization, HUMANIZATION_LEVELS } = require('../../../packages/core/src/contentHumanization');
const { getTemplateSpec } = require('../../../packages/core/src/imperialTemplateMap');

const MAX_CAMPAIGN_DAYS = 180;
const MAX_SCHEDULED_POSTS = 200;

const AI_MODELS = [
  { id: 'gemini', label: 'Google Gemini (default)', provider: 'gemini' },
  { id: 'openai/gpt-4o', label: 'GPT-4o (OpenRouter)', provider: 'openrouter' },
  { id: 'anthropic/claude-3.5-sonnet', label: 'Claude 3.5 Sonnet (OpenRouter)', provider: 'openrouter' },
  { id: 'meta-llama/llama-3.1-70b-instruct', label: 'Llama 3.1 70B (OpenRouter)', provider: 'openrouter' },
  { id: 'openai-direct', label: 'GPT-4o (OpenAI direct)', provider: 'openai' },
  { id: 'grok-browser', label: 'Grok (browser session)', provider: 'grok' },
];

const CONTENT_TYPES = [
  { id: 'post', label: 'Text Post', icon: 'fa-pen' },
  { id: 'image', label: 'Image', icon: 'fa-image' },
  { id: 'infographic', label: 'Infographic', icon: 'fa-chart-pie' },
  { id: 'video', label: 'Video / Reel', icon: 'fa-video' },
  { id: 'carousel', label: 'Carousel', icon: 'fa-layer-group' },
  { id: 'thumbnail', label: 'Viral Thumbnail', icon: 'fa-fire' },
  { id: 'thread', label: 'Thread / X', icon: 'fa-list' },
  { id: 'answer', label: 'Q&A Answer', icon: 'fa-question-circle' },
  { id: 'analytics', label: 'Analytics Insight', icon: 'fa-chart-line' },
];

const FREQUENCIES = {
  daily: { label: 'Daily', daysBetween: 1 },
  every2days: { label: 'Every 2 days', daysBetween: 2 },
  '3xweek': { label: '3× per week (Mon/Wed/Fri)', daysBetween: null, weekdays: [1, 3, 5] },
  weekly: { label: 'Weekly', daysBetween: 7 },
  biweekly: { label: 'Bi-weekly', daysBetween: 14 },
};

function parseKeywords(raw) {
  return String(raw || '')
    .split(/[\n,;]+/)
    .map((k) => k.trim())
    .filter(Boolean);
}

function clampEndDate(start, end) {
  const s = new Date(start);
  const e = new Date(end);
  if (Number.isNaN(s.getTime())) throw new Error('Invalid start date');
  if (Number.isNaN(e.getTime())) throw new Error('Invalid end date');
  const maxEnd = new Date(s);
  maxEnd.setDate(maxEnd.getDate() + MAX_CAMPAIGN_DAYS);
  return e.getTime() > maxEnd.getTime() ? maxEnd : e;
}

function buildScheduleDates({ startDate, endDate, frequency, timeOfDay = '10:00' }) {
  const start = new Date(startDate);
  const end = clampEndDate(startDate, endDate);
  const [hh, mm] = String(timeOfDay).split(':').map((n) => parseInt(n, 10) || 0);
  const freq = FREQUENCIES[frequency] || FREQUENCIES.daily;
  const slots = [];
  const cursor = new Date(start);
  cursor.setHours(hh, mm, 0, 0);

  while (cursor.getTime() <= end.getTime() && slots.length < MAX_SCHEDULED_POSTS) {
    if (freq.weekdays) {
      if (freq.weekdays.includes(cursor.getDay())) slots.push(new Date(cursor));
      cursor.setDate(cursor.getDate() + 1);
    } else {
      slots.push(new Date(cursor));
      cursor.setDate(cursor.getDate() + (freq.daysBetween || 1));
    }
  }
  return slots;
}

function tabContextPrompt(tabId) {
  const map = {
    standard: 'standard social media post',
    media: 'short-form video / reel caption with hooks',
    repurpose: 'repurposed multi-platform content from source material',
    analytics: 'data-driven performance insight post',
    answer: 'long-form Q&A marketing answer',
    rss: 'RSS/news curated summary post',
  };
  return map[tabId] || 'social content';
}

function getCampaignBrandBlock(store) {
  if (!store) return '';
  try {
    const { buildBrandGuidelinesBlock } = require('./brandGuidelines');
    const activeId = store.getItem('activeCampaignId') || 'default';
    const campaign = JSON.parse(store.getItem('campaigns') || '[]').find((c) => c.id === activeId) || {};
    const block = buildBrandGuidelinesBlock(campaign);
    const brand = [campaign.brandName, campaign.domain, campaign.description].filter(Boolean).join(' — ');
    return brand ? `Brand: ${brand}\n${block}` : block;
  } catch (e) {
    return '';
  }
}

function getLibraryContextBlock(store, assetIds = []) {
  if (!store) return '';
  try {
    const { getLibrary } = require('./contentLibraryIpc');
    const lib = getLibrary(store);
    const picked = assetIds.length
      ? lib.filter((a) => assetIds.includes(a.id))
      : lib.slice(0, 8);
    if (!picked.length) return '';
    const lines = picked.map((a) => {
      if (a.type === 'copy' || a.text) return `[${a.name}]: ${(a.text || '').slice(0, 400)}`;
      if (a.url) return `[${a.name}]: image ${a.url}`;
      return `[${a.name}]`;
    });
    return `\nContent Library assets to reference:\n${lines.join('\n')}\n`;
  } catch (e) {
    return '';
  }
}

function typePrompt(type, keywords, tabId, variantIndex = 0, brandBlock = '', libraryBlock = '') {
  const kw = keywords.join(', ');
  const ctx = tabContextPrompt(tabId);
  const brandPrefix = `${brandBlock}${libraryBlock}`;
  const prompts = {
    post: `${brandPrefix}Write a ${ctx} optimized for engagement. Keywords: ${kw}. Variant ${variantIndex + 1}. Include hashtags. Use library assets when relevant.`,
    image: `Write image caption + describe the ideal image to generate for keywords: ${kw}. Variant ${variantIndex + 1}.`,
    infographic: `Create infographic copy: headline, 5 data bullets, caption for keywords: ${kw}. Variant ${variantIndex + 1}.`,
    video: `Write viral reel/video script + caption for keywords: ${kw}. Variant ${variantIndex + 1}. Under 60s hook.`,
    carousel: `Create a 4-slide carousel: slide 1 hook, slides 2-4 value, CTA. Keywords: ${kw}. Variant ${variantIndex + 1}.`,
    thumbnail: `Write viral YouTube/Shorts thumbnail concept: hook headline (max 6 words), visual scene description, color palette. Keywords: ${kw}. Variant ${variantIndex + 1}.`,
    thread: `Write a 5-tweet/X thread about: ${kw}. Variant ${variantIndex + 1}. Number each tweet.`,
    answer: `Write a comprehensive Q&A answer addressing: ${kw}. Variant ${variantIndex + 1}. Authoritative tone.`,
    analytics: `Write a post analyzing performance trends for topics: ${kw}. Variant ${variantIndex + 1}. Include metrics-style insights.`,
  };
  return prompts[type] || prompts.post;
}

function imagePromptForType(type, keywords, textContent) {
  const kw = keywords.slice(0, 3).join(', ');
  if (type === 'infographic') {
    return `Professional infographic poster about ${kw}. Data visualization, charts, clean typography, 4:5 social format. ${(textContent || '').slice(0, 120)}`;
  }
  if (type === 'video') {
    return `Short vertical video thumbnail / motion graphic frame for reel about ${kw}. Dynamic, eye-catching.`;
  }
  if (type === 'carousel') {
    return `Carousel slide 1 cover image for social post about ${kw}. Bold headline visual.`;
  }
  if (type === 'thumbnail') {
    return `Viral high-CTR YouTube thumbnail about ${kw}. Bold expressive subject, large readable headline zone, saturated contrast. ${(textContent || '').slice(0, 120)}`;
  }
  return `Engaging social media image for: ${kw}. ${(textContent || '').slice(0, 100)}`;
}

async function resolveMediaForItem(deps, {
  type, spec, keywords, content, model, useGrok,
}) {
  const {
    generateImage,
    generateInfographic,
    generateGrokImagine,
    generateGrokVideo,
  } = deps;

  let mediaUrl = null;
  let isVideo = false;
  const kw = keywords.join(', ');
  const visualPrompt = spec?.visualPrompt
    ? spec.visualPrompt(kw, content)
    : imagePromptForType(type, keywords, content);

  const grokMedia = useGrok || model === 'grok-browser';

  if (spec?.grokVideo && grokMedia && generateGrokVideo) {
    const res = await generateGrokVideo(`${kw}\n${content}`, { maxExtends: 2 });
    const asset = res?.primaryAsset || res?.assets?.find((a) => a.type === 'video');
    if (asset?.path) mediaUrl = asset.path;
    else if (asset?.url) mediaUrl = asset.url;
    isVideo = true;
    return { mediaUrl, isVideo };
  }

  if (spec?.grokInfographic && grokMedia && generateInfographic) {
    const grokImg = await generateInfographic({ content: `${kw}\n${content}`, style: 'modern' });
    const asset = grokImg?.imageAsset || grokImg?.primaryAsset;
    if (asset?.path) mediaUrl = asset.path;
    else if (asset?.url) mediaUrl = asset.url;
    else if (grokImg?.imageUrl) mediaUrl = grokImg.imageUrl;
    return { mediaUrl, isVideo };
  }

  if (['image', 'infographic', 'carousel', 'video', 'thumbnail'].includes(type)) {
    if (grokMedia && (spec?.grokVisual || type === 'infographic')) {
      const grokImg = await generateGrokImagine(visualPrompt);
      const asset = grokImg?.primaryAsset || grokImg?.assets?.[0];
      if (asset?.path) mediaUrl = asset.path;
      else if (asset?.url) mediaUrl = asset.url;
      isVideo = type === 'video' && asset?.type === 'video';
    } else {
      const imgRes = await generateImage(visualPrompt);
      if (imgRes?.success && imgRes.imageUrl) mediaUrl = imgRes.imageUrl;
    }
  }

  return { mediaUrl, isVideo };
}

async function generateOneItem(deps, {
  type, keywords, model, tabId, variantIndex, account,
  templateId, humanizationLevel, campaignTone,
}) {
  const { generateAIWithModel } = deps;

  const brandBlock = getCampaignBrandBlock(deps.store);
  const libraryBlock = getLibraryContextBlock(deps.store, deps.assetIds || []);
  const spec = templateId ? getTemplateSpec(templateId) : null;
  const useGrok = model === 'grok-browser' || deps.forceGrok;

  const prompt = spec
    ? `${brandBlock}${libraryBlock}${spec.prompt(keywords.join(', '), variantIndex)}`
    : typePrompt(type, keywords, tabId, variantIndex, brandBlock, libraryBlock);

  let content = '';
  if (useGrok && spec?.grokText !== false) {
    content = await generateAIWithModel(prompt, 'grok-browser');
  } else {
    content = await generateAIWithModel(prompt, model);
  }

  const level = humanizationLevel || deps.humanizationLevel || 'standard';
  if (level && level !== 'off') {
    content = await applyContentHumanization(
      { generateAIWithModel },
      content,
      {
        humanizationLevel: level,
        model: model === 'grok-browser' ? 'gemini' : model,
        tone: campaignTone || 'professional',
        templateLabel: spec?.label || type,
        platform: account?.platform,
      },
    );
  }

  const { mediaUrl, isVideo } = await resolveMediaForItem(deps, {
    type: spec?.contentType || type,
    spec,
    keywords,
    content,
    model,
    useGrok,
  });

  return {
    id: `gen_${Date.now()}_${type}_${variantIndex}`,
    type: spec?.contentType || type,
    templateId: templateId || spec?.id,
    content,
    mediaUrl,
    isVideo: isVideo || type === 'video',
    hasMedia: !!mediaUrl,
    accountId: account?.id,
    platform: account?.platform || 'Facebook',
    tabId,
    keywords: keywords.join(', '),
    model,
    humanizationLevel: level,
  };
}

async function generateContentBatch(deps, payload) {
  const keywords = parseKeywords(payload.keywords);
  if (!keywords.length) throw new Error('Enter at least one keyword.');

  const templateIds = Array.isArray(payload.templateIds) && payload.templateIds.length
    ? payload.templateIds
    : null;
  const types = templateIds
    ? null
    : (Array.isArray(payload.types) && payload.types.length ? payload.types : ['post']);
  const model = payload.model || 'gemini';
  const tabId = payload.tabId || 'standard';
  const account = payload.account || null;
  const count = Math.min(10, Math.max(1, parseInt(payload.count, 10) || 0));
  const variantsPerType = count || Math.min(5, Math.max(1, parseInt(payload.variantsPerType, 10) || 1));
  const humanizationLevel = payload.humanizationLevel || 'standard';
  const storeRef = deps.store || payload.store;
  let campaignTone = 'professional';
  try {
    const activeId = storeRef?.getItem('activeCampaignId') || 'default';
    const camp = JSON.parse(storeRef?.getItem('campaigns') || '[]').find((c) => c.id === activeId);
    campaignTone = camp?.tone || campaignTone;
  } catch (e) { /* ignore */ }

  const batchDeps = {
    ...deps,
    store: deps.store || payload.store,
    assetIds: payload.assetIds || [],
    humanizationLevel,
    forceGrok: payload.useGrok === true,
  };

  if (payload.useLibraryAssets && batchDeps.store) {
    try {
      const { getLibrary } = require('./contentLibraryIpc');
      const lib = getLibrary(batchDeps.store);
      if (lib.length && !batchDeps.assetIds.length) {
        batchDeps.assetIds = lib.slice(0, 6).map((a) => a.id);
      }
    } catch (e) { /* noop */ }
  }

  const workQueue = templateIds
    ? templateIds.map((tid) => ({ templateId: tid, type: getTemplateSpec(tid).contentType }))
    : types.map((type) => ({ type, templateId: null }));

  const items = [];
  for (const job of workQueue) {
    for (let v = 0; v < variantsPerType; v += 1) {
      const item = await generateOneItem(batchDeps, {
        type: job.type,
        templateId: job.templateId,
        keywords,
        model,
        tabId,
        variantIndex: v,
        account,
        humanizationLevel,
        campaignTone,
      });
      if (batchDeps.store && batchDeps.assetIds?.length) {
        try {
          const { getLibrary } = require('./contentLibraryIpc');
          const img = getLibrary(batchDeps.store).find((a) => batchDeps.assetIds.includes(a.id) && a.url);
          if (img?.url && !item.mediaUrl) item.mediaUrl = img.url;
        } catch (e) { /* noop */ }
      }
      items.push(item);
    }
  }
  return { success: true, items, count: items.length };
}

async function scheduleGeneratedItems(store, saveScheduledPosts, items, scheduleConfig) {
  const {
    mode, startDate, endDate, frequency, timeOfDay, publishNow,
  } = scheduleConfig;

  const scheduled = [];
  if (publishNow || mode === 'now') {
    return { scheduled: [], mode: 'now', items };
  }

  let dates = [];
  if (mode === 'single' && scheduleConfig.singleDateTime) {
    dates = [new Date(scheduleConfig.singleDateTime)];
  } else if (mode === 'campaign') {
    dates = buildScheduleDates({ startDate, endDate, frequency, timeOfDay });
  }

  if (!dates.length) throw new Error('No schedule dates generated. Check date range and frequency.');

  const posts = [];
  let dateIdx = 0;
  for (let i = 0; i < items.length && dateIdx < dates.length; i += 1) {
    const item = items[i];
    const slot = dates[dateIdx % dates.length];
    dateIdx += 1;
    const post = {
      id: `sched_${Date.now()}_${i}`,
      campaignId: store.getItem('activeCampaignId') || 'default',
      platform: item.platform,
      accountId: item.accountId,
      content: item.content,
      mediaUrl: item.mediaUrl || null,
      hasMedia: !!item.mediaUrl,
      isVideo: !!item.isVideo,
      timestamp: slot.toISOString(),
      scheduleTime: slot.toISOString(),
      dateIndex: slot.getDate(),
      status: 'scheduled',
      contentType: item.type,
      keywords: item.keywords,
      createdAt: new Date().toISOString(),
    };
    posts.push(post);
    scheduled.push(post);
  }

  const existing = saveScheduledPosts.getAll ? saveScheduledPosts.getAll() : [];
  const merged = [...existing, ...posts];
  if (saveScheduledPosts.save) saveScheduledPosts.save(merged);
  else saveScheduledPosts(merged);
  return { scheduled, count: scheduled.length, dateRange: { from: dates[0]?.toISOString(), to: dates[dates.length - 1]?.toISOString() } };
}

module.exports = {
  AI_MODELS,
  CONTENT_TYPES,
  FREQUENCIES,
  HUMANIZATION_LEVELS,
  MAX_CAMPAIGN_DAYS,
  MAX_SCHEDULED_POSTS,
  parseKeywords,
  buildScheduleDates,
  generateContentBatch,
  scheduleGeneratedItems,
  typePrompt,
  applyContentHumanization,
};