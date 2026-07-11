/**
 * Reference video analyst — OpenMontage-style grounded production plan from a URL or local clip.
 */
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const axios = require('axios');
const { resolveOpenMontageRoot, resolvePythonBin, getOpenMontageStatus } = require('./openMontageBridge');

function extractYouTubeId(url = '') {
  const m = String(url).match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|shorts\/|embed\/))([\w-]{11})/i);
  return m?.[1] || null;
}

async function fetchReferenceMetadata(url = '') {
  const ref = String(url || '').trim();
  if (!ref) return { title: null, author: null, platform: null, durationSec: null };
  const ytId = extractYouTubeId(ref);
  if (ytId) {
    try {
      const oembed = await axios.get('https://www.youtube.com/oembed', {
        params: { url: `https://www.youtube.com/watch?v=${ytId}`, format: 'json' },
        timeout: 8000,
      });
      return {
        title: oembed.data?.title || null,
        author: oembed.data?.author_name || null,
        platform: ref.includes('/shorts/') ? 'shorts' : 'youtube',
        durationSec: null,
      };
    } catch { /* fall through */ }
  }
  if (/tiktok\.com/i.test(ref)) return { title: null, author: null, platform: 'tiktok', durationSec: null };
  if (/instagram\.com/i.test(ref)) return { title: null, author: null, platform: 'instagram', durationSec: null };
  if (/vimeo\.com/i.test(ref)) return { title: null, author: null, platform: 'vimeo', durationSec: null };
  if (/^https?:\/\//i.test(ref)) return { title: null, author: null, platform: 'url', durationSec: null };
  if (fs.existsSync(ref)) return { title: path.basename(ref), author: null, platform: 'local_file', durationSec: null };
  return { title: null, author: null, platform: 'unknown', durationSec: null };
}

function runOpenMontageVideoAnalyzer(source, opts = {}) {
  const omRoot = resolveOpenMontageRoot();
  if (!omRoot) return { success: false, error: 'OpenMontage not cloned' };

  const outDir = path.join(omRoot, 'projects', '_analysis', `ref-${Date.now()}`);
  fs.mkdirSync(outDir, { recursive: true });

  const inputs = {
    source,
    analysis_depth: opts.analysisDepth || 'standard',
    max_keyframes: opts.maxKeyframes || 12,
    output_dir: outDir.replace(/\\/g, '/'),
  };

  const py = resolvePythonBin();
  const script = `
import json
from tools.analysis.video_analyzer import VideoAnalyzer
tool = VideoAnalyzer()
result = tool.execute(${JSON.stringify(inputs)})
print(json.dumps({
  "success": result.success,
  "data": result.data,
  "error": result.error,
  "artifacts": result.artifacts,
  "duration_seconds": result.duration_seconds,
}))
`;
  const res = spawnSync(py, ['-c', script], {
    cwd: omRoot,
    encoding: 'utf8',
    timeout: opts.timeoutMs || 300000,
    maxBuffer: 20 * 1024 * 1024,
  });

  if (res.status !== 0) {
    return {
      success: false,
      error: (res.stderr || res.stdout || 'video_analyzer failed').slice(0, 800),
      outputDir: outDir,
    };
  }

  try {
    const parsed = JSON.parse(String(res.stdout || '').trim().split('\n').pop());
    return { ...parsed, outputDir: outDir };
  } catch (e) {
    return { success: false, error: `Parse error: ${e.message}`, raw: res.stdout?.slice(0, 500) };
  }
}

function buildToolPlan(keys = {}, omStatus = {}) {
  const plan = {};
  const tools = [];

  if (keys.falKey) {
    plan.video_generation = { tool: 'kling_v3_fal', label: 'Kling v3 (fal.ai)', cost_per_unit: 0.30, clip_duration_seconds: 5 };
    plan.image_generation = { tool: 'flux_fal', label: 'FLUX (fal.ai)', cost_per_unit: 0.05 };
    tools.push('fal-generate-video', 'generate-image (fal)');
  } else if (keys.openrouter || keys.gemini) {
    plan.image_generation = { tool: 'openrouter_images', label: 'OpenRouter / Gemini images', cost_per_unit: 0.03 };
    tools.push('generate-image');
  } else {
    plan.image_generation = { tool: 'stock_fallback', label: 'Stock / placeholder stills', cost_per_unit: 0 };
    tools.push('search-stock-photo');
  }

  if (!plan.video_generation) {
    if (omStatus.ffmpeg) {
      plan.motion_fallback = { tool: 'ffmpeg_ken_burns', label: 'Ken Burns slideshow (FFmpeg)', cost_per_unit: 0 };
      tools.push('run-imperial-video-compose (Ken Burns)');
    }
    tools.push('grok-generate-video (desktop)');
  }

  if (keys.elevenlabsKey) {
    plan.tts = { tool: 'elevenlabs', label: 'ElevenLabs TTS', cost_per_word: 0.00003 };
    tools.push('play-tts (ElevenLabs)');
  } else if (keys.heygenKey) {
    plan.tts = { tool: 'heygen_starfish', label: 'HeyGen Starfish TTS', cost_per_word: 0.00002 };
    tools.push('play-tts (HeyGen)');
  } else {
    plan.tts = { tool: 'local_tts', label: 'Local / Windows TTS', cost_per_word: 0 };
    tools.push('play-tts (local)');
  }

  plan.compose = omStatus.remotionComposer
    ? { tool: 'openmontage_remotion', label: 'OpenMontage Remotion compose', cost_per_unit: 0 }
    : { tool: 'ffmpeg_concat', label: 'FFmpeg concat compose', cost_per_unit: 0 };
  tools.push(omStatus.remotionComposer ? 'openmontage-remotion' : 'ffmpeg-compose');

  if (keys.falKey || keys.openrouter) tools.push('export-design-subtitles');

  return { plan, tools: [...new Set(tools)] };
}

function estimateMotionRatio(brief = {}) {
  const scenes = brief.structure_analysis?.scenes || [];
  if (!scenes.length) return { ratio: 0.35, basis: 'Default mix — motion clips for hero beats, stills elsewhere' };
  const motionTypes = scenes.map((s) => s.motion_type).filter(Boolean);
  if (!motionTypes.length) return { ratio: 0.35, basis: 'Structure inferred — moderate motion assumed' };
  const motionCount = motionTypes.filter((t) => t === 'motion_clip').length;
  const stillCount = motionTypes.filter((t) => t === 'animated_still' || t === 'static_image').length;
  const ratio = motionCount / Math.max(1, motionTypes.length);
  return {
    ratio: Math.min(0.9, Math.max(0.1, ratio)),
    basis: `Reference motion: ${motionCount} motion clips, ${stillCount} still/animated-still scenes`,
  };
}

function estimateProductionCost(brief = {}, targetDurationSec = 60, toolPlan = {}) {
  const structure = brief.structure_analysis || {};
  const pacing = structure.pacing_profile || {};
  const refDuration = brief.source?.duration_seconds || 60;
  const refScenes = structure.total_scenes || 8;
  const pacingStyle = pacing.pacing_style || 'steady_educational';
  const cutsPerMin = refDuration > 0 ? refScenes / (refDuration / 60) : 4;
  const minScenes = { rapid_fire: 10, dynamic_social: 8, steady_educational: 5, slow_contemplative: 3, variable: 6 }[pacingStyle] || 5;
  const estimatedScenes = Math.max(minScenes, Math.round(cutsPerMin * (targetDurationSec / 60)));

  const narration = brief.narration_transcript || {};
  const refWords = narration.word_count || 0;
  const wpm = refDuration > 0 && refWords > 0 ? (refWords / refDuration) * 60 : 150;
  const estimatedWords = Math.round(wpm * (targetDurationSec / 60));

  const { ratio: motionRatio, basis: motionBasis } = estimateMotionRatio(brief);
  const motionScenes = Math.max(1, Math.round(estimatedScenes * motionRatio));
  const stillScenes = estimatedScenes - motionScenes;
  const retryMult = 1.3;

  const lineItems = [];
  const assumptions = [
    `${estimatedScenes} scenes (${cutsPerMin.toFixed(1)} cuts/min, pacing: ${pacingStyle})`,
    motionBasis,
    `Target duration: ${targetDurationSec}s`,
  ];

  let totalLow = 0;
  let totalHigh = 0;

  const img = toolPlan.image_generation;
  if (img) {
    const count = Math.round(estimatedScenes * 1.5 * retryMult);
    const unit = img.cost_per_unit || 0;
    const cost = count * unit;
    lineItems.push({ category: 'images', tool: img.label, units: count, unitCostUsd: unit, costUsd: cost });
    totalLow += cost * 0.8;
    totalHigh += cost * 1.2;
  }

  const vid = toolPlan.video_generation;
  if (vid) {
    const clipDur = vid.clip_duration_seconds || 5;
    const clips = Math.max(motionScenes, Math.round((targetDurationSec * motionRatio) / clipDur));
    const count = Math.round(clips * retryMult);
    const unit = vid.cost_per_unit || 0.3;
    const cost = count * unit;
    lineItems.push({ category: 'motion_clips', tool: vid.label, units: count, unitCostUsd: unit, costUsd: cost });
    totalLow += cost * 0.85;
    totalHigh += cost * 1.35;
  }

  const tts = toolPlan.tts;
  if (tts && tts.cost_per_word) {
    const cost = estimatedWords * tts.cost_per_word;
    lineItems.push({ category: 'narration', tool: tts.label, units: estimatedWords, unitCostUsd: tts.cost_per_word, costUsd: cost });
    totalLow += cost;
    totalHigh += cost * 1.1;
  }

  const sampleFraction = 0.2;
  const sampleLow = Math.max(0.05, totalLow * sampleFraction);
  const sampleHigh = Math.max(0.15, totalHigh * sampleFraction);

  return {
    targetDurationSec,
    estimatedScenes,
    estimatedWords,
    motionScenes,
    stillScenes,
    lineItems,
    assumptions,
    totalUsd: { low: +totalLow.toFixed(2), high: +totalHigh.toFixed(2) },
    sampleBeforeFullProductionUsd: { low: +sampleLow.toFixed(2), high: +sampleHigh.toFixed(2) },
  };
}

function buildConceptVariants(topic, analysis = {}, metadata = {}) {
  const refTitle = metadata.title || 'the reference';
  return [
    {
      id: 'direct',
      title: 'Direct adaptation',
      angle: `Same hook cadence and structure as "${refTitle}", retold for: ${topic}`,
    },
    {
      id: 'tone',
      title: 'Tone shift',
      angle: `Slower documentary pacing — stock montage + calmer narration about ${topic}`,
    },
    {
      id: 'burst',
      title: 'Short-form burst',
      angle: `30s vertical cut-down — faster beats, bold captions, ${topic} in punchy hooks`,
    },
  ];
}

function buildKeepsAndChanges(topic, brief = {}, metadata = {}) {
  const pacing = brief.structure_analysis?.pacing_profile?.pacing_style
    || brief.style_profile?.energy
    || 'dynamic social pacing';
  const structure = brief.structure_analysis?.hook_style
    || 'cold open hook → proof beats → payoff → CTA';
  const style = brief.style_profile?.visual_treatment
    || brief.content_analysis?.summary?.slice(0, 120)
    || (metadata.platform === 'shorts' ? 'vertical short-form, bold captions' : 'platform-native captions and kinetic typography');

  return {
    keeps: [
      `Pacing: ${pacing}`,
      `Hook style: ${structure}`,
      `Structure: ${brief.structure_analysis?.total_scenes ? `${brief.structure_analysis.total_scenes}-beat arc` : 'beat-driven arc'} over ~${brief.source?.duration_seconds || 60}s reference`,
      `Tone: ${brief.style_profile?.tone || 'energetic, social-native'}`,
    ],
    changes: [
      `Topic: ${topic}`,
      'Visual treatment: your brand palette and imagery (not the reference subject matter)',
      `Angle: new story about ${topic} — inspired by reference, not a copy`,
      'Narration: your voice / TTS provider with updated script',
    ],
  };
}

function buildSamplePreview({ topic, brief = {}, toolPlan = {}, targetDurationSec = 60 }) {
  const motion = toolPlan.video_generation?.label || toolPlan.motion_fallback?.label || 'Grok motion (desktop)';
  const stills = toolPlan.image_generation?.label || 'stock stills';
  const voice = toolPlan.tts?.label || 'local TTS';
  const compose = toolPlan.compose?.label || 'FFmpeg compose';
  const hook = brief.structure_analysis?.hook_style || 'pattern-interrupt hook in first 3 seconds';
  const scenes = brief.structure_analysis?.total_scenes || 6;

  return [
    `Sample (first ~${Math.min(15, targetDurationSec)}s before full production):`,
    `• Open with ${hook} — on-screen headline about ${topic}`,
    `• Beat 1 visual: ${motion} clip or ${stills} with Ken Burns if motion keys missing`,
    `• Captions: word-level TikTok style if subtitle tools configured`,
    `• Voice: ${voice} narrating the adapted hook (not the reference transcript)`,
    `• Compose path: ${compose} stitching ~${scenes} beats to ${targetDurationSec}s`,
    '• Approval gate stops here — no paid asset batch until you approve the sample plan',
  ].join('\n');
}

function mapBriefToAnalysis(brief = {}, metadata = {}, topic = 'your topic') {
  const structure = brief.structure_analysis || {};
  const pacing = structure.pacing_profile || {};
  const transcript = brief.narration_transcript?.text || brief.narration_transcript?.full_text || '';

  return {
    content: brief.content_analysis?.summary || `Reference about ${metadata.title || 'the source clip'}`,
    style: brief.style_profile?.visual_treatment || pacing.pacing_style || 'social-native kinetic',
    structure: structure.total_scenes
      ? `${structure.total_scenes} scenes · ${pacing.pacing_style || 'steady'} pacing`
      : 'Cold open → problem → proof → payoff → CTA',
    motion: estimateMotionRatio(brief).basis,
    transcript: transcript ? transcript.slice(0, 500) : null,
    keyframeCount: (brief.keyframes || brief.visual_samples || []).length || null,
    whatMakesItWork: [
      structure.hook_style || 'Strong hook in first 3 seconds',
      pacing.avg_shot_duration_sec ? `Avg shot ~${pacing.avg_shot_duration_sec}s` : 'Tight beat cadence',
      brief.style_profile?.caption_style || 'Bold on-screen captions',
    ].filter(Boolean),
  };
}

function analyzeReferenceVideoQuick(payload = {}, metadata = {}) {
  const ref = payload.url || payload.reference || payload.localPath || 'reference media';
  const topic = payload.topic || 'your topic';
  const targetDurationSec = payload.targetDurationSec || payload.durationSec || 60;
  const refTitle = metadata.title || null;

  const pseudoBrief = {
    source: { duration_seconds: metadata.durationSec || (metadata.platform === 'shorts' ? 45 : 60), type: metadata.platform },
    structure_analysis: {
      total_scenes: metadata.platform === 'shorts' ? 10 : 8,
      pacing_profile: { pacing_style: metadata.platform === 'shorts' ? 'dynamic_social' : 'steady_educational' },
      hook_style: 'Cold open pattern-interrupt',
    },
    style_profile: {
      visual_treatment: metadata.platform === 'shorts' ? 'vertical 9:16, bold captions' : '16:9 kinetic typography',
      tone: 'energetic',
    },
    content_analysis: { summary: refTitle ? `"${refTitle}" — structural reference only` : 'Reference video structure' },
  };

  const keys = payload.keys || {};
  const omStatus = payload.omStatus || {};
  const { plan: toolPlan, tools: toolPath } = buildToolPlan(keys, omStatus);
  const { keeps, changes } = buildKeepsAndChanges(topic, pseudoBrief, metadata);
  const costEstimate = estimateProductionCost(pseudoBrief, targetDurationSec, toolPlan);

  return {
    success: true,
    mode: 'quick',
    reference: ref,
    metadata: {
      title: refTitle,
      author: metadata.author || null,
      platform: metadata.platform || null,
    },
    analysis: mapBriefToAnalysis(pseudoBrief, metadata, topic),
    keeps,
    changes,
    concepts: buildConceptVariants(topic, pseudoBrief, metadata),
    toolPath,
    toolPlan,
    costEstimate,
    samplePreview: buildSamplePreview({ topic, brief: pseudoBrief, toolPlan, targetDurationSec }),
    recommendedPipeline: metadata.platform === 'shorts' ? 'social-explainer' : 'kinetic-promo',
    targetDurationSec,
    honestNote: 'Quick structural analysis — run with OpenMontage locally for transcript, scene detection, and keyframes.',
  };
}

async function analyzeReferenceVideo(payload = {}, deps = {}) {
  const source = payload.url || payload.reference || payload.localPath || '';
  const topic = payload.topic || payload.brief || 'your topic';
  const targetDurationSec = payload.targetDurationSec || payload.durationSec || 60;
  const keys = deps.keys || payload.keys || {};
  const omStatus = deps.omStatus || getOpenMontageStatus(keys);

  if (!source.trim()) {
    return { success: false, error: 'Paste a reference URL or local clip path' };
  }

  const metadata = await fetchReferenceMetadata(source);
  let brief = null;
  let analyzerMode = 'quick';

  const omRoot = resolveOpenMontageRoot();
  const canAnalyze = omRoot && omStatus.ffmpeg && (source.startsWith('http') || fs.existsSync(source));

  if (canAnalyze && payload.quick !== true) {
    const analyzed = runOpenMontageVideoAnalyzer(source, {
      analysisDepth: payload.analysisDepth || 'standard',
      maxKeyframes: payload.maxKeyframes || 12,
      timeoutMs: payload.timeoutMs || 300000,
    });
    if (analyzed.success && analyzed.data) {
      brief = analyzed.data;
      analyzerMode = 'openmontage-video_analyzer';
      if (brief.source && !brief.source.duration_seconds && metadata.durationSec) {
        brief.source.duration_seconds = metadata.durationSec;
      }
    }
  }

  if (!brief) {
    const quick = analyzeReferenceVideoQuick({ ...payload, topic, keys, omStatus }, metadata);
    return quick;
  }

  const { plan: toolPlan, tools: toolPath } = buildToolPlan(keys, omStatus);
  const { keeps, changes } = buildKeepsAndChanges(topic, brief, metadata);
  const costEstimate = estimateProductionCost(brief, targetDurationSec, toolPlan);
  const analysis = mapBriefToAnalysis(brief, metadata, topic);
  let concepts = buildConceptVariants(topic, brief, metadata);

  if (payload.deep && deps.generateAI) {
    try {
      const prompt = `You are the OpenMontage video-reference-analyst. Reference: ${source}
Title: ${metadata.title || 'unknown'} | Platform: ${metadata.platform}
User topic: ${topic}
Target duration: ${targetDurationSec}s
Structural brief (JSON excerpt): ${JSON.stringify(brief, null, 2).slice(0, 6000)}

Return JSON only:
{
  "concepts": [{"id":"direct|tone|burst","title":"...","angle":"..."}],
  "recommendedPipeline": "social-explainer|kinetic-promo|character-short|...",
  "whatMakesItWork": ["..."],
  "sampleHook": "one sentence opening hook for ${topic}"
}`;
      const raw = await deps.generateAI(prompt);
      const jsonMatch = String(raw).match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const enriched = JSON.parse(jsonMatch[0]);
        if (enriched.concepts?.length) concepts = enriched.concepts;
        if (enriched.whatMakesItWork?.length) analysis.whatMakesItWork = enriched.whatMakesItWork;
        if (enriched.sampleHook) analysis.sampleHook = enriched.sampleHook;
        if (enriched.recommendedPipeline) analysis.recommendedPipeline = enriched.recommendedPipeline;
      }
    } catch { /* keep deterministic output */ }
  }

  return {
    success: true,
    mode: analyzerMode,
    reference: source,
    metadata: {
      title: metadata.title,
      author: metadata.author,
      platform: metadata.platform,
    },
    analysis,
    keeps,
    changes,
    concepts,
    toolPath,
    toolPlan,
    costEstimate,
    samplePreview: buildSamplePreview({ topic, brief, toolPlan, targetDurationSec }),
    recommendedPipeline: analysis.recommendedPipeline
      || (estimateMotionRatio(brief).ratio > 0.5 ? 'cinematic-teaser' : 'social-explainer'),
    targetDurationSec,
    configuredTools: toolPath,
    agentNote: 'Works with Claude Code, Cursor, Copilot, Windsurf, Codex — any assistant that can read brain/skills/video-studio/ and run OpenMontage tools.',
  };
}

module.exports = {
  extractYouTubeId,
  fetchReferenceMetadata,
  runOpenMontageVideoAnalyzer,
  buildToolPlan,
  estimateProductionCost,
  buildConceptVariants,
  buildKeepsAndChanges,
  buildSamplePreview,
  analyzeReferenceVideoQuick,
  analyzeReferenceVideo,
};