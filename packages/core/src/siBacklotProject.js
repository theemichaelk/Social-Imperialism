/**
 * Write SI pipeline progress to OpenMontage projects/ so Backlot can observe live.
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
    created_at: new Date().toISOString(),
    source: 'social-imperialism-video-studio',
  };
  fs.writeFileSync(path.join(projectDir, 'project.json'), JSON.stringify(marker, null, 2), 'utf8');
  return { success: true, projectId, projectDir, marker };
}

function writeSiCheckpoint(projectDir, stage, { status = 'completed', preview = '', artifacts = {} } = {}) {
  if (!projectDir || !stage) return;
  const artifactName = STAGE_ARTIFACT_MAP[stage];
  const payload = {
    stage,
    status,
    pipeline_type: 'social-explainer',
    completed_at: new Date().toISOString(),
    artifacts: {
      ...artifacts,
      ...(artifactName && preview ? { [artifactName]: { preview: preview.slice(0, 4000), text: preview.slice(0, 8000) } } : {}),
    },
    _mtime: Date.now() / 1000,
  };
  fs.writeFileSync(path.join(projectDir, `checkpoint_${stage}.json`), JSON.stringify(payload, null, 2), 'utf8');

  if (artifactName && preview) {
    const artPath = path.join(projectDir, 'artifacts', `${artifactName}.json`);
    fs.writeFileSync(artPath, JSON.stringify({ preview: preview.slice(0, 2000), text: preview.slice(0, 8000) }, null, 2), 'utf8');
  }
}

function appendSiEvent(projectDir, event) {
  if (!projectDir) return;
  const line = JSON.stringify({
    ts: new Date().toISOString(),
    ...event,
  });
  fs.appendFileSync(path.join(projectDir, 'events.jsonl'), `${line}\n`, 'utf8');
}

module.exports = {
  createSiBacklotProject,
  writeSiCheckpoint,
  appendSiEvent,
};