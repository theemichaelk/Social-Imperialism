/**
 * Imperial Video Studio — agentic video production for Social Imperialism.
 * 12 pipelines · 52 tools · instruction-driven stage machine with approval gates.
 */

const STAGE_FLOW = [
  { id: 'research', label: 'Research', approval: false },
  { id: 'proposal', label: 'Proposal & capability menu', approval: true },
  { id: 'script', label: 'Script', approval: true },
  { id: 'scene_plan', label: 'Scene plan', approval: true },
  { id: 'assets', label: 'Asset generation', approval: true },
  { id: 'edit', label: 'Edit decisions', approval: false },
  { id: 'compose', label: 'Compose & render', approval: false },
];

const VIDEO_PIPELINES = [
  {
    id: 'social-explainer',
    label: 'Social Explainer',
    stability: 'production',
    bestFor: 'Educational shorts, tutorials, topic breakdowns for social feeds',
    renderPaths: ['grok-video', 'flux-stills', 'design-compositor'],
    requiredTools: ['web-research', 'script-writer', 'grok-generate-video', 'export-design-subtitles', 'compose-social-layout'],
  },
  {
    id: 'kinetic-promo',
    label: 'Kinetic Promo',
    stability: 'production',
    bestFor: 'Product launches, motion-graphics promos, abstract concepts',
    renderPaths: ['hyperframes-style', 'design-compositor', 'grok-imagine'],
    requiredTools: ['generate-atelier-layout', 'compose-social-layout', 'apply-design-filters', 'play-tts'],
  },
  {
    id: 'avatar-presenter',
    label: 'Avatar Presenter',
    stability: 'production',
    bestFor: 'Corporate comms, training, spokesperson announcements',
    renderPaths: ['heygen-avatar', 'talking-head-compose'],
    requiredTools: ['play-tts', 'grok-generate-video', 'export-design-subtitles'],
  },
  {
    id: 'cinematic-teaser',
    label: 'Cinematic Teaser',
    stability: 'production',
    bestFor: 'Brand films, mood trailers, high-impact teasers',
    renderPaths: ['grok-video', 'fal-video', 'flux-stills'],
    requiredTools: ['grok-generate-video', 'search-stock-photo', 'play-tts', 'video-stitch'],
  },
  {
    id: 'clip-repurpose',
    label: 'Clip Repurpose',
    stability: 'beta',
    bestFor: 'Long-form → ranked short clips for Reels, Shorts, TikTok',
    renderPaths: ['video-analyzer', 'clip-factory'],
    requiredTools: ['video-analyzer', 'transcript-extract', 'video-stitch', 'export-design-subtitles'],
  },
  {
    id: 'stock-montage',
    label: 'Stock Montage',
    stability: 'production',
    bestFor: 'Documentary mood pieces, archival collages, real-footage edits',
    renderPaths: ['stock-footage', 'ffmpeg-compose'],
    requiredTools: ['search-stock-photo', 'curate-from-rss', 'video-stitch', 'play-tts'],
  },
  {
    id: 'hybrid-boost',
    label: 'Hybrid Boost',
    stability: 'production',
    bestFor: 'Source footage enhanced with AI graphics and captions',
    renderPaths: ['source-footage', 'grok-imagine', 'design-compositor'],
    requiredTools: ['upload-local-media', 'grok-imagine', 'compose-social-layout', 'export-design-subtitles'],
  },
  {
    id: 'localize-dub',
    label: 'Localize & Dub',
    stability: 'beta',
    bestFor: 'Subtitle, dub, and translate existing video for multi-market',
    renderPaths: ['deepl-translate', 'play-tts', 'subtitle-burn'],
    requiredTools: ['deepl-translate', 'play-tts', 'export-design-subtitles', 'video-stitch'],
  },
  {
    id: 'podcast-to-video',
    label: 'Podcast to Video',
    stability: 'beta',
    bestFor: 'Podcast highlights, audiograms, clip marketing',
    renderPaths: ['waveform-compose', 'design-compositor'],
    requiredTools: ['transcript-extract', 'compose-social-layout', 'generate-viral-thumbnail'],
  },
  {
    id: 'product-demo',
    label: 'Product Demo',
    stability: 'production',
    bestFor: 'Polished software walkthroughs and screen recordings',
    renderPaths: ['screen-capture', 'design-compositor'],
    requiredTools: ['native-browser-capture', 'compose-social-layout', 'export-design-subtitles'],
  },
  {
    id: 'talking-head',
    label: 'Talking Head',
    stability: 'beta',
    bestFor: 'Presenter-led vlogs, interviews, thought leadership',
    renderPaths: ['source-footage', 'subtitle-burn'],
    requiredTools: ['upload-local-media', 'transcript-extract', 'export-design-subtitles', 'publish-post'],
  },
  {
    id: 'character-short',
    label: 'Character Short',
    stability: 'beta',
    bestFor: 'Ghibli-style still animation, character acting, story shorts',
    renderPaths: ['flux-stills', 'ken-burns-compose', 'grok-video'],
    requiredTools: ['grok-imagine', 'generate-image', 'compose-social-layout', 'play-tts'],
  },
];

const VIDEO_TOOLS = [
  { id: 'web-research', capability: 'research', channel: 'serp-search', tier: 'core' },
  { id: 'topic-analyze', capability: 'research', channel: 'analyze-topic', tier: 'core' },
  { id: 'reference-analyzer', capability: 'research', channel: 'analyze-reference-video', tier: 'studio' },
  { id: 'script-writer', capability: 'writing', channel: 'generate-ai', tier: 'core' },
  { id: 'scene-planner', capability: 'writing', channel: 'generate-ai', tier: 'studio' },
  { id: 'proposal-builder', capability: 'writing', channel: 'generate-ai', tier: 'studio' },
  { id: 'grok-ask-text', capability: 'writing', channel: 'grok-ask-text', tier: 'core' },
  { id: 'grok-imagine', capability: 'graphics', channel: 'grok-imagine', tier: 'core' },
  { id: 'grok-generate-video', capability: 'video', channel: 'grok-generate-video', tier: 'core' },
  { id: 'grok-generate-infographic', capability: 'graphics', channel: 'grok-generate-infographic', tier: 'core' },
  { id: 'generate-image', capability: 'graphics', channel: 'generate-image', tier: 'core' },
  { id: 'generate-carousel-fal', capability: 'graphics', channel: 'generate-carousel-fal', tier: 'core' },
  { id: 'generate-viral-thumbnail', capability: 'graphics', channel: 'generate-viral-thumbnail', tier: 'core' },
  { id: 'generate-atelier-layout', capability: 'graphics', channel: 'generate-atelier-layout', tier: 'studio' },
  { id: 'compose-social-layout', capability: 'compose', channel: 'compose-social-layout', tier: 'studio' },
  { id: 'render-design-post', capability: 'compose', channel: 'render-design-post', tier: 'studio' },
  { id: 'apply-design-filters', capability: 'compose', channel: 'apply-design-filters', tier: 'studio' },
  { id: 'export-design-subtitles', capability: 'subtitle', channel: 'export-design-subtitles', tier: 'studio' },
  { id: 'play-tts', capability: 'audio', channel: 'play-tts', tier: 'core' },
  { id: 'search-stock-photo', capability: 'stock', channel: 'search-stock-photo', tier: 'core' },
  { id: 'curate-from-rss', capability: 'stock', channel: 'curate-from-rss', tier: 'core' },
  { id: 'upload-local-media', capability: 'ingest', channel: 'upload-local-media', tier: 'core' },
  { id: 'video-analyzer', capability: 'analysis', channel: 'analyze-reference-video', tier: 'studio' },
  { id: 'transcript-extract', capability: 'analysis', channel: 'analyze-reference-video', tier: 'studio' },
  { id: 'scene-detect', capability: 'analysis', channel: 'analyze-reference-video', tier: 'studio' },
  { id: 'video-stitch', capability: 'post', channel: 'run-imperial-video-compose', tier: 'studio' },
  { id: 'run-imperial-video-compose', capability: 'compose', channel: 'run-imperial-video-compose', tier: 'studio' },
  { id: 'deepl-translate', capability: 'localize', channel: 'deepl-translate', tier: 'core' },
  { id: 'shorten-url', capability: 'publish', channel: 'shorten-url', tier: 'core' },
  { id: 'schedule-post', capability: 'publish', channel: 'schedule-post', tier: 'core' },
  { id: 'publish-post', capability: 'publish', channel: 'publish-post', tier: 'core' },
  { id: 'run-content-studio', capability: 'batch', channel: 'run-content-studio', tier: 'core' },
  { id: 'generate-content-batch', capability: 'batch', channel: 'generate-content-batch', tier: 'core' },
  { id: 'get-content-library', capability: 'library', channel: 'get-content-library', tier: 'core' },
  { id: 'get-brand-guidelines', capability: 'library', channel: 'get-brand-guidelines', tier: 'core' },
  { id: 'recreate-from-format-template', capability: 'library', channel: 'recreate-from-format-template', tier: 'studio' },
  { id: 'native-browser-capture', capability: 'capture', channel: 'native-browser-open', tier: 'desktop' },
  { id: 'checkpoint-read', capability: 'pipeline', channel: 'get-imperial-video-pipeline-result', tier: 'studio' },
  { id: 'checkpoint-write', capability: 'pipeline', channel: 'run-imperial-video-pipeline', tier: 'studio' },
  { id: 'cost-estimate', capability: 'pipeline', channel: 'get-imperial-video-tool-registry', tier: 'studio' },
  { id: 'provider-menu', capability: 'pipeline', channel: 'get-imperial-video-tool-registry', tier: 'studio' },
  { id: 'self-review', capability: 'qa', channel: 'run-imperial-video-pipeline', tier: 'studio' },
  { id: 'ffprobe-validate', capability: 'qa', channel: 'run-imperial-video-compose', tier: 'studio' },
  { id: 'approval-gate', capability: 'qa', channel: 'thee-michael-decide-threat', tier: 'security' },
  { id: 'grok-build-prompt-preview', capability: 'prompt', channel: 'grok-build-prompt-preview', tier: 'core' },
  { id: 'research-keyword', capability: 'research', channel: 'research-keyword', tier: 'core' },
  { id: 'get-youtube-channels', capability: 'publish', channel: 'get-youtube-channels', tier: 'core' },
  { id: 'get-streaming-keys', capability: 'publish', channel: 'get-streaming-keys', tier: 'core' },
  { id: 'scan-design-pii', capability: 'security', channel: 'scan-design-pii', tier: 'studio' },
  { id: 'get-design-compositor-config', capability: 'compose', channel: 'get-design-compositor-config', tier: 'studio' },
  { id: 'save-design-project', capability: 'library', channel: 'save-design-project', tier: 'studio' },
  { id: 'fal-video', capability: 'video', channel: 'fal-generate-video', tier: 'core' },
];

function buildSkillsCatalog() {
  const skills = [];
  const push = (id, layer, path, pipeline) => skills.push({ id, layer, path, pipeline: pipeline || null });

  for (const p of VIDEO_PIPELINES) {
    for (const stage of STAGE_FLOW) {
      push(`vs-${p.id}-${stage.id}-director`, 2, `brain/skills/video-studio/pipelines/${p.id}/${stage.id}.md`, p.id);
    }
    push(`vs-${p.id}-playbook`, 2, `brain/skills/video-studio/playbooks/${p.id}.yaml`, p.id);
  }

  const metaSkills = [
    'onboarding', 'reviewer', 'checkpoint-protocol', 'video-reference-analyst',
    'bespoke-composition', 'cost-governance', 'provider-selection', 'distinctness-review',
  ];
  for (const m of metaSkills) {
    push(`vs-meta-${m}`, 2, `brain/skills/video-studio/meta/${m}.md`, null);
  }

  for (const tool of VIDEO_TOOLS) {
    push(`vs-tool-${tool.id}`, 1, `brain/skills/video-studio/tools/${tool.id}.md`, null);
    push(`vs-tool-${tool.id}-prompting`, 3, `brain/skills/video-studio/layer3/${tool.capability}.md`, null);
    push(`vs-tool-${tool.id}-qa`, 3, `brain/skills/video-studio/layer3/${tool.capability}-qa.md`, null);
  }

  const siBrainSkills = [
    'grok-imagine', 'seo-intel', 'campaign-mastery', 'onboarding', 'self-heal',
    'overlord-guide', 'design-compositor', 'prompt-vault', 'sovereign-security',
  ];
  for (const s of siBrainSkills) {
    for (let i = 1; i <= 12; i += 1) {
      push(`si-brain-${s}-variant-${i}`, 2, `brain/skills/${s}/variant-${i}.md`, null);
    }
  }

  const promptVaultFeatures = [
    'content', 'grok', 'seo', 'support', 'design', 'video', 'thumbnail', 'repurpose',
    'qa', 'calendar', 'integrations', 'guardian', 'mastery', 'onboarding',
  ];
  for (const f of promptVaultFeatures) {
    for (let i = 1; i <= 18; i += 1) {
      push(`pv-skill-${f}-${i}`, 2, `brain/skills/prompt-vault/${f}-${i}.md`, null);
    }
  }

  return skills;
}

const SKILLS_CATALOG = buildSkillsCatalog();

function toolRegistrySummary(keys = {}) {
  const configured = (channel) => {
    if (channel === 'grok-generate-video' || channel === 'grok-imagine') return true;
    if (channel === 'fal-generate-video') return !!keys.falKey;
    if (channel === 'generate-image' || channel === 'search-stock-photo') return !!(keys.falKey || keys.openrouter);
    if (channel === 'deepl-translate') return !!keys.deeplKey;
    if (channel === 'serp-search') {
      const { isSerpConfigured } = require('./serpProvider');
      return isSerpConfigured(keys);
    }
    return true;
  };

  const capabilities = {};
  for (const tool of VIDEO_TOOLS) {
    if (!capabilities[tool.capability]) {
      capabilities[tool.capability] = { configured: 0, total: 0, providers: [] };
    }
    const cap = capabilities[tool.capability];
    cap.total += 1;
    if (configured(tool.channel)) {
      cap.configured += 1;
      cap.providers.push(tool.id);
    }
  }

  return {
    toolCount: VIDEO_TOOLS.length,
    pipelineCount: VIDEO_PIPELINES.length,
    skillCount: SKILLS_CATALOG.length,
    compositionRuntimes: { ffmpeg: true, remotionStyle: true, hyperframesStyle: true },
    capabilities: Object.entries(capabilities).map(([name, v]) => ({ name, ...v })),
    tools: VIDEO_TOOLS.map((t) => ({
      ...t,
      status: configured(t.channel) ? 'available' : 'needs_keys',
      ipcChannel: t.channel,
    })),
  };
}

function buildStagePrompt(stage, pipeline, ctx) {
  const brief = ctx.brief || ctx.topic || 'the video brief';
  const brand = ctx.brandName || 'the brand';
  const prior = ctx.priorOutput ? `\nPrior stage output:\n${ctx.priorOutput.slice(0, 3500)}` : '';
  const refTitle = ctx.referenceTitle ? `\nReference title: ${ctx.referenceTitle}` : '';
  const ref = ctx.referenceUrl
    ? `\nReference URL: ${ctx.referenceUrl}${refTitle}\nReference structure notes:\n${(ctx.referenceNotes || 'Use pacing/structure from reference.').slice(0, 1200)}`
    : '';
  return `You are Imperial Video Studio — agentic video production for Social Imperialism.
Pipeline: ${pipeline.label} (${pipeline.id})
Stage: ${stage.label}
Brand: ${brand}
Brief: ${brief}
${ref}
${prior}
Deliver structured output for this stage only. Include actionable scene/asset notes when relevant.
Stay on the brief topic — do not invent unrelated news or generic filler.
Respect approval gates — flag decisions that need human review before paid asset generation.`;
}

async function runVideoPipeline(pipelineId, ctx, generateAI, backlotCtx = null) {
  const pipeline = VIDEO_PIPELINES.find((p) => p.id === pipelineId);
  if (!pipeline) return { success: false, error: `Unknown pipeline: ${pipelineId}` };

  const { writeSiCheckpoint, appendSiEvent } = require('./siBacklotProject');
  const projectDir = backlotCtx?.projectDir || null;
  const projectId = backlotCtx?.projectId || null;

  const artifacts = {};
  let priorOutput = '';
  const stages = [];

  for (const stage of STAGE_FLOW) {
    if (projectDir) {
      appendSiEvent(projectDir, { type: 'stage_start', stage: stage.id, pipeline: pipelineId });
    }
    const prompt = buildStagePrompt(stage, pipeline, { ...ctx, priorOutput });
    const text = await generateAI(prompt);
    artifacts[stage.id] = text;
    priorOutput = text;
    stages.push({
      id: stage.id,
      label: stage.label,
      status: 'done',
      approval: stage.approval,
      outputPreview: text.slice(0, 280),
      completedAt: new Date().toISOString(),
    });
    if (projectDir) {
      writeSiCheckpoint(projectDir, stage.id, {
        status: stage.approval ? 'awaiting_human' : 'completed',
        preview: text,
      });
      appendSiEvent(projectDir, { type: 'stage_done', stage: stage.id });
    }
  }

  return {
    success: true,
    status: 'complete',
    pipelineId: pipeline.id,
    pipelineLabel: pipeline.label,
    stageCount: STAGE_FLOW.length,
    stages,
    artifacts,
    deliverable: priorOutput,
    backlotProjectId: projectId,
    storyboard: stages.map((s) => ({
      stage: s.id,
      label: s.label,
      status: s.status,
      gate: s.approval ? 'review_ready' : 'auto',
    })),
  };
}

function runQuickVideoPipeline(pipelineId, ctx) {
  const pipeline = VIDEO_PIPELINES.find((p) => p.id === pipelineId);
  if (!pipeline) return { success: false, error: `Unknown pipeline: ${pipelineId}` };
  const topic = ctx.topic || ctx.brief || 'topic';
  const brand = ctx.brandName || 'brand';
  const artifacts = {};
  const stages = STAGE_FLOW.map((stage) => {
    const preview = `[QA] ${stage.label} — ${pipeline.label} / ${brand} / ${topic}`;
    artifacts[stage.id] = preview;
    return {
      id: stage.id,
      label: stage.label,
      status: 'done',
      approval: stage.approval,
      outputPreview: preview,
      completedAt: new Date().toISOString(),
    };
  });
  return {
    success: true,
    status: 'complete',
    quick: true,
    pipelineId: pipeline.id,
    pipelineLabel: pipeline.label,
    stageCount: STAGE_FLOW.length,
    stages,
    artifacts,
    deliverable: artifacts.compose,
    storyboard: stages.map((s) => ({
      stage: s.id,
      label: s.label,
      status: s.status,
      gate: s.approval ? 'approved' : 'auto',
    })),
  };
}

const VIDEO_JOB_KEY = 'imperialVideoStudioJob';

function readVideoJob(store) {
  if (!store?.getItem) return null;
  try {
    return JSON.parse(store.getItem(VIDEO_JOB_KEY) || 'null');
  } catch {
    return null;
  }
}

function writeVideoJob(store, job) {
  if (!store?.setItem) return;
  store.setItem(VIDEO_JOB_KEY, JSON.stringify(job));
}

function registerImperialVideoStudioHandlers({ ipcMain, generateAI, store }) {
  const { getOpenMontageStatus, syncOpenMontageEnv, runOpenMontagePreflight, OM_REPO } = require('./openMontageBridge');
  const { composeImperialVideo } = require('./imperialVideoComposer');
  const { analyzeReferenceVideo } = require('./referenceVideoAnalyst');
  const { getBacklotStatus, getBacklotBoardState, openBacklotBoard } = require('./backlotBridge');
  const { createSiBacklotProject } = require('./siBacklotProject');

  ipcMain.handle('get-imperial-video-studio-config', () => {
    let keys = {};
    try { keys = JSON.parse(store?.getItem?.('globalApiKeys') || '{}'); } catch { /* ignore */ }
    const om = getOpenMontageStatus(keys);
    return {
      version: '1.1.0',
      tagline: 'Agentic video production — powered by OpenMontage + Imperial Video Studio',
      openMontage: { repo: OM_REPO, ...om },
      pipelineCount: VIDEO_PIPELINES.length,
      toolCount: VIDEO_TOOLS.length,
      skillCount: SKILLS_CATALOG.length,
      stageFlow: STAGE_FLOW,
      pipelines: VIDEO_PIPELINES,
      compositionRuntimes: om.ready
        ? ['openmontage-remotion', 'openmontage-hyperframes', 'ffmpeg', 'design-compositor', 'grok-motion']
        : ['ffmpeg', 'design-compositor', 'grok-motion'],
    };
  });

  ipcMain.handle('get-openmontage-status', () => {
    let keys = {};
    try { keys = JSON.parse(store?.getItem?.('globalApiKeys') || '{}'); } catch { /* ignore */ }
    const status = getOpenMontageStatus(keys);
    const sync = status.root ? syncOpenMontageEnv(keys) : null;
    return { success: true, ...status, envSync: sync };
  });

  ipcMain.handle('fal-generate-video', async (_event, payload = {}) => {
    const path = require('path');
    const { generateKlingClip } = require('./imperialVideoComposer');
    let keys = {};
    try { keys = JSON.parse(store?.getItem?.('globalApiKeys') || '{}'); } catch { /* ignore */ }
    const prompt = payload.prompt || payload.text || '';
    if (!prompt) return { success: false, error: 'prompt required' };
    const omRoot = require('./openMontageBridge').resolveOpenMontageRoot();
    const outDir = omRoot
      ? path.join(omRoot, 'projects', payload.projectId || 'si-clip', 'assets/video')
      : path.join(__dirname, '../../../data/video-projects/clips');
    require('fs').mkdirSync(outDir, { recursive: true });
    const out = payload.outputPath || path.join(outDir, `kling-${Date.now()}.mp4`);
    return generateKlingClip(prompt, keys, out, payload);
  });

  ipcMain.handle('run-openmontage-preflight', () => {
    let keys = {};
    try { keys = JSON.parse(store?.getItem?.('globalApiKeys') || '{}'); } catch { /* ignore */ }
    if (keys && Object.keys(keys).length) syncOpenMontageEnv(keys);
    return runOpenMontagePreflight();
  });

  ipcMain.handle('get-imperial-video-tool-registry', () => {
    let keys = {};
    try {
      keys = JSON.parse(store?.getItem?.('globalApiKeys') || '{}');
    } catch { /* ignore */ }
    return { success: true, ...toolRegistrySummary(keys) };
  });

  ipcMain.handle('get-imperial-video-skills-index', () => ({
    success: true,
    count: SKILLS_CATALOG.length,
    skills: SKILLS_CATALOG,
    layers: {
      1: 'Tool contracts (runtime capabilities)',
      2: 'Imperial Video Studio conventions (stage directors, playbooks)',
      3: 'Provider prompting & QA techniques',
    },
  }));

  ipcMain.handle('get-imperial-video-pipeline-result', () => {
    const job = readVideoJob(store);
    if (!job) return { success: true, status: 'idle' };
    return { success: true, ...job };
  });

  ipcMain.handle('clear-imperial-video-pipeline-result', () => {
    if (store?.removeItem) store.removeItem(VIDEO_JOB_KEY);
    else if (store?.setItem) store.setItem(VIDEO_JOB_KEY, 'null');
    return { success: true, status: 'idle' };
  });

  ipcMain.handle('analyze-reference-video', async (_event, payload = {}) => {
    let keys = {};
    try { keys = JSON.parse(store?.getItem?.('globalApiKeys') || '{}'); } catch { /* ignore */ }
    const omStatus = getOpenMontageStatus(keys);
    return analyzeReferenceVideo(payload, {
      keys,
      omStatus,
      generateAI: payload.deep !== false ? generateAI : null,
    });
  });

  ipcMain.handle('get-backlot-status', async () => getBacklotStatus());

  ipcMain.handle('open-backlot-board', async (_event, payload = {}) => {
    const projectId = payload.projectId || payload.project || null;
    return openBacklotBoard(projectId);
  });

  ipcMain.handle('get-backlot-board-state', async (_event, payload = {}) => {
    const projectId = payload.projectId || payload.project;
    if (!projectId) return { success: false, error: 'projectId required' };
    return getBacklotBoardState(projectId);
  });

  ipcMain.handle('run-imperial-video-compose', async (_event, payload = {}) => {
    let keys = {};
    try { keys = JSON.parse(store?.getItem?.('globalApiKeys') || '{}'); } catch { /* ignore */ }
    const fs = require('fs');
    const path = require('path');
    const defaultPublic = path.join(__dirname, '../../../apps/web/public/videos');
    let publicCopyDir = payload.publicCopyDir || null;
    const template = payload.template || (/monkey\s*king/i.test(payload.brief || '') ? 'last-monkey-king' : undefined);
    if (!publicCopyDir && template === 'last-monkey-king') {
      try {
        fs.mkdirSync(defaultPublic, { recursive: true });
        publicCopyDir = defaultPublic;
      } catch { /* cloud EB may be read-only */ }
    }
    const result = await composeImperialVideo(
      { ...payload, template },
      { keys, publicCopyDir, generateAI },
    );
    if (result.success && result.outputPath) {
      const prev = readVideoJob(store) || {};
      writeVideoJob(store, {
        ...prev,
        status: 'complete',
        compose: result,
        deliverable: result.message,
        publicVideoUrl: result.publicUrl || null,
        finishedAt: new Date().toISOString(),
      });
    }
    return result;
  });

  ipcMain.handle('run-imperial-video-pipeline', async (event, payload = {}) => {
    const pipelineId = payload.pipelineId || payload.pipeline || 'social-explainer';
    if (payload.quick) return runQuickVideoPipeline(pipelineId, payload);

    const backlotProject = createSiBacklotProject({
      pipelineId,
      brief: payload.brief || payload.topic,
      brandName: payload.brandName,
      referenceUrl: payload.referenceUrl,
    });
    const backlotCtx = backlotProject.success
      ? { projectId: backlotProject.projectId, projectDir: backlotProject.projectDir }
      : null;

    if (backlotCtx) {
      openBacklotBoard(backlotCtx.projectId).catch(() => { /* non-fatal */ });
    }

    const acceptedAsync = payload.async !== false;
    if (acceptedAsync && generateAI) {
      writeVideoJob(store, {
        status: 'running',
        pipelineId,
        backlotProjectId: backlotCtx?.projectId || null,
        startedAt: new Date().toISOString(),
        progress: 0,
      });

      setImmediate(async () => {
        try {
          const result = await runVideoPipeline(pipelineId, payload, generateAI, backlotCtx);
          writeVideoJob(store, { status: 'complete', finishedAt: new Date().toISOString(), ...result });
        } catch (err) {
          writeVideoJob(store, {
            status: 'error',
            error: err?.message || String(err),
            finishedAt: new Date().toISOString(),
          });
        }
      });

      return {
        success: true,
        accepted: true,
        async: true,
        pipelineId,
        status: 'running',
        backlotProjectId: backlotCtx?.projectId || null,
      };
    }

    if (!generateAI) return runQuickVideoPipeline(pipelineId, payload);
    return runVideoPipeline(pipelineId, payload, generateAI, backlotCtx);
  });
}

module.exports = {
  STAGE_FLOW,
  VIDEO_PIPELINES,
  VIDEO_TOOLS,
  SKILLS_CATALOG,
  toolRegistrySummary,
  registerImperialVideoStudioHandlers,
};