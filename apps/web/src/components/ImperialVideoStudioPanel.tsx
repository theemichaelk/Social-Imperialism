'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { invoke } from '@/lib/api';
import { executeLiveSupportAction } from '@/lib/liveSupportActions';

type Pipeline = {
  id: string;
  label: string;
  stability: string;
  bestFor: string;
};

type StageFlow = { id: string; label: string; approval: boolean };

type OpenMontageStatus = {
  connected?: boolean;
  ready?: boolean;
  composeReady?: boolean;
  lastBananaReady?: boolean;
  hasFalKey?: boolean;
  qualityTiers?: { slideshow?: boolean; motionClips?: boolean; lastBanana?: boolean };
  whyNotLastBanana?: string[] | null;
  repo?: string;
  ffmpeg?: boolean;
  remotionComposer?: boolean;
  pythonToolRegistry?: boolean;
  issues?: string[];
  siGap?: string | null;
  referenceDemo?: string;
};

type StudioConfig = {
  pipelineCount: number;
  toolCount: number;
  skillCount: number;
  stageFlow: StageFlow[];
  pipelines: Pipeline[];
  openMontage?: OpenMontageStatus;
};

type StoryboardStage = {
  stage: string;
  label: string;
  status: string;
  gate: string;
};

type PipelineStage = {
  id: string;
  label: string;
  status: string;
  approval?: boolean;
  outputPreview?: string;
  gate?: string;
};

type ConceptVariant = {
  id?: string;
  title: string;
  angle: string;
};

type ReferenceMetadata = {
  title?: string | null;
  author?: string | null;
  platform?: string | null;
};

type ReferenceAnalysisResult = {
  success?: boolean;
  mode?: string;
  metadata?: ReferenceMetadata;
  analysis?: {
    content?: string;
    style?: string;
    structure?: string;
    motion?: string;
    transcript?: string | null;
    whatMakesItWork?: string[];
    sampleHook?: string;
  };
  keeps?: string[];
  changes?: string[];
  concepts?: ConceptVariant[];
  toolPath?: string[];
  costEstimate?: {
    totalUsd?: { low: number; high: number };
    sampleBeforeFullProductionUsd?: { low: number; high: number };
    estimatedScenes?: number;
    assumptions?: string[];
    lineItems?: Array<{ category: string; tool: string; units: number; costUsd: number }>;
  };
  samplePreview?: string;
  recommendedPipeline?: string;
  targetDurationSec?: number;
  honestNote?: string;
  agentNote?: string;
  error?: string;
};

type BacklotStatus = {
  available?: boolean;
  running?: boolean;
  baseUrl?: string | null;
  projectCount?: number;
  note?: string;
};

type BacklotBoardState = {
  stages?: Array<{ name: string; status?: string; gated?: boolean }>;
  activity?: { status?: string };
  title?: string;
};

type JobResult = {
  status?: string;
  success?: boolean;
  accepted?: boolean;
  async?: boolean;
  pipelineId?: string;
  pipelineLabel?: string;
  stageCount?: number;
  storyboard?: StoryboardStage[];
  stages?: PipelineStage[];
  deliverable?: string;
  error?: string;
  publicVideoUrl?: string | null;
  compose?: { publicUrl?: string; outputPath?: string; runtime?: string };
  backlotProjectId?: string | null;
};

const IVS_DRAFT_KEY = 'ivs-draft-v1';

function looksLikeReferenceAnalysis(text: string): boolean {
  const t = text.trim();
  return /^Pacing:/m.test(t) && /Structure:/m.test(t);
}

function isBriefReady(brief: string): boolean {
  const trimmed = brief.trim();
  return trimmed.length >= 12 && !looksLikeReferenceAnalysis(trimmed);
}

function resolvePipelineBrief(brief: string, referenceAnalysis: string | null, brandName: string): string {
  const trimmed = brief.trim();
  if (!trimmed) return `60-second agentic video for ${brandName}`;
  if (referenceAnalysis && trimmed === referenceAnalysis.trim()) {
    return `60-second video for ${brandName} — use reference pacing and structure`;
  }
  if (looksLikeReferenceAnalysis(trimmed)) {
    return `60-second video for ${brandName} — use reference pacing and structure`;
  }
  return trimmed;
}

function buildSuggestedBrief(
  pipelineLabel: string,
  brandName: string,
  concept?: ConceptVariant | null,
  refTitle?: string | null,
): string {
  const pipeline = pipelineLabel.toLowerCase();
  const topicHint = refTitle
    ? `inspired by reference pacing (not copying "${refTitle}")`
    : 'matching reference pacing with your topic';
  if (concept?.id === 'tone') {
    return `60-second documentary-style ${pipeline} for ${brandName} — slower pacing, stock montage`;
  }
  if (concept?.id === 'burst') {
    return `30-second vertical ${pipeline} for ${brandName} — fast cuts, Grok motion clips`;
  }
  return `60-second ${pipeline} for ${brandName} — ${topicHint}`;
}

function formatStageGate(gate: string): string {
  if (gate === 'auto') return 'Automatic';
  if (gate === 'approved') return 'Approved (preview)';
  if (gate === 'review_ready' || gate === 'awaiting_review') return 'Ready for your review';
  return gate.replace(/_/g, ' ');
}

function formatDeliverablePreview(text: string): string {
  return text
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/\*\*/g, '')
    .replace(/^---$/gm, '')
    .trim();
}

function normalizeJobResult(res: JobResult | null | undefined): JobResult | null {
  if (!res) return null;
  if (res.status === 'idle') return null;
  if (res.status) return res;
  if (res.error) return { ...res, status: 'error' };
  if (res.accepted) return { ...res, status: 'running' };
  if (res.success && (res.storyboard?.length || res.deliverable)) {
    return { ...res, status: 'complete' };
  }
  return res;
}

export function ImperialVideoStudioPanel() {
  const [config, setConfig] = useState<StudioConfig | null>(null);
  const [configLoading, setConfigLoading] = useState(true);
  const [configError, setConfigError] = useState('');
  const [selectedPipeline, setSelectedPipeline] = useState('social-explainer');
  const [brief, setBrief] = useState('');
  const [referenceUrl, setReferenceUrl] = useState('');
  const [referenceTitle, setReferenceTitle] = useState<string | null>(null);
  const [referenceAnalysis, setReferenceAnalysis] = useState<string | null>(null);
  const [concepts, setConcepts] = useState<ConceptVariant[]>([]);
  const [selectedConcept, setSelectedConcept] = useState<ConceptVariant | null>(null);
  const [job, setJob] = useState<JobResult | null>(null);
  const [toolSummary, setToolSummary] = useState<string>('');
  const [running, setRunning] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [composeMsg, setComposeMsg] = useState('');
  const [brandName, setBrandName] = useState('Social Imperialism');
  const [showToolDetail, setShowToolDetail] = useState(false);
  const [suggestedBrief, setSuggestedBrief] = useState('');
  const [expandedStage, setExpandedStage] = useState<string | null>(null);
  const [reviewedGates, setReviewedGates] = useState<Record<string, boolean>>({});
  const [omStatus, setOmStatus] = useState<OpenMontageStatus | null>(null);
  const [renderedVideoUrl, setRenderedVideoUrl] = useState<string | null>(null);
  const [targetDurationSec, setTargetDurationSec] = useState(60);
  const [localClipPath, setLocalClipPath] = useState('');
  const [refPlan, setRefPlan] = useState<ReferenceAnalysisResult | null>(null);
  const [backlotStatus, setBacklotStatus] = useState<BacklotStatus | null>(null);
  const [backlotBoard, setBacklotBoard] = useState<BacklotBoardState | null>(null);
  const [backlotProjectId, setBacklotProjectId] = useState<string | null>(null);

  const briefReady = useMemo(() => isBriefReady(brief), [brief]);

  const refresh = useCallback(async () => {
    setConfigLoading(true);
    setConfigError('');
    try {
      const [cfg, tools, result, om, bl] = await Promise.all([
        invoke<StudioConfig>('get-imperial-video-studio-config'),
        invoke<{ toolCount: number; skillCount: number; capabilities: Array<{ name: string; configured: number; total: number }> }>('get-imperial-video-tool-registry').catch(() => null),
        invoke<JobResult & { backlotProjectId?: string }>('get-imperial-video-pipeline-result').catch(() => null),
        invoke<OpenMontageStatus>('get-openmontage-status').catch(() => null),
        invoke<BacklotStatus>('get-backlot-status').catch(() => null),
      ]);
      if (om) setOmStatus(om);
      if (bl) setBacklotStatus(bl);
      if (cfg?.pipelines?.length) {
        setConfig(cfg);
      } else {
        setConfigError('Studio pipelines did not load — retry or refresh the page.');
      }
      if (tools) {
        const caps = (tools.capabilities || [])
          .map((c) => `${c.name}: ${c.configured}/${c.total}`)
          .join(' · ');
        setToolSummary(`${tools.toolCount} tools · ${tools.skillCount}+ agent skills · ${caps}`);
      }
      const normalized = normalizeJobResult(result);
      if (normalized) {
        setJob(normalized);
        const url = normalized.publicVideoUrl || normalized.compose?.publicUrl;
        if (url) setRenderedVideoUrl(url);
        if (normalized.backlotProjectId) setBacklotProjectId(normalized.backlotProjectId);
      }
    } catch (e) {
      setConfigError((e as Error).message || 'Could not load Imperial Video Studio.');
    } finally {
      setConfigLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    invoke<{ brandName?: string }>('get-active-campaign')
      .then((c) => { if (c?.brandName?.trim()) setBrandName(c.brandName.trim()); })
      .catch(() => null);
  }, [refresh]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const raw = sessionStorage.getItem(IVS_DRAFT_KEY);
      if (!raw) return;
      const draft = JSON.parse(raw) as {
        brief?: string;
        referenceUrl?: string;
        referenceTitle?: string | null;
        selectedPipeline?: string;
      };
      if (draft.referenceUrl) setReferenceUrl(draft.referenceUrl);
      if (draft.referenceTitle) setReferenceTitle(draft.referenceTitle);
      if (draft.selectedPipeline) setSelectedPipeline(draft.selectedPipeline);
      if (draft.brief && !looksLikeReferenceAnalysis(draft.brief)) setBrief(draft.brief);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (looksLikeReferenceAnalysis(brief)) {
      setBrief('');
      return;
    }
    sessionStorage.setItem(IVS_DRAFT_KEY, JSON.stringify({
      brief,
      referenceUrl,
      referenceTitle,
      selectedPipeline,
    }));
  }, [brief, referenceUrl, referenceTitle, selectedPipeline]);

  useEffect(() => {
    if (typeof window === 'undefined' || window.location.hash !== '#run') return;
    document.getElementById('ivs-run-pipeline')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, []);

  const refreshBacklotBoard = useCallback(async (projectId: string) => {
    try {
      const res = await invoke<{ success?: boolean; state?: BacklotBoardState; error?: string }>('get-backlot-board-state', { projectId });
      if (res.success && res.state) setBacklotBoard(res.state as BacklotBoardState);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    if (job?.status !== 'running') return undefined;
    const t = setInterval(() => {
      invoke<JobResult>('get-imperial-video-pipeline-result')
        .then((r) => {
          const normalized = normalizeJobResult(r);
          if (normalized) {
            setJob(normalized);
            if (normalized.backlotProjectId) setBacklotProjectId(normalized.backlotProjectId);
          }
        })
        .catch(() => { /* ignore */ });
    }, 2500);
    return () => clearInterval(t);
  }, [job?.status]);

  useEffect(() => {
    if (!backlotProjectId) return undefined;
    refreshBacklotBoard(backlotProjectId);
    const t = setInterval(() => refreshBacklotBoard(backlotProjectId), 4000);
    return () => clearInterval(t);
  }, [backlotProjectId, job?.status, refreshBacklotBoard]);

  const applyConcept = (concept: ConceptVariant) => {
    setSelectedConcept(concept);
    const pipelineLabel = config?.pipelines?.find((p) => p.id === selectedPipeline)?.label || 'social video';
    const next = buildSuggestedBrief(pipelineLabel, brandName, concept, referenceTitle);
    setSuggestedBrief(next);
    setBrief(next);
  };

  const analyzeReference = async (topicOverride?: string) => {
    const source = referenceUrl.trim() || localClipPath.trim();
    if (!source) return;
    setRunning(true);
    setRefPlan(null);
    try {
      const topic = topicOverride || brief.trim() || 'your topic';
      const res = await invoke<ReferenceAnalysisResult>('analyze-reference-video', {
        url: referenceUrl.trim() || undefined,
        localPath: localClipPath.trim() || undefined,
        reference: source,
        topic,
        targetDurationSec,
        deep: true,
      });
      if (!res.success) {
        setReferenceAnalysis(res.error || 'Reference analysis failed.');
        return;
      }
      setRefPlan(res);
      const meta = res.metadata || {};
      if (meta.title) setReferenceTitle(meta.title);
      const lines = [
        meta.title && `Reference: ${meta.title}${meta.author ? ` · ${meta.author}` : ''}${meta.platform ? ` (${meta.platform})` : ''}`,
        res.analysis?.content && `Content: ${res.analysis.content}`,
        res.analysis?.structure && `Structure: ${res.analysis.structure}`,
        res.analysis?.style && `Style: ${res.analysis.style}`,
        res.analysis?.motion && `Motion: ${res.analysis.motion}`,
        res.recommendedPipeline && `Recommended pipeline: ${res.recommendedPipeline}`,
        res.mode && `Analysis mode: ${res.mode}`,
      ].filter(Boolean);
      setReferenceAnalysis(lines.join('\n'));
      setConcepts(res.concepts || []);
      setSelectedConcept(null);
      if (res.recommendedPipeline) setSelectedPipeline(res.recommendedPipeline);
      const pipelineLabel = config?.pipelines?.find((p) => p.id === (res.recommendedPipeline || selectedPipeline))?.label
        || 'social video';
      const suggested = buildSuggestedBrief(pipelineLabel, brandName, null, meta.title);
      setSuggestedBrief(suggested);
      if (!brief.trim() || looksLikeReferenceAnalysis(brief)) {
        setBrief(topicOverride ? `60-second video like the reference, but about ${topicOverride}` : '');
      }
    } catch (e) {
      setReferenceAnalysis((e as Error).message || 'Reference analysis failed.');
    } finally {
      setRunning(false);
    }
  };

  const openBacklot = async (projectId?: string | null) => {
    try {
      const res = await invoke<{ success?: boolean; boardUrl?: string; error?: string }>('open-backlot-board', {
        projectId: projectId || backlotProjectId || undefined,
      });
      if (res.boardUrl && typeof window !== 'undefined') {
        window.open(res.boardUrl, '_blank', 'noopener,noreferrer');
      }
      if (res.error) setComposeMsg(res.error);
    } catch (e) {
      setComposeMsg((e as Error).message || 'Could not open Backlot.');
    }
  };

  const clearBoard = async () => {
    setRunning(true);
    try {
      await invoke('clear-imperial-video-pipeline-result');
      setJob(null);
      setComposeMsg('');
      setExpandedStage(null);
      setReviewedGates({});
    } catch (e) {
      setComposeMsg((e as Error).message || 'Could not clear production board.');
    } finally {
      setRunning(false);
    }
  };

  const queueComposition = async (opts?: { template?: string; briefOverride?: string }) => {
    setComposeMsg('');
    setRunning(true);
    try {
      const topic = opts?.briefOverride || brief.trim() || 'Social Imperialism video';
      const res = await invoke<{
        message?: string;
        status?: string;
        publicUrl?: string;
        outputPath?: string;
        runtime?: string;
        error?: string;
      }>('run-imperial-video-compose', {
        pipelineId: job?.pipelineId || selectedPipeline,
        runtime: omStatus?.ready ? 'openmontage-remotion' : 'ffmpeg-kenburns',
        brief: topic,
        template: opts?.template,
        publicCopyDir: opts?.template === 'last-monkey-king' ? undefined : undefined,
      });
      if (res.error) {
        setComposeMsg(res.error);
        return;
      }
      if (res.publicUrl) setRenderedVideoUrl(res.publicUrl);
      setComposeMsg(res.message || (res.status === 'complete' ? 'Video rendered.' : 'Composition queued.'));
    } catch (e) {
      setComposeMsg((e as Error).message || 'Could not queue composition.');
    } finally {
      setRunning(false);
    }
  };

  const renderMonkeyKing = async () => {
    setBrief('The Last Monkey King — why Sun Wukong was cast out of Heaven');
    setSelectedPipeline('character-short');
    await queueComposition({
      template: 'last-monkey-king',
      briefOverride: 'The Last Monkey King — why Sun Wukong was cast out of Heaven',
    });
  };

  const goPublish = (href: string, label: string) => {
    executeLiveSupportAction({
      type: 'navigate',
      label,
      href,
      navId: href.includes('calendar') ? 'calendar' : 'content-hub',
      sectionId: 'create',
      autoExecute: true,
      message: `Taking you to ${label}…`,
    });
  };

  const runPipeline = async (quick = false) => {
    if (!quick && !briefReady) return;
    setRunning(true);
    setShowHistory(true);
    setReviewedGates({});
    setJob({ status: 'running', pipelineId: selectedPipeline });
    const topic = resolvePipelineBrief(brief, referenceAnalysis, brandName);
    try {
      const res = await invoke<JobResult>('run-imperial-video-pipeline', {
        pipelineId: selectedPipeline,
        brief: topic,
        topic,
        brandName,
        referenceUrl: referenceUrl.trim() || undefined,
        referenceTitle: referenceTitle || undefined,
        referenceNotes: referenceAnalysis || undefined,
        async: !quick,
        quick,
      });
      if (res.accepted) return;
      const normalized = normalizeJobResult(res);
      if (normalized) setJob(normalized);
    } catch (err) {
      setJob({ status: 'error', error: err instanceof Error ? err.message : 'Pipeline failed' });
    } finally {
      setRunning(false);
    }
  };

  const pipelineBusy = running || job?.status === 'running';

  const pipelines = config?.pipelines || [];
  const stages = config?.stageFlow || [];
  const storyboard = job?.storyboard || [];
  const stageOutputs = job?.stages || [];

  const stagePreview = (stageId: string) => {
    const fromStages = stageOutputs.find((s) => s.id === stageId)?.outputPreview;
    if (fromStages) return fromStages;
    return null;
  };

  return (
    <div className="imperial-video-studio card">
      <section className="imperial-video-studio-om card" style={{ marginBottom: 12, padding: '12px 14px' }}>
        <h3 style={{ margin: '0 0 6px', fontSize: '0.95rem' }}>OpenMontage runtime</h3>
        <p className="muted" style={{ margin: '0 0 8px', fontSize: '0.82rem' }}>
          Connected to{' '}
          <a href="https://github.com/calesthio/OpenMontage" target="_blank" rel="noopener noreferrer">
            OpenMontage
          </a>
          {' '}— the open-source agentic video system behind demos like <em>The Last Banana</em>.
          The Last Banana uses <strong>Kling v3</strong> motion clips (fal.ai), Remotion compose, and Chirp3 narration — not Ken Burns stills.
        </p>
        {omStatus ? (
          <div style={{ fontSize: '0.8rem' }}>
            <p style={{ margin: '0 0 6px' }}>
              <span className={`badge ${omStatus.lastBananaReady ? 'is-ok' : omStatus.composeReady ? 'is-warn' : ''}`}>
                {omStatus.lastBananaReady ? 'Last Banana ready' : omStatus.qualityTiers?.motionClips ? 'Motion clips (FAL)' : omStatus.composeReady ? 'Slideshow only' : 'Setup needed'}
              </span>
              {' '}
              FFmpeg {omStatus.ffmpeg ? '✓' : '✗'} · FAL_KEY {omStatus.hasFalKey ? '✓' : '✗'} · Remotion {omStatus.remotionComposer ? '✓' : '✗'}
            </p>
            {omStatus.whyNotLastBanana?.length ? (
              <ul className="muted" style={{ margin: '0 0 6px', paddingLeft: 18 }}>
                {omStatus.whyNotLastBanana.map((line) => <li key={line}>{line}</li>)}
              </ul>
            ) : null}
            {omStatus.siGap && <p className="muted" style={{ margin: 0 }}>{omStatus.siGap}</p>}
          </div>
        ) : (
          <p className="muted" style={{ margin: 0, fontSize: '0.8rem' }}>Checking OpenMontage status…</p>
        )}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10 }}>
          <button type="button" className="btn primary" disabled={running} onClick={renderMonkeyKing}>
            Render: Last Monkey King
          </button>
          <button type="button" className="btn" disabled={running} onClick={() => queueComposition()}>
            Compose current brief
          </button>
        </div>
        {renderedVideoUrl && (
          <div style={{ marginTop: 12 }}>
            <p className="muted" style={{ margin: '0 0 6px', fontSize: '0.78rem' }}>Latest render</p>
            <video controls style={{ width: '100%', maxWidth: 720, borderRadius: 8 }} src={renderedVideoUrl} />
          </div>
        )}
      </section>

      <header className="imperial-video-studio-head">
        <div>
          <p className="eyebrow">Imperial Video Studio</p>
          <h2>Agentic video production</h2>
          <p className="muted">
            {config
              ? `${config.pipelineCount} pipelines · ${config.toolCount} tools · ${config.skillCount}+ agent skills`
              : configLoading
                ? 'Loading studio config…'
                : 'Studio config unavailable'}
          </p>
          {configError && (
            <p className="error" style={{ marginTop: 6 }}>
              {configError}{' '}
              <button type="button" className="btn" style={{ marginLeft: 8 }} onClick={() => refresh()}>
                Retry
              </button>
            </p>
          )}
          {toolSummary && (
            <button
              type="button"
              className="imperial-video-studio-tools-toggle"
              onClick={() => setShowToolDetail((s) => !s)}
            >
              {showToolDetail ? 'Hide tool breakdown' : 'Show tool breakdown'}
            </button>
          )}
          {showToolDetail && toolSummary && (
            <p className="imperial-video-studio-tools">{toolSummary}</p>
          )}
        </div>
        <div className="imperial-video-studio-head-actions">
          <button type="button" className="btn" onClick={() => setShowHistory((s) => !s)}>
            {showHistory ? 'Hide board' : 'Production board'}
          </button>
          {(job?.status === 'complete' || job?.status === 'error') && (
            <button type="button" className="btn" disabled={running} onClick={clearBoard}>
              Clear board
            </button>
          )}
        </div>
      </header>

      <section className="imperial-video-studio-ref ivs-ref-hero">
        <h3>Start From A Video You Already Love</h3>
        <p className="muted">
          Starting from a reference video is often faster than starting from a blank prompt.
          Paste a YouTube video, Short, Reel, TikTok, or local clip path — the agent analyzes
          transcript, pacing, scenes, keyframes, and style, then returns a grounded production plan
          (not best-guess prompt spaghetti).
        </p>
        <blockquote className="ivs-ref-example">
          &ldquo;Here&apos;s a YouTube Short I love. Make me something like this, but about quantum computing.&rdquo;
          <button
            type="button"
            className="btn"
            style={{ marginLeft: 8 }}
            disabled={running}
            onClick={() => {
              setBrief('Make me something like this reference, but about quantum computing');
              if (referenceUrl.trim() || localClipPath.trim()) {
                analyzeReference('quantum computing');
              }
            }}
          >
            Try example topic
          </button>
        </blockquote>
        <div className="imperial-video-studio-ref-row">
          <input
            type="url"
            className="input"
            placeholder="YouTube / Shorts / Reel / TikTok URL"
            value={referenceUrl}
            onChange={(e) => setReferenceUrl(e.target.value)}
          />
          <input
            type="text"
            className="input"
            placeholder="Local clip path (desktop)"
            value={localClipPath}
            onChange={(e) => setLocalClipPath(e.target.value)}
            title="Absolute path to a local .mp4 — desktop / local API only"
          />
          <label className="ivs-duration-label">
            <span className="muted">Target s</span>
            <input
              type="number"
              className="input ivs-duration-input"
              min={15}
              max={180}
              value={targetDurationSec}
              onChange={(e) => setTargetDurationSec(Math.max(15, Math.min(180, Number(e.target.value) || 60)))}
            />
          </label>
          <button
            type="button"
            className="btn primary"
            disabled={running || (!referenceUrl.trim() && !localClipPath.trim())}
            onClick={() => analyzeReference()}
          >
            {running ? 'Analyzing…' : 'Analyze reference'}
          </button>
        </div>
        {referenceTitle && (
          <p className="imperial-video-studio-ref-title muted">Detected: {referenceTitle}</p>
        )}
        {refPlan?.success && (
          <div className="ivs-ref-plan">
            <div className="ivs-ref-plan-grid">
              <div className="ivs-ref-plan-card">
                <h4>What it keeps</h4>
                <ul>{(refPlan.keeps || []).map((k) => <li key={k}>{k}</li>)}</ul>
              </div>
              <div className="ivs-ref-plan-card">
                <h4>What it changes</h4>
                <ul>{(refPlan.changes || []).map((c) => <li key={c}>{c}</li>)}</ul>
              </div>
              <div className="ivs-ref-plan-card">
                <h4>Honest tool path</h4>
                <ul>{(refPlan.toolPath || []).map((t) => <li key={t}>{t}</li>)}</ul>
              </div>
              <div className="ivs-ref-plan-card">
                <h4>Cost @ {refPlan.targetDurationSec || targetDurationSec}s</h4>
                {refPlan.costEstimate?.totalUsd ? (
                  <p>
                    <strong>${refPlan.costEstimate.totalUsd.low}–${refPlan.costEstimate.totalUsd.high}</strong>
                    {' '}before asset generation
                  </p>
                ) : null}
                {refPlan.costEstimate?.sampleBeforeFullProductionUsd ? (
                  <p className="muted">
                    Sample preview: ${refPlan.costEstimate.sampleBeforeFullProductionUsd.low}–$
                    {refPlan.costEstimate.sampleBeforeFullProductionUsd.high}
                  </p>
                ) : null}
                {refPlan.costEstimate?.assumptions?.slice(0, 2).map((a) => (
                  <p key={a} className="muted" style={{ fontSize: '0.72rem', margin: '4px 0 0' }}>{a}</p>
                ))}
              </div>
            </div>
            {refPlan.samplePreview && (
              <pre className="imperial-video-studio-analysis ivs-sample-preview">{refPlan.samplePreview}</pre>
            )}
            {refPlan.agentNote && (
              <p className="muted" style={{ fontSize: '0.75rem', margin: '8px 0 0' }}>{refPlan.agentNote}</p>
            )}
            {refPlan.honestNote && (
              <p className="muted" style={{ fontSize: '0.72rem', margin: '4px 0 0' }}>{refPlan.honestNote}</p>
            )}
          </div>
        )}
        {referenceAnalysis && !refPlan?.success && (
          <pre className="imperial-video-studio-analysis">{referenceAnalysis}</pre>
        )}
        {concepts.length > 0 && (
          <div className="imperial-video-studio-concepts">
            <p className="muted" style={{ margin: '0 0 0.35rem', fontSize: '0.75rem' }}>
              2–3 differentiated concepts — pick one to seed your brief:
            </p>
            <div className="imperial-video-studio-concept-grid">
              {concepts.map((c) => (
                <button
                  key={c.id || c.title}
                  type="button"
                  className={`imperial-video-studio-concept-card ${selectedConcept?.title === c.title ? 'is-selected' : ''}`}
                  onClick={() => applyConcept(c)}
                >
                  <strong>{c.title}</strong>
                  <span className="muted">{c.angle}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </section>

      <section className="imperial-video-studio-backlot card ivs-backlot">
        <h3>Watch It Happen — The Backlot Living Storyboard</h3>
        <p className="muted">
          OpenMontage&apos;s Backlot is a browser board that shows pipeline stages, script, scene plan,
          and generated assets live as production runs — derived from disk, not manual UI updates.
        </p>
        {backlotStatus && (
          <p className="muted" style={{ fontSize: '0.78rem', margin: '0 0 8px' }}>
            {backlotStatus.note}
            {backlotStatus.running ? ` · ${backlotStatus.projectCount ?? 0} project(s) on board` : ''}
          </p>
        )}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
          <button type="button" className="btn primary" onClick={() => openBacklot(backlotProjectId)}>
            Open Backlot {backlotProjectId ? `(${backlotProjectId})` : ''}
          </button>
          <button type="button" className="btn" onClick={() => openBacklot(null)}>
            All projects
          </button>
        </div>
        {backlotBoard?.stages?.length ? (
          <ol className="ivs-backlot-rail">
            {backlotBoard.stages.map((s) => (
              <li key={s.name} className={`ivs-backlot-stage is-${s.status || 'pending'}`}>
                <span className="stage-dot" aria-hidden />
                <span>{s.name.replace(/_/g, ' ')}</span>
                <span className="muted">{s.status || 'pending'}</span>
              </li>
            ))}
          </ol>
        ) : (
          <p className="muted" style={{ fontSize: '0.78rem', margin: 0 }}>
            Run a pipeline to create a Backlot project, or open the board to watch existing OpenMontage productions.
          </p>
        )}
      </section>

      <section className="imperial-video-studio-pipelines">
        <h3>Pipeline</h3>
        <div className="imperial-video-studio-pipeline-grid">
          {pipelines.length === 0 && !configLoading && (
            <p className="muted">No pipelines loaded yet. Use Retry above or check API connections in Settings.</p>
          )}
          {pipelines.map((p) => (
            <button
              key={p.id}
              type="button"
              className={`imperial-video-studio-pipeline-card ${selectedPipeline === p.id ? 'is-selected' : ''}`}
              onClick={() => setSelectedPipeline(p.id)}
            >
              <span className={`stability is-${p.stability}`}>{p.stability}</span>
              <strong>{p.label}</strong>
              <span className="muted">{p.bestFor}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="imperial-video-studio-brief">
        <label htmlFor="ivs-brief">Brief — your video topic (not the reference analysis)</label>
        {suggestedBrief && !briefReady && (
          <div className="imperial-video-studio-suggested-brief">
            <span className="muted">Suggested: {suggestedBrief}</span>
            <button type="button" className="btn" onClick={() => setBrief(suggestedBrief)}>
              Use suggested brief
            </button>
          </div>
        )}
        {looksLikeReferenceAnalysis(brief) && (
          <p className="error" style={{ marginBottom: 8 }}>
            Brief looks like reference analysis. Describe your topic (product, audience, message) before running the pipeline.
          </p>
        )}
        {!briefReady && !looksLikeReferenceAnalysis(brief) && brief.trim().length > 0 && (
          <p className="error" style={{ marginBottom: 8 }}>
            Brief is too short — add at least a sentence about your topic and audience.
          </p>
        )}
        <textarea
          id="ivs-brief"
          className="input"
          rows={3}
          placeholder="Make a 60-second explainer about your product for LinkedIn…"
          value={brief}
          onChange={(e) => setBrief(e.target.value)}
        />
        <div id="ivs-run-pipeline" className="imperial-video-studio-run-row">
          <button
            type="button"
            className="btn primary"
            disabled={pipelineBusy || !briefReady}
            title={!briefReady ? 'Enter a topic brief (or use suggested brief) before running' : undefined}
            onClick={() => runPipeline(false)}
          >
            {pipelineBusy ? 'Running…' : 'Run full pipeline'}
          </button>
          <button type="button" className="btn" disabled={pipelineBusy} onClick={() => runPipeline(true)}>
            Quick preview
          </button>
          {!briefReady && (
            <span className="muted" style={{ fontSize: '0.82rem', alignSelf: 'center' }}>
              Add a topic brief before full pipeline run
            </span>
          )}
          {job?.status === 'running' && (
            <span className="muted" style={{ fontSize: '0.82rem', alignSelf: 'center' }}>
              Pipeline running — watch Production board below
            </span>
          )}
        </div>
      </section>

      {(showHistory || storyboard.length > 0) && (
        <section className="imperial-video-studio-board">
          <h3>Production board</h3>
          <p className="muted">
            Stages light up as the agent runs. Approval gates are ready for your review before paid asset generation — expand a stage to preview output.
          </p>
          <ol className="imperial-video-studio-stage-flow">
            {stages.map((s) => {
              const live = storyboard.find((b) => b.stage === s.id);
              const preview = stagePreview(s.id);
              const gate = live?.gate || (s.approval ? 'review_ready' : 'auto');
              const needsReview = s.approval && live?.status === 'done' && !reviewedGates[s.id];
              return (
                <li key={s.id} className={`imperial-video-studio-stage is-${live?.status || 'pending'} ${s.approval ? 'needs-approval' : ''}`}>
                  <span className="stage-dot" aria-hidden />
                  <div className="imperial-video-studio-stage-body">
                    <div className="imperial-video-studio-stage-head">
                      <strong>{s.label}</strong>
                      {live && <span className="stage-gate">{formatStageGate(reviewedGates[s.id] && s.approval ? 'approved' : gate)}</span>}
                      {s.approval && <span className="stage-approval-badge">Approval gate</span>}
                    </div>
                    {preview && (
                      <>
                        <button
                          type="button"
                          className="imperial-video-studio-stage-toggle"
                          onClick={() => setExpandedStage((id) => (id === s.id ? null : s.id))}
                        >
                          {expandedStage === s.id ? 'Hide stage output' : 'View stage output'}
                        </button>
                        {expandedStage === s.id && (
                          <pre className="imperial-video-studio-stage-preview">{preview}</pre>
                        )}
                      </>
                    )}
                    {needsReview && (
                      <button
                        type="button"
                        className="btn"
                        style={{ marginTop: 6 }}
                        onClick={() => setReviewedGates((g) => ({ ...g, [s.id]: true }))}
                      >
                        Mark reviewed
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>
          {job?.deliverable && job.status === 'complete' && (
            <div className="imperial-video-studio-deliverable">
              <h4>Deliverable preview</h4>
              <pre>{formatDeliverablePreview(job.deliverable).slice(0, 1400)}{job.deliverable.length > 1400 ? '…' : ''}</pre>
              <div className="imperial-video-studio-publish-row" style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
                <button type="button" className="btn primary" disabled={running} onClick={() => queueComposition()}>
                  Queue composition
                </button>
                <button type="button" className="btn" onClick={() => goPublish('/content-hub?tab=media', 'Create · Media')}>
                  Attach clips (Media)
                </button>
                <button type="button" className="btn" onClick={() => goPublish('/content-hub?tab=compose', 'Compose & Publish')}>
                  Compose &amp; Publish
                </button>
                <Link href="/calendar" className="btn">Schedule on Calendar</Link>
              </div>
              {composeMsg && <p className="muted" style={{ marginTop: 8, marginBottom: 0 }}>{composeMsg}</p>}
            </div>
          )}
          {job?.status === 'error' && job.error && (
            <p className="error">{job.error}</p>
          )}
        </section>
      )}
    </div>
  );
}