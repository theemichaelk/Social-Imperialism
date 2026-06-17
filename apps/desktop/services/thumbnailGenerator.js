/**
 * Viral thumbnail generation across multiple image AI providers.
 */
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { downloadImageToTemp } = require('./mediaHelpers');

const THUMBNAIL_MODELS = [
  { id: 'fal-flux-pro', label: 'FLUX Pro (FAL) — highest quality', provider: 'fal', endpoint: 'fal-ai/flux-pro/v1.1', requiresKey: 'falKey' },
  { id: 'fal-flux-dev', label: 'FLUX Dev (FAL) — fast & sharp', provider: 'fal', endpoint: 'fal-ai/flux/dev', requiresKey: 'falKey' },
  { id: 'fal-fast-sdxl', label: 'Fast SDXL (FAL) — quick drafts', provider: 'fal', endpoint: 'fal-ai/fast-sdxl', requiresKey: 'falKey', extra: { num_inference_steps: 4 } },
  { id: 'fal-recraft', label: 'Recraft V3 (FAL) — bold vector style', provider: 'fal', endpoint: 'fal-ai/recraft-v3', requiresKey: 'falKey' },
  { id: 'grok-imagine', label: 'Grok Imagine (browser session)', provider: 'grok', requiresKey: 'grokSession' },
  { id: 'advanced-workflow', label: 'Advanced Workflow (Gooey)', provider: 'workflow', requiresKey: 'advancedWorkflowKey' },
];

const THUMBNAIL_STYLES = [
  { id: 'viral-youtube', label: 'YouTube Viral', prompt: 'high-contrast YouTube thumbnail, shocked expressive face or bold subject, large readable text area, saturated colors, click-worthy composition' },
  { id: 'mrbeast', label: 'MrBeast Energy', prompt: 'explosive MrBeast-style thumbnail, neon accents, arrows and circles highlighting subject, extreme energy, meme-tier contrast' },
  { id: 'tiktok-hook', label: 'TikTok / Shorts Hook', prompt: 'vertical short-form hook frame, trendy aesthetic, bold hook text zone, motion-blur energy, Gen-Z viral look' },
  { id: 'minimal-clean', label: 'Minimal Premium', prompt: 'clean premium thumbnail, single focal subject, elegant typography zone, soft gradient background, high-end brand feel' },
  { id: 'gaming', label: 'Gaming / Stream', prompt: 'gaming stream thumbnail, RGB glow, action scene, HUD-style accents, competitive energy' },
  { id: 'podcast', label: 'Podcast Cover', prompt: 'podcast cover art thumbnail, host portrait space, episode title zone, professional studio lighting' },
  { id: 'news-breaking', label: 'Breaking News', prompt: 'breaking news thumbnail, urgent red accents, headline strip, documentary realism, high credibility' },
];

const THUMBNAIL_RATIOS = [
  { id: '16:9', label: 'YouTube / Landscape (16:9)', falSize: 'landscape_16_9', width: 1280, height: 720 },
  { id: '9:16', label: 'Shorts / Reels (9:16)', falSize: 'portrait_16_9', width: 1080, height: 1920 },
  { id: '1:1', label: 'Square (1:1)', falSize: 'square_hd', width: 1080, height: 1080 },
];

const COPY_MODELS = [
  { id: 'gemini', label: 'Gemini headline copy' },
  { id: 'openai/gpt-4o', label: 'GPT-4o headline copy' },
  { id: 'grok-browser', label: 'Grok headline copy' },
];

function parseKeys(store) {
  let keys = {};
  const raw = store.getItem('globalApiKeys');
  if (raw) {
    try { keys = JSON.parse(raw); } catch (e) { /* ignore */ }
  }
  return {
    falKey: keys.falKey || process.env.FAL_KEY || null,
    advancedWorkflowKey: keys.advancedWorkflowKey || process.env.ADVANCED_WORKFLOW_KEY || null,
    keys,
  };
}

function resolveFalSize(ratioId) {
  return THUMBNAIL_RATIOS.find((r) => r.id === ratioId)?.falSize || 'landscape_16_9';
}

function buildViralPrompt({ topic, styleId, ratioId, headline, brandName }) {
  const style = THUMBNAIL_STYLES.find((s) => s.id === styleId) || THUMBNAIL_STYLES[0];
  const ratio = THUMBNAIL_RATIOS.find((r) => r.id === ratioId) || THUMBNAIL_RATIOS[0];
  const brand = brandName ? `Brand: ${brandName}. ` : '';
  const textOverlay = headline
    ? `Bold overlay text (readable at small size): "${headline}". `
    : 'Leave clear space for bold overlay headline text. ';
  return `${brand}Viral social thumbnail ${ratio.label}. ${style.prompt}. Topic: ${topic}. ${textOverlay}Ultra sharp, no watermark, no blurry text, professional CTR-optimized design.`;
}

async function craftHeadline(generateAIWithModel, topic, copyModel = 'gemini') {
  if (!generateAIWithModel || !topic?.trim()) return '';
  const prompt = `Write ONE viral thumbnail headline (max 6 words, ALL CAPS optional for 1-2 words) for: "${topic}". Return ONLY the headline text, no quotes.`;
  try {
    const res = await generateAIWithModel(prompt, copyModel);
    return String(res?.text || res || '').trim().replace(/^["']|["']$/g, '').slice(0, 60);
  } catch (e) {
    return '';
  }
}

async function generateWithFal({ endpoint, prompt, ratioId, falKey, extra = {} }) {
  const image_size = resolveFalSize(ratioId);
  const body = {
    prompt,
    num_images: 1,
    image_size,
    ...extra,
  };
  const response = await axios.post(`https://fal.run/${endpoint}`, body, {
    headers: { Authorization: `Key ${falKey}`, 'Content-Type': 'application/json' },
    timeout: 120000,
  });
  const url = response.data?.images?.[0]?.url || response.data?.images?.[0];
  if (!url) throw new Error('No image returned from FAL');
  return { imageUrl: typeof url === 'string' ? url : url.url, provider: 'fal', model: endpoint };
}

async function generateWithWorkflow(runAdvancedWorkflow, prompt, ratioId) {
  const ratio = THUMBNAIL_RATIOS.find((r) => r.id === ratioId) || THUMBNAIL_RATIOS[0];
  const sizeMap = { '16:9': '1280x720', '9:16': '1080x1920', '1:1': '1024x1024' };
  const wfRes = await runAdvancedWorkflow('text2image', {
    text_prompt: prompt,
    num_images: 1,
    image_size: sizeMap[ratio.id] || '1280x720',
  });
  if (!wfRes.success) throw new Error(wfRes.error || 'Advanced workflow failed');
  const img = wfRes.output?.images?.[0];
  const imageUrl = img?.url || img;
  if (!imageUrl) throw new Error('No image from advanced workflow');
  return { imageUrl, provider: 'workflow' };
}

async function generateWithGrok(generateGrokImagine, prompt) {
  const res = await generateGrokImagine(prompt);
  if (!res?.success && !res?.primaryAsset) {
    throw new Error(res?.error || 'Grok Imagine failed');
  }
  const asset = res.primaryAsset || res.imageAsset || res.assets?.[0];
  if (asset?.path) return { imageUrl: asset.path, localPath: asset.path, provider: 'grok', isVideo: asset.type === 'video' };
  if (asset?.url) return { imageUrl: asset.url, provider: 'grok', isVideo: asset.type === 'video' };
  throw new Error('Grok returned no image asset');
}

async function persistThumbnail(userDataPath, imageUrl, prefix = 'viral_thumb') {
  const dir = path.join(userDataPath, 'thumbnails');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const localPath = imageUrl.startsWith('http')
    ? await downloadImageToTemp(imageUrl, prefix)
    : imageUrl;
  const ext = path.extname(localPath) || '.jpg';
  const dest = path.join(dir, `${prefix}_${Date.now()}${ext}`);
  if (localPath !== dest) fs.copyFileSync(localPath, dest);
  return dest;
}

async function generateViralThumbnail(deps, payload = {}) {
  const {
    store,
    userDataPath,
    generateAIWithModel,
    generateGrokImagine,
    runAdvancedWorkflow,
  } = deps;

  const topic = String(payload.topic || payload.prompt || '').trim();
  if (!topic) throw new Error('Enter a topic or video title for the thumbnail.');

  const modelId = payload.model || 'fal-flux-pro';
  const styleId = payload.style || 'viral-youtube';
  const ratioId = payload.ratio || '16:9';
  const modelDef = THUMBNAIL_MODELS.find((m) => m.id === modelId) || THUMBNAIL_MODELS[0];
  const { falKey, advancedWorkflowKey } = parseKeys(store);

  let headline = String(payload.headline || '').trim();
  if (payload.autoHeadline && !headline && generateAIWithModel) {
    headline = await craftHeadline(generateAIWithModel, topic, payload.copyModel || 'gemini');
  }

  let brandName = payload.brandName || '';
  if (!brandName && store) {
    try {
      const camps = JSON.parse(store.getItem('campaigns') || '[]');
      const activeId = store.getItem('activeCampaignId');
      const camp = camps.find((c) => c.id === activeId);
      brandName = camp?.brandName || '';
    } catch (e) { /* ignore */ }
  }

  const prompt = buildViralPrompt({ topic, styleId, ratioId, headline, brandName });
  let result;

  if (modelDef.provider === 'fal') {
    if (!falKey) throw new Error('Add FAL API key in Settings → FAL AI API Key.');
    result = await generateWithFal({
      endpoint: modelDef.endpoint,
      prompt,
      ratioId,
      falKey,
      extra: modelDef.extra || {},
    });
  } else if (modelDef.provider === 'grok') {
    if (!generateGrokImagine) throw new Error('Grok Imagine not available.');
    result = await generateWithGrok(generateGrokImagine, prompt);
  } else if (modelDef.provider === 'workflow') {
    if (!advancedWorkflowKey || !runAdvancedWorkflow) {
      throw new Error('Add Advanced Workflow key in Settings.');
    }
    result = await generateWithWorkflow(runAdvancedWorkflow, prompt, ratioId);
  } else {
    throw new Error(`Unknown thumbnail model: ${modelId}`);
  }

  let savedPath = null;
  if (payload.saveLocal !== false && userDataPath && result.imageUrl) {
    try {
      savedPath = await persistThumbnail(userDataPath, result.imageUrl);
    } catch (e) {
      console.warn('Thumbnail save failed:', e.message);
    }
  }

  return {
    success: true,
    imageUrl: result.imageUrl,
    localPath: savedPath || result.localPath || null,
    headline,
    prompt,
    model: modelId,
    style: styleId,
    ratio: ratioId,
    provider: result.provider,
    isVideo: !!result.isVideo,
  };
}

async function generateThumbnailBatch(deps, payload = {}) {
  const count = Math.min(4, Math.max(1, parseInt(payload.variants, 10) || 1));
  const results = [];
  const errors = [];
  for (let i = 0; i < count; i += 1) {
    try {
      const item = await generateViralThumbnail(deps, {
        ...payload,
        autoHeadline: payload.autoHeadline && !payload.headline,
      });
      results.push({ ...item, variant: i + 1 });
    } catch (e) {
      errors.push(e.message);
    }
  }
  if (!results.length) {
    return { success: false, error: errors[0] || 'All variants failed' };
  }
  return { success: true, results, count: results.length, errors };
}

module.exports = {
  THUMBNAIL_MODELS,
  THUMBNAIL_STYLES,
  THUMBNAIL_RATIOS,
  COPY_MODELS,
  buildViralPrompt,
  generateViralThumbnail,
  generateThumbnailBatch,
  persistThumbnail,
};