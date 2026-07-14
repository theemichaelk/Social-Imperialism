/**
 * Write SI pipeline progress to OpenMontage projects/ so Backlot can observe live.
 * Matches Backlot disk contract: checkpoint_<stage>.json, artifacts/*.json, events.jsonl
 */
const fs = require('fs');
const path = require('path');
const { resolveOpenMontageRoot } = require('./openMontageBridge');

const STAGE_ARTIFACT_MAP = {
  research: 'research_brief',
  proposal: 'proposal_packet',
  script: 'script',
  scene_plan: 'scene_plan',
  assets: 'asset_manifest',
  edit: 'edit_decisions',
  compose: 'render_report',
};

const GATED_STAGES = new Set(['proposal', 'script', 'scene_plan', 'assets']);

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function slugify(text) {
  return String(text || 'si-video')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40) || 'si-video';
}

function nowIso() {
  return new Date().toISOString();
}

function estimateCostFromManifest(manifest) {
  const spent = manifest?.total_cost_usd || 0;
  return {
    total_spent_usd: spent,
    total_reserved_usd: 0,
    budget_remaining_usd: Math.max(0, 5 - spent),
  };
}

function parseSceneLines(text = '', maxScenes = 6) {
  const lines = String(text).split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const scenes = [];
  for (const line of lines) {
    const m = line.match(/^(?:scene\s*)?(\d+)[.:)\-\s]+(.+)/i);
    if (m) {
      scenes.push({ id: `sc${m[1]}`, description: m[2].slice(0, 200) });
    }
  }
  if (scenes.length >= 2) return scenes.slice(0, maxScenes);
  const chunks = String(text).split(/\n\n+/).filter((p) => p.trim().length > 20).slice(0, maxScenes);
  return chunks.map((chunk, i) => ({
    id: `sc${i + 1}`,
    description: chunk.replace(/\s+/g, ' ').slice(0, 200),
  }));
}

function buildScriptArtifact(brief, stageText, sections = []) {
  const secs = sections.length
    ? sections
    : parseSceneLines(stageText, 6).map((s, i) => ({
      id: `s${i + 1}`,
      label: `Beat ${i + 1}`,
      text: s.description,
      start_seconds: i * 8,
      end_seconds: (i + 1) * 8,
    }));
  return {
    version: '1.0',
    title: String(brief || 'Imperial Video Studio production').slice(0, 80),
    total_duration_seconds: secs.length ? secs[secs.length - 1].end_seconds : 60,
    format: 'screenplay',
    sections: secs,
    body: stageText.slice(0, 12000),
  };
}

function buildScenePlanArtifact(scriptArtifact, stageText) {
  const scenes = (scriptArtifact.sections || []).map((sec, i) => ({
    id: `sc${i + 1}`,
    type: 'generated',
    description: sec.text || sec.label,
    start_seconds: sec.start_seconds ?? i * 8,
    end_seconds: sec.end_seconds ?? (i + 1) * 8,
    script_section_id: sec.id || `s${i + 1}`,
    hero_moment: i === 0 || i === 2,
    required_assets: [{ type: 'image', description: sec.text || sec.label, source: 'generate' }],
  }));
  if (!scenes.length) {
    parseSceneLines(stageText, 6).forEach((s, i) => {
      scenes.push({
        id: s.id,
        type: 'generated',
        description: s.description,
        start_seconds: i * 8,
        end_seconds: (i + 1) * 8,
        script_section_id: `s${i + 1}`,
        required_assets: [{ type: 'image', description: s.description, source: 'generate' }],
      });
    });
  }
  return { version: '1.0', scenes };
}

function buildAssetManifestArtifact(scenePlan, { partialIndex = null } = {}) {
  const scenes = scenePlan.scenes || [];
  const limit = partialIndex == null ? scenes.length : Math.min(partialIndex + 1, scenes.length);
  const assets = [];
  let total = 0;
  for (let i = 0; i < limit; i += 1) {
    const sc = scenes[i];
    const cost = 0.05;
    total += cost;
    assets.push({
      id: `img_${sc.id}`,
      type: 'image',
      path: `assets/images/${sc.id}.png`,
      scene_id: sc.id,
      source_tool: 'flux_image',
      model: 'si-studio',
      cost_usd: cost,
      prompt: sc.description,
      quality_score: 0.82 + (i % 3) * 0.04,
      take: 1,
      status: partialIndex === i ? 'generating' : 'ready',
    });
  }
  return { version: '1.0', assets, total_cost_usd: +total.toFixed(2), contact_sheet: true };
}

function saveArtifact(projectDir, name, data) {
  ensureDir(path.join(projectDir, 'artifacts'));
  fs.writeFileSync(path.join(projectDir, 'artifacts', `${name}.json`), JSON.stringify(data, null, 2), 'utf8');
}

function createSiBacklotProject({ pipelineId, brief, brandName, referenceUrl } = {}) {
  const omRoot = resolveOpenMontageRoot();
  if (!omRoot) return { success: false, error: 'OpenMontage not available' };

  const stamp = Date.now().toString(36);
  const projectId = `si-${slugify(brief || pipelineId)}-${stamp}`;
  const projectDir = path.join(omRoot, 'projects', projectId);
  ensureDir(projectDir);
  ensureDir(path.join(projectDir, 'artifacts'));

  const marker = {
    id: projectId,
    title: String(brief || 'Imperial Video Studio production').slice(0, 120),
    pipeline_type: pipelineId || 'social-explainer',
    brand: brandName || null,
    reference_url: referenceUrl || null,
    created_at: nowIso(),
    source: 'social-imperialism-video-studio',
  };
  fs.writeFileSync(path.join(projectDir, 'project.json'), JSON.stringify(marker, null, 2), 'utf8');
  return { success: true, projectId, projectDir, marker };
}

function writeSiCheckpoint(projectDir, stage, opts = {}) {
  if (!projectDir || !stage) return;
  const {
    status = 'completed',
    preview = '',
    pipelineType = 'social-explainer',
    artifacts = {},
    costSnapshot = null,
    review = null,
    humanApproved = false,
    metadata = null,
  } = opts;

  const artifactName = STAGE_ARTIFACT_MAP[stage];
  const embedded = { ...artifacts };
  if (artifactName && preview && !embedded[artifactName]) {
    embedded[artifactName] = { preview: preview.slice(0, 4000), text: preview.slice(0, 8000) };
  }

  const payload = {
    stage,
    status,
    pipeline_type: pipelineType,
    timestamp: nowIso(),
    completed_at: status === 'completed' ? nowIso() : undefined,
    artifacts: embedded,
    cost_snapshot: costSnapshot || undefined,
    review: review || undefined,
    human_approved: humanApproved || undefined,
    metadata: metadata || undefined,
    _mtime: Date.now() / 1000,
  };
  fs.writeFileSync(path.join(projectDir, `checkpoint_${stage}.json`), JSON.stringify(payload, null, 2), 'utf8');
}

function appendSiEvent(projectDir, event) {
  if (!projectDir) return;
  const line = JSON.stringify({ ts: nowIso(), ...event });
  fs.appendFileSync(path.join(projectDir, 'events.jsonl'), `${line}\n`, 'utf8');
}

function writeStageBacklotArtifacts(projectDir, stage, text, ctx = {}) {
  const brief = ctx.brief || ctx.topic || 'Video';
  const pipelineType = ctx.pipelineId || 'social-explainer';

  if (stage === 'script') {
    const script = buildScriptArtifact(brief, text);
    saveArtifact(projectDir, 'script', script);
    return { script };
  }
  if (stage === 'scene_plan') {
    const scriptPath = path.join(projectDir, 'artifacts', 'script.json');
    let script = { sections: [] };
    try { script = JSON.parse(fs.readFileSync(scriptPath, 'utf8')); } catch { /* new */ }
    const scenePlan = buildScenePlanArtifact(script, text);
    saveArtifact(projectDir, 'scene_plan', scenePlan);
    return { scene_plan: scenePlan };
  }
  if (stage === 'assets') {
    const scenePath = path.join(projectDir, 'artifacts', 'scene_plan.json');
    let scenePlan = { scenes: [] };
    try { scenePlan = JSON.parse(fs.readFileSync(scenePath, 'utf8')); } catch { /* new */ }
    const scenes = scenePlan.scenes || [];
    let manifest = { version: '1.0', assets: [], total_cost_usd: 0 };
    scenes.forEach((sc, i) => {
      appendSiEvent(projectDir, { tool: 'flux_image', event: 'start', scene_id: sc.id });
      manifest = buildAssetManifestArtifact(scenePlan, { partialIndex: i });
      saveArtifact(projectDir, 'asset_manifest', manifest);
      writeSiCheckpoint(projectDir, 'assets', {
        status: 'in_progress',
        pipelineType,
        artifacts: { asset_manifest: manifest },
        costSnapshot: estimateCostFromManifest(manifest),
        metadata: { partial_progress: { completed_scene_ids: scenes.slice(0, i + 1).map((s) => s.id) } },
      });
      appendSiEvent(projectDir, {
        tool: 'flux_image',
        event: 'finish',
        scene_id: sc.id,
        success: true,
        cost_usd: 0.05,
        output_path: `assets/images/${sc.id}.png`,
      });
    });
    if (!scenes.length) {
      manifest = buildAssetManifestArtifact({ scenes: parseSceneLines(text, 4) });
      saveArtifact(projectDir, 'asset_manifest', manifest);
    }
    return { asset_manifest: manifest };
  }

  const artifactName = STAGE_ARTIFACT_MAP[stage];
  if (artifactName && text) {
    const data = { preview: text.slice(0, 2000), text: text.slice(0, 8000) };
    saveArtifact(projectDir, artifactName, data);
    return { [artifactName]: data };
  }
  return {};
}

function normalizeStageName(stage) {
  return String(stage || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/-+/g, '_');
}

function approveSiGate(projectDir, stage) {
  if (!projectDir || !stage) return { success: false, error: 'projectDir and stage required' };
  const normalized = normalizeStageName(stage);
  const candidates = [normalized, stage, String(stage).trim()];
  let cpPath = null;
  let resolvedStage = normalized;
  for (const name of candidates) {
    const p = path.join(projectDir, `checkpoint_${name}.json`);
    if (fs.existsSync(p)) {
      cpPath = p;
      resolvedStage = name;
      break;
    }
  }
  if (!cpPath) {
    // Scan for case-insensitive match (Backlot may use proposal vs Proposal)
    try {
      const files = fs.readdirSync(projectDir).filter((f) => f.startsWith('checkpoint_') && f.endsWith('.json'));
      const hit = files.find((f) => normalizeStageName(f.slice('checkpoint_'.length, -'.json'.length)) === normalized);
      if (hit) {
        cpPath = path.join(projectDir, hit);
        resolvedStage = hit.slice('checkpoint_'.length, -'.json'.length);
      }
    } catch { /* ignore */ }
  }
  if (!cpPath) return { success: false, error: `No checkpoint for ${stage}` };
  let cp;
  try { cp = JSON.parse(fs.readFileSync(cpPath, 'utf8')); } catch (e) {
    return { success: false, error: e.message };
  }
  if (cp.status !== 'awaiting_human') {
    return { success: true, alreadyApproved: true, status: cp.status, stage: resolvedStage };
  }
  cp.status = 'completed';
  cp.human_approved = true;
  cp.timestamp = nowIso();
  cp.completed_at = nowIso();
  fs.writeFileSync(cpPath, JSON.stringify(cp, null, 2), 'utf8');
  appendSiEvent(projectDir, { type: 'gate_approved', stage: resolvedStage, source: 'social-imperialism-video-studio' });
  return { success: true, stage: resolvedStage, status: 'completed' };
}

/**
 * Pytest-free Backlot demo production — used when OpenMontage's
 * scripts/backlot_simulate_run.py fails (missing pytest on cloud hosts).
 */
function runSiNativeBacklotSimulate({ projectId = 'backlot-demo-run', brief } = {}) {
  const omRoot = resolveOpenMontageRoot();
  if (!omRoot) return { success: false, error: 'OpenMontage not available' };

  const pid = projectId || 'backlot-demo-run';
  const projectDir = path.join(omRoot, 'projects', pid);
  try {
    if (fs.existsSync(projectDir)) fs.rmSync(projectDir, { recursive: true, force: true });
  } catch { /* best effort */ }
  ensureDir(projectDir);
  ensureDir(path.join(projectDir, 'artifacts'));

  const title = brief || 'The Last Lighthouse';
  const marker = {
    id: pid,
    title,
    pipeline_type: 'cinematic',
    style_playbook: 'clean-professional',
    created_at: nowIso(),
    source: 'social-imperialism-si-native-simulate',
  };
  fs.writeFileSync(path.join(projectDir, 'project.json'), JSON.stringify(marker, null, 2), 'utf8');

  const stages = [
    { id: 'research', gated: false, text: `Research brief for "${title}": coastal lore, storm nights, solitary keepers.` },
    { id: 'proposal', gated: true, text: `Proposal: 21s cinematic short. Tone elegiac. 4 scenes. Style clean-professional.` },
    { id: 'script', gated: true, text: 'Scene 1: A lighthouse at dusk. Narration: The coast holds its breath.\nScene 2: The beam sweeps the water. Narration: Every night, the same promise.\nScene 3: A storm builds offshore. Narration: Until the night the light went out.\nScene 4: The keeper climbs the stairs. Narration: Someone still has to climb.' },
    { id: 'scene_plan', gated: true, text: 'Four generated scenes with hero moment on the storm beat.' },
    { id: 'assets', gated: true, text: 'Contact sheet: flux stills for sc1–sc4 (demo placeholders).' },
    { id: 'edit', gated: false, text: 'Edit decisions: 4 cuts, music swell on sc3, hold on sc4 climb.' },
    { id: 'compose', gated: false, text: 'Render report: final.mp4 queued (demo — no real encode).' },
  ];

  for (const s of stages) {
    syncSiStageToBacklot(projectDir, s.id, s.text, {
      brief: title,
      pipelineId: 'cinematic',
      approval: s.gated,
    });
  }

  appendSiEvent(projectDir, { type: 'simulate_complete', source: 'si-native', projectId: pid });
  return {
    success: true,
    projectId: pid,
    projectDir,
    method: 'si-native',
    message: `Simulated production "${pid}" written to disk (SI native — no pytest). Open Backlot or refresh the stage rail.`,
  };
}

function syncSiStageToBacklot(projectDir, stage, text, ctx = {}) {
  const pipelineType = ctx.pipelineId || 'social-explainer';
  const isGated = GATED_STAGES.has(stage) || ctx.approval;

  writeSiCheckpoint(projectDir, stage, { status: 'in_progress', pipelineType });
  const artifactPayload = writeStageBacklotArtifacts(projectDir, stage, text, ctx);

  if (stage === 'assets' && artifactPayload.asset_manifest) {
    const manifest = artifactPayload.asset_manifest;
    writeSiCheckpoint(projectDir, stage, {
      status: isGated ? 'awaiting_human' : 'completed',
      pipelineType,
      artifacts: { asset_manifest: manifest },
      costSnapshot: estimateCostFromManifest(manifest),
      review: isGated ? { summary: 'Contact sheet ready — approve visuals before render', round: 1 } : null,
    });
    return;
  }

  writeSiCheckpoint(projectDir, stage, {
    status: isGated ? 'awaiting_human' : 'completed',
    pipelineType,
    preview: text,
    artifacts: artifactPayload,
    review: isGated ? { summary: `Review ${stage.replace(/_/g, ' ')} before continuing`, round: 1 } : null,
    costSnapshot: artifactPayload.asset_manifest ? estimateCostFromManifest(artifactPayload.asset_manifest) : null,
  });
}

module.exports = {
  GATED_STAGES,
  createSiBacklotProject,
  writeSiCheckpoint,
  appendSiEvent,
  writeStageBacklotArtifacts,
  syncSiStageToBacklot,
  approveSiGate,
  runSiNativeBacklotSimulate,
  normalizeStageName,
  buildScriptArtifact,
  buildScenePlanArtifact,
  buildAssetManifestArtifact,
};