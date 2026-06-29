/**
 * Image Format Intelligence — study uploaded images, label psychology/category,
 * save reusable format templates, and recreate in brand voice.
 */

const CATEGORIES = [
  'news', 'celebrity-news', 'trending-news', 'promotional', 'educational',
  'quote', 'testimonial', 'lifestyle', 'meme', 'announcement', 'engaging-post',
  'infographic', 'photo-highlight', 'other',
];

const LAYOUT_MAP = {
  news: 'headline-image-cta',
  'celebrity-news': 'headline-image-cta',
  'trending-news': 'headline-image-cta',
  promotional: 'headline-image-cta',
  educational: 'title-bullets',
  quote: 'quote-overlay',
  testimonial: 'testimonial-image',
  lifestyle: 'headline-image-cta',
  meme: 'headline-image-cta',
  announcement: 'headline-image-cta',
  'engaging-post': 'headline-image-cta',
  infographic: 'title-bullets',
  'photo-highlight': 'headline-image-cta',
  other: 'headline-image-cta',
};

function templatesKey(store) {
  const activeId = store.getItem('activeCampaignId') || 'default';
  return `formatTemplates_${activeId}`;
}

function getFormatTemplates(store) {
  try {
    return JSON.parse(store.getItem(templatesKey(store)) || '[]');
  } catch (e) {
    return [];
  }
}

function saveFormatTemplates(store, templates) {
  store.setItem(templatesKey(store), JSON.stringify(templates));
}

function parseDataUrl(dataUrl) {
  const match = String(dataUrl || '').match(/^data:([^;]+);base64,(.+)$/);
  if (!match) return null;
  return { mime: match[1], buffer: Buffer.from(match[2], 'base64') };
}

function getPngDimensions(buffer) {
  if (buffer.length < 24) return null;
  const sig = buffer.slice(0, 8);
  if (!sig.equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return null;
  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
}

function getJpegDimensions(buffer) {
  let i = 2;
  while (i < buffer.length) {
    if (buffer[i] !== 0xff) { i += 1; continue; }
    const marker = buffer[i + 1];
    if (marker === 0xc0 || marker === 0xc2) {
      return { height: buffer.readUInt16BE(i + 5), width: buffer.readUInt16BE(i + 7) };
    }
    const len = buffer.readUInt16BE(i + 2);
    i += 2 + len;
  }
  return null;
}

function getImageDimensions(imageUrl) {
  const parsed = parseDataUrl(imageUrl);
  if (!parsed) return { width: null, height: null, aspectRatio: null, orientation: 'unknown' };
  let dims = null;
  if (parsed.mime.includes('png')) dims = getPngDimensions(parsed.buffer);
  else if (parsed.mime.includes('jpeg') || parsed.mime.includes('jpg')) dims = getJpegDimensions(parsed.buffer);
  if (!dims?.width || !dims?.height) {
    return { width: null, height: null, aspectRatio: null, orientation: 'unknown' };
  }
  const ratio = +(dims.width / dims.height).toFixed(3);
  let orientation = 'square';
  if (ratio > 1.15) orientation = 'landscape';
  else if (ratio < 0.85) orientation = 'portrait';
  return { width: dims.width, height: dims.height, aspectRatio: ratio, orientation };
}

function buildAnalysisPrompt(dimensions, brandName) {
  return `You are a social media visual intelligence analyst. Study this image and return ONLY valid JSON (no markdown).

Brand context: ${brandName || 'general brand'}

Analyze:
- Physical format: size feel, aspect ratio (${dimensions.orientation || 'unknown'}), text placement, colors, typography style
- Content: what it says, why it says it, headline/subtext if visible
- Psychology: emotional triggers, engagement style, what response it tries to provoke
- Category: news, celebrity-news, trending-news, promotional, educational, quote, testimonial, lifestyle, meme, announcement, engaging-post, infographic, photo-highlight, or other
- Whether it is news, trending, has famous people, is an engaging/triggering post

Return this exact JSON shape:
{
  "dimensions": { "width": ${dimensions.width || 'null'}, "height": ${dimensions.height || 'null'}, "aspectRatio": ${dimensions.aspectRatio || 'null'}, "orientation": "${dimensions.orientation || 'unknown'}" },
  "format": {
    "layout": "headline-overlay|split-screen|quote-card|news-break|photo-highlight|carousel-slide|meme|infographic|minimal-text|full-bleed-photo",
    "textPlacement": "top|bottom|center|split|none",
    "hasFaces": false,
    "dominantColors": ["#hex"],
    "typography": "bold-sans|serif|handwritten|minimal|mixed"
  },
  "content": {
    "headline": "",
    "message": "",
    "subtext": "",
    "whatItSays": "",
    "whyItSays": ""
  },
  "psychology": {
    "emotionalTriggers": ["curiosity"],
    "engagementStyle": "informative|provocative|inspirational|entertaining|controversial",
    "responseIntent": "",
    "persuasionTechniques": []
  },
  "category": {
    "primary": "other",
    "secondary": [],
    "isNews": false,
    "isTrending": false,
    "hasFamousPeople": false
  },
  "labels": [],
  "keywords": [],
  "recreationPrompt": "Detailed prompt to recreate this exact visual FORMAT (not content) for a new brand topic",
  "confidence": 0.85
}`;
}

function parseAnalysisJson(raw) {
  const text = String(raw || '').trim();
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('AI did not return JSON analysis');
  const parsed = JSON.parse(jsonMatch[0]);
  if (!parsed.category) parsed.category = { primary: 'other', secondary: [], isNews: false, isTrending: false, hasFamousPeople: false };
  if (!CATEGORIES.includes(parsed.category.primary)) parsed.category.primary = 'other';
  parsed.analyzedAt = new Date().toISOString();
  return parsed;
}

function buildLabels(analysis) {
  const labels = new Set(analysis.labels || []);
  const cat = analysis.category?.primary;
  if (cat) labels.add(cat);
  if (analysis.category?.isNews) labels.add('news');
  if (analysis.category?.isTrending) labels.add('trending');
  if (analysis.category?.hasFamousPeople) labels.add('celebrity');
  if (analysis.format?.layout) labels.add(analysis.format.layout);
  if (analysis.psychology?.engagementStyle) labels.add(analysis.psychology.engagementStyle);
  (analysis.psychology?.emotionalTriggers || []).forEach((t) => labels.add(t));
  return [...labels].filter(Boolean).slice(0, 20);
}

function analysisToFormatTemplate(asset, analysis) {
  const primary = analysis.category?.primary || 'other';
  const layout = LAYOUT_MAP[primary] || 'headline-image-cta';
  const colors = analysis.format?.dominantColors || [];
  const gradient = colors.length >= 2
    ? [colors[0], colors[1]]
    : ['#1e293b', '#334155'];
  const accent = colors[0] || '#38bdf8';

  return {
    id: `fmt_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    label: `${primary.replace(/-/g, ' ')} · ${analysis.format?.layout || layout}`,
    sourceAssetId: asset.id,
    sourceImageUrl: asset.url,
    analysis,
    layout,
    slots: layout === 'quote-overlay'
      ? ['quote', 'attribution', 'image']
      : layout === 'title-bullets'
        ? ['headline', 'bullet1', 'bullet2', 'bullet3', 'image']
        : layout === 'testimonial-image'
          ? ['quote', 'name', 'image']
          : ['headline', 'body', 'image', 'cta'],
    designSlots: {
      headline: analysis.content?.headline || '',
      body: analysis.content?.message || analysis.content?.whatItSays || '',
      quote: analysis.content?.headline || '',
      cta: analysis.content?.subtext || '',
    },
    gradient,
    accent,
    keywords: analysis.keywords || [],
    category: primary,
    recreationPrompt: analysis.recreationPrompt || '',
    labels: buildLabels(analysis),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

function getBrandName(store) {
  try {
    const activeId = store.getItem('activeCampaignId');
    const camps = JSON.parse(store.getItem('campaigns') || '[]');
    const camp = camps.find((c) => c.id === activeId);
    return camp?.brandName || '';
  } catch (e) {
    return '';
  }
}

async function analyzeImageUrl({ imageUrl, generateAIVision, store }) {
  if (!imageUrl) return { success: false, error: 'No image URL provided' };
  const dimensions = getImageDimensions(imageUrl);
  const brandName = getBrandName(store);
  const prompt = buildAnalysisPrompt(dimensions, brandName);
  const raw = await generateAIVision(imageUrl, prompt);
  const analysis = parseAnalysisJson(raw);
  analysis.dimensions = { ...dimensions, ...analysis.dimensions };
  analysis.labels = buildLabels(analysis);
  return { success: true, analysis };
}

async function analyzeLibraryAsset({ store, generateAIVision, assetId }) {
  const { getLibrary } = require('./contentLibraryIpc');
  const lib = getLibrary(store);
  const asset = lib.find((a) => a.id === assetId);
  if (!asset?.url) return { success: false, error: 'Asset not found or has no image' };
  if (asset.type !== 'image') return { success: false, error: 'Only image assets can be studied' };

  const result = await analyzeImageUrl({ imageUrl: asset.url, generateAIVision, store });
  if (!result.success) return result;

  const analysis = result.analysis;
  const labels = buildLabels(analysis);
  const updated = {
    ...asset,
    imageAnalysis: analysis,
    tags: [...new Set([...(asset.tags || []), ...labels, 'studied'])],
    updatedAt: new Date().toISOString(),
  };
  const idx = lib.findIndex((a) => a.id === assetId);
  lib[idx] = updated;
  const activeId = store.getItem('activeCampaignId') || 'default';
  store.setItem(`contentLibrary_${activeId}`, JSON.stringify(lib));

  return { success: true, asset: updated, analysis };
}

function saveTemplateFromAsset({ store, assetId, analysis }) {
  const { getLibrary } = require('./contentLibraryIpc');
  const lib = getLibrary(store);
  const asset = lib.find((a) => a.id === assetId);
  if (!asset) return { success: false, error: 'Asset not found' };
  const resolvedAnalysis = analysis || asset.imageAnalysis;
  if (!resolvedAnalysis) return { success: false, error: 'Analyze the image first' };

  const template = analysisToFormatTemplate(asset, resolvedAnalysis);
  const templates = getFormatTemplates(store);
  templates.unshift(template);
  saveFormatTemplates(store, templates.slice(0, 100));

  const idx = lib.findIndex((a) => a.id === assetId);
  lib[idx] = { ...asset, formatTemplateId: template.id, updatedAt: new Date().toISOString() };
  const activeId = store.getItem('activeCampaignId') || 'default';
  store.setItem(`contentLibrary_${activeId}`, JSON.stringify(lib));

  return { success: true, template };
}

async function recreateFromFormatTemplate({
  store, generateAI, generateImage, templateId, keyword, generateNewImage = true,
}) {
  const templates = getFormatTemplates(store);
  const template = templates.find((t) => t.id === templateId);
  if (!template) return { success: false, error: 'Format template not found' };

  const topic = String(keyword || template.keywords?.[0] || 'brand update').trim();
  const brandName = getBrandName(store);
  const formatDesc = template.recreationPrompt || template.analysis?.recreationPrompt || template.label;

  let caption = '';
  if (generateAI) {
    caption = await generateAI(
      `Write a social post caption for ${brandName || 'the brand'} about: ${topic}.
Match this visual format psychology: ${template.analysis?.psychology?.engagementStyle || 'engaging'}.
Category: ${template.category}. Triggers: ${(template.analysis?.psychology?.emotionalTriggers || []).join(', ')}.
Include 3 hashtags.`,
    );
  } else {
    caption = topic;
  }

  let imageUrl = template.sourceImageUrl;
  if (generateNewImage && generateImage) {
    const imgPrompt = `${formatDesc}. Topic: ${topic}. Brand: ${brandName}. Same visual format and layout style as reference. Professional social media graphic.`;
    const imgRes = await generateImage(imgPrompt);
    if (imgRes?.imageUrl) imageUrl = imgRes.imageUrl;
  }

  const fields = {
    headline: topic,
    body: String(caption).split('\n')[0],
    image: imageUrl,
    cta: template.designSlots?.cta || '',
    quote: template.designSlots?.quote || topic,
  };

  return {
    success: true,
    post: {
      id: `fmtrec_${Date.now()}`,
      type: 'image',
      templateId: template.id,
      formatTemplateId: template.id,
      headline: topic,
      content: String(caption).trim(),
      mediaUrl: imageUrl,
      hasMedia: !!imageUrl,
      fields,
      keywords: topic,
      category: template.category,
      labels: template.labels,
      status: 'draft',
    },
    template,
  };
}

function resolveSchedulerKeywords(store, campaign, settings) {
  let keywords = (settings.formatKeywords || [])
    .map((k) => String(k).trim())
    .filter(Boolean);
  const source = settings.formatKeywordSource || 'both';
  if (source === 'brand-keywords' || source === 'both') {
    const campaignId = store.getItem('activeCampaignId') || 'default';
    try {
      const brandKw = JSON.parse(store.getItem('keywords') || '[]')
        .filter((k) => k.campaignId === campaignId)
        .map((k) => k.keyword || k.text || k.name)
        .filter(Boolean);
      keywords = [...keywords, ...brandKw];
    } catch (e) { /* noop */ }
  }
  if (!keywords.length) keywords = [campaign?.brandName || 'brand update'];
  return [...new Set(keywords)];
}

async function runFormatIntelligenceScheduler({
  store, generateAI, generateImage, campaign, settings, publishFn, queueContentFn,
}) {
  if (!settings.formatIntelligenceEnabled) {
    return { processed: 0, skipped: true, reason: 'Format intelligence disabled' };
  }

  const allTemplates = getFormatTemplates(store);
  const selectedIds = settings.formatTemplateIds || [];
  const templates = selectedIds.length
    ? allTemplates.filter((t) => selectedIds.includes(t.id))
    : allTemplates;
  if (!templates.length) {
    return { processed: 0, skipped: true, reason: 'No saved format templates — study images in Content Library' };
  }

  const keywords = resolveSchedulerKeywords(store, campaign, settings);
  const postsPerRun = Math.max(1, Math.min(settings.formatPostsPerRun || 1, 5));
  let rotateIdx = parseInt(store.getItem('formatIntelligenceRotateIdx') || '0', 10);
  const results = [];
  let processed = 0;

  for (let i = 0; i < postsPerRun; i++) {
    const template = templates[rotateIdx % templates.length];
    const keyword = keywords[(rotateIdx + i) % keywords.length];
    rotateIdx += 1;

    try {
      const recreated = await recreateFromFormatTemplate({
        store,
        generateAI,
        generateImage,
        templateId: template.id,
        keyword,
        generateNewImage: settings.formatGenerateImages !== false,
      });
      if (!recreated.success || !recreated.post) continue;

      for (const platform of (settings.targetPlatforms || ['Facebook'])) {
        const curated = {
          title: recreated.post.headline || template.label,
          content: recreated.post.content,
          mediaUrl: recreated.post.mediaUrl,
          platform,
          source: 'format-intelligence',
          formatTemplateId: template.id,
          category: template.category,
          keywords: keyword,
          curatedFor: campaign?.brandName || 'brand',
        };

        if (settings.publishMode === 'auto' && publishFn) {
          await publishFn(curated, settings.targetAccountIds || []);
          results.push({ action: 'published', platform, template: template.label, keyword });
        } else if (queueContentFn) {
          queueContentFn(store, curated);
          results.push({ action: 'queued', platform, template: template.label, keyword });
        }
        processed += 1;
      }
    } catch (e) {
      console.error('Format intelligence scheduler error:', e.message);
    }
  }

  store.setItem('formatIntelligenceRotateIdx', String(rotateIdx));
  store.setItem('formatIntelligenceLastRun', String(Date.now()));
  return { processed, results, templatesUsed: templates.length, keywordsUsed: keywords.length };
}

module.exports = {
  CATEGORIES,
  getFormatTemplates,
  saveFormatTemplates,
  getImageDimensions,
  analyzeImageUrl,
  analyzeLibraryAsset,
  saveTemplateFromAsset,
  recreateFromFormatTemplate,
  analysisToFormatTemplate,
  buildLabels,
  resolveSchedulerKeywords,
  runFormatIntelligenceScheduler,
};