/**
 * Quantum Pages SEO — sequential multi-prompt article pipeline.
 */
const axios = require('axios');
const {
  PIPELINE_ORDER,
  CONTENT_AI_IMAGES,
  getStepById,
  getPipelineSteps,
} = require('./quantumPagesPrompts');

const JOBS_KEY = 'quantumPagesJobs';

function buildBusinessDetails(campaign = {}) {
  const colors = campaign.brandColors
    || campaign.websiteBrandColors
    || '#38bdf8, #0f172a, #10b981, #f8fafc';
  return [
    `Brand Name: ${campaign.brandName || 'Your Brand'}`,
    `Website / Domain: ${campaign.domain || ''}`,
    `Description: ${campaign.description || ''}`,
    `Tone of Voice: ${campaign.tone || 'professional and helpful'}`,
    `Target Audience: ${campaign.audience || 'general readers'}`,
    `Affiliate Links / USPs: ${campaign.affiliateLinks || ''}`,
    `Example Style: ${campaign.examplePosts || ''}`,
    `Primary Link: ${campaign.primaryLink || campaign.domain || ''}`,
    `Website Brand Colors: ${colors}`,
  ].join('\n');
}

function interpolate(template, vars) {
  if (!template) return '';
  let out = String(template);
  Object.entries(vars).forEach(([key, val]) => {
    const safe = val == null ? '' : String(val);
    out = out.split(`{!${key}}`).join(safe);
    out = out.split(`{!output-${key}}`).join(safe);
  });
  out = out.replace(/\{!output-(\d+)\}/g, (_, n) => vars[`output-${n}`] ?? vars[n] ?? '');
  out = out.replace(/\{!output-AuthLinks\}/g, vars['output-AuthLinks'] ?? vars.AuthLinks ?? '');
  out = out.replace(/!number_of_images/g, String(vars.number_of_images ?? 2));
  return out;
}

async function fetchSerpContext(keyword, serpApiKey) {
  if (!serpApiKey || !keyword?.trim()) return '';
  try {
    const res = await axios.get('https://serpapi.com/search.json', {
      params: { engine: 'google', q: keyword, api_key: serpApiKey, num: 10 },
      timeout: 25000,
    });
    const results = (res.data?.organic_results || []).slice(0, 10);
    if (!results.length) return '';
    const lines = results.map((r, i) => `${i + 1}. ${r.title || ''}\n   URL: ${r.link || ''}\n   Snippet: ${r.snippet || ''}`);
    return `\n\nLIVE GOOGLE SEARCH RESULTS FOR "${keyword}":\n${lines.join('\n')}`;
  } catch (e) {
    console.error('Quantum Pages SerpAPI:', e.message);
    return '';
  }
}

async function callWorkflowAI({
  openrouterKey,
  system,
  user,
  model,
  maxTokens = 4000,
  temperature = 0.8,
}) {
  if (!openrouterKey) throw new Error('OpenRouter API key required. Add it in Settings > API Integrations.');
  const messages = [];
  if (system?.trim()) messages.push({ role: 'system', content: system.trim() });
  messages.push({ role: 'user', content: user });
  const res = await axios.post('https://openrouter.ai/api/v1/chat/completions', {
    model,
    messages,
    max_tokens: maxTokens,
    temperature,
  }, {
    headers: {
      Authorization: `Bearer ${openrouterKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://socialimperialism.local',
      'X-Title': 'Social Imperialism Quantum Pages',
    },
    timeout: 180000,
  });
  const text = res.data?.choices?.[0]?.message?.content;
  if (!text) throw new Error(`Empty response from ${model}`);
  return text.trim();
}

function loadJobs(store) {
  try { return JSON.parse(store.getItem(JOBS_KEY) || '[]'); } catch (e) { return []; }
}

function saveJob(store, job) {
  const jobs = loadJobs(store).filter((j) => j.id !== job.id);
  jobs.unshift(job);
  store.setItem(JOBS_KEY, JSON.stringify(jobs.slice(0, 20)));
}

function getJob(store, jobId) {
  return loadJobs(store).find((j) => j.id === jobId) || null;
}

function buildOutputVars(outputs, keyword, businessDetails, extra = {}) {
  const vars = {
    keyword,
    business_details: businessDetails,
    number_of_images: extra.numberOfImages ?? 2,
    'content-output': extra.contentOutput ?? outputs['19'] ?? '',
    ...extra,
  };
  Object.entries(outputs).forEach(([k, v]) => {
    vars[k] = v;
    vars[`output-${k}`] = v;
  });
  if (outputs.AuthLinks) vars['output-AuthLinks'] = outputs.AuthLinks;
  return vars;
}

async function runStep(step, vars, deps) {
  const system = interpolate(step.system, vars);
  let user = interpolate(step.user, vars);
  if (step.serpGrounding && deps.serpApiKey) {
    user += await fetchSerpContext(vars.keyword, deps.serpApiKey);
  }
  const text = await callWorkflowAI({
    openrouterKey: deps.openrouterKey,
    system,
    user,
    model: step.model,
    maxTokens: step.maxTokens,
    temperature: step.temperature,
  });
  const key = step.outputKey || step.id;
  return { key, text };
}

async function runContentAiImages(content, numberOfImages, deps) {
  const vars = buildOutputVars({}, '', '', {
    contentOutput: content,
    numberOfImages,
  });
  const system = interpolate(CONTENT_AI_IMAGES.system, vars);
  const user = interpolate(CONTENT_AI_IMAGES.userTemplate, vars);
  const raw = await callWorkflowAI({
    openrouterKey: deps.openrouterKey,
    system,
    user,
    model: CONTENT_AI_IMAGES.model,
    maxTokens: CONTENT_AI_IMAGES.maxTokens,
    temperature: CONTENT_AI_IMAGES.temperature,
  });
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('content_ai_images: invalid JSON response');
  const parsed = JSON.parse(jsonMatch[0]);
  if (!parsed.html_output) throw new Error('content_ai_images: missing html_output');
  return parsed;
}

async function runFullPipeline(store, {
  keyword,
  campaign,
  openrouterKey,
  serpApiKey,
  generateImage,
  options = {},
  onProgress,
}) {
  const jobId = `qp_${Date.now()}`;
  const businessDetails = buildBusinessDetails(campaign);
  const outputs = {};
  const steps = PIPELINE_ORDER.map((id) => getStepById(id)).filter(Boolean);
  const total = steps.length + (options.includeInlineImages ? 1 : 0) + (options.generateFeaturedImage ? 1 : 0);

  const job = {
    id: jobId,
    keyword,
    campaignId: campaign?.id,
    status: 'running',
    startedAt: new Date().toISOString(),
    steps: [],
    outputs: {},
    progress: 0,
    error: null,
  };
  saveJob(store, job);

  const deps = { openrouterKey, serpApiKey, generateImage };
  let stepIndex = 0;

  const progress = (label, stepId) => {
    stepIndex += 1;
    const pct = Math.round((stepIndex / total) * 100);
    job.progress = pct;
    job.currentStep = stepId || label;
    if (onProgress) onProgress({ jobId, progress: pct, label, stepId });
  };

  try {
    for (const step of steps) {
      progress(step.label, step.id);
      const vars = buildOutputVars(outputs, keyword, businessDetails);
      const { key, text } = await runStep(step, vars, deps);
      outputs[key] = text;
      job.steps.push({ id: step.id, label: step.label, status: 'done', at: new Date().toISOString() });
      job.outputs = { ...outputs };
      saveJob(store, job);
    }

    let finalHtml = outputs['19'] || '';
    let inlineImages = null;

    if (options.includeInlineImages) {
      progress('Inline image placeholders', 'content_ai_images');
      inlineImages = await runContentAiImages(
        finalHtml,
        options.numberOfImages ?? 2,
        deps,
      );
      finalHtml = inlineImages.html_output || finalHtml;
      outputs.content_ai_images = JSON.stringify(inlineImages);
      job.steps.push({ id: 'content_ai_images', label: 'Inline images', status: 'done' });
    }

    let featuredImageUrl = null;
    if (options.generateFeaturedImage && outputs['17'] && generateImage) {
      progress('Featured image generation', 'featured_image');
      const imgRes = await generateImage(outputs['17']);
      if (imgRes?.success && imgRes.imageUrl) {
        featuredImageUrl = imgRes.imageUrl;
        outputs.featuredImageUrl = featuredImageUrl;
      }
      job.steps.push({ id: 'featured_image', label: 'Featured image', status: featuredImageUrl ? 'done' : 'skipped' });
    }

    const result = {
      title: outputs['16'] || keyword,
      metaTitle: outputs['7'] || '',
      metaDescription: outputs['8'] || '',
      imagePrompt: outputs['17'] || '',
      featuredImageUrl,
      html: finalHtml,
      report: outputs['1'] || '',
      outline: outputs['4'] || outputs['2'] || '',
      entities: outputs['3'] || '',
      authorityLinks: outputs.AuthLinks || '',
      inlineImages,
      outputs,
    };

    job.status = 'completed';
    job.progress = 100;
    job.completedAt = new Date().toISOString();
    job.result = result;
    saveJob(store, job);

    return { success: true, jobId, ...result };
  } catch (e) {
    job.status = 'failed';
    job.error = e.message;
    job.failedAt = new Date().toISOString();
    saveJob(store, job);
    return { success: false, jobId, error: e.message, outputs };
  }
}

function saveToContentQueue(store, article) {
  let queue = [];
  try { queue = JSON.parse(store.getItem('contentReviewQueue') || '[]'); } catch (e) { /* ignore */ }
  const item = {
    id: `qp_article_${Date.now()}`,
    title: article.title || article.keyword,
    content: article.html || '',
    metaTitle: article.metaTitle,
    metaDescription: article.metaDescription,
    featuredImageUrl: article.featuredImageUrl,
    keyword: article.keyword,
    format: 'html',
    source: 'quantum_pages_seo',
    queuedAt: new Date().toISOString(),
    status: 'pending_review',
  };
  queue.unshift(item);
  store.setItem('contentReviewQueue', JSON.stringify(queue.slice(0, 100)));
  return item;
}

module.exports = {
  buildBusinessDetails,
  getPipelineSteps,
  runFullPipeline,
  getJob,
  loadJobs,
  saveToContentQueue,
};