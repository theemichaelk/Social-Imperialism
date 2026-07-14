'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { invoke } from '@/lib/api';
import { executeLiveSupportAction } from '@/lib/liveSupportActions';
import { PromptVaultPicker, type VaultPrompt } from '@/components/PromptVaultPicker';
import { briefFromVaultLoad } from '@/lib/promptVaultGallery';

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
  chatVsBacklot?: string;
  features?: string[];
  cli?: string[];
  readme?: string;
  projects?: Array<{ project_id?: string; title?: string; live?: boolean }>;
};

type BacklotBoardState = {
  project_id?: string;
  title?: string;
  live?: boolean;
  stages?: Array<{
    name: string;
    status?: string;
    gated?: boolean;
    review?: { summary?: string };
    cost_snapshot?: { total_spent_usd?: number };
  }>;
  storyboard?: Array<{ scene_id?: string; status?: string }>;
  cost?: { total_spent_usd?: number };
  events?: Array<{ tool?: string; event?: string; scene_id?: string }>;
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
  const [backlotSimMsg, setBacklotSimMsg] = useState('');
  const [setupMsg, setSetupMsg] = useState('');
  const [showPrereqs, setShowPrereqs] = useState(false);

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
      if (res?.state) {
        setBacklotBoard(res.state as BacklotBoardState);
      } else if (res && Array.isArray((res as BacklotBoardState).stages)) {
        setBacklotBoard(res as unknown as BacklotBoardState);
      }
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

  const isLocalOnlyBoardUrl = (url?: string | null) =>
    !!url && (/^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?\//i.test(url) || url.includes('127.0.0.1'));

  const openBacklot = async (projectId?: string | null) => {
    try {
      const res = await invoke<{
        success?: boolean;
        boardUrl?: string;
        boardLocalOnly?: boolean;
        error?: string;
        message?: string;
      }>('open-backlot-board', {
        projectId: projectId || backlotProjectId || undefined,
      });
      if (res.error) {
        setComposeMsg(res.error);
        return;
      }
      // SaaS: Backlot binds to the API host loopback — open only when URL is browser-reachable.
      if (res.boardUrl && typeof window !== 'undefined' && !isLocalOnlyBoardUrl(res.boardUrl) && !res.boardLocalOnly) {
        window.open(res.boardUrl, '_blank', 'noopener,noreferrer');
      } else {
        setComposeMsg(res.message || 'Backlot runs on the API host. Use the stage rail below (desktop opens the full board).');
        const pid = projectId || backlotProjectId;
        if (pid) refreshBacklotBoard(pid);
      }
    } catch (e) {
      setComposeMsg((e as Error).message || 'Could not open Backlot.');
    }
  };

  const runBacklotSimulate = async () => {
    setBacklotSimMsg('');
    setRunning(true);
    try {
      const res = await invoke<{
        success?: boolean;
        projectId?: string;
        boardUrl?: string;
        boardLocalOnly?: boolean;
        message?: string;
        error?: string;
        method?: string;
      }>(
        'run-backlot-simulate',
        { projectId: 'backlot-demo-run', openBoard: true, fast: true },
      );
      if (res.error && res.success === false) {
        setBacklotSimMsg(res.error);
        return;
      }
      if (res.projectId) setBacklotProjectId(res.projectId);
      const methodNote = res.method === 'si-native' ? ' (SI fallback)' : '';
      setBacklotSimMsg(
        (res.message || 'Simulated run written to disk.') + methodNote + ' Stage rail updates below.',
      );
      if (res.boardUrl && typeof window !== 'undefined' && !isLocalOnlyBoardUrl(res.boardUrl) && !res.boardLocalOnly) {
        window.open(res.boardUrl, '_blank', 'noopener,noreferrer');
      }
      if (res.projectId) await refreshBacklotBoard(res.projectId);
    } catch (e) {
      setBacklotSimMsg((e as Error).message || 'Simulate run failed.');
    } finally {
      setRunning(false);
    }
  };

  const approveBacklotGate = async (stageId: string) => {
    try {
      const res = await invoke<{ success?: boolean; error?: string; stage?: string }>(
        'approve-imperial-video-gate',
        {
          stage: stageId,
          stageId,
          gateId: stageId,
          projectId: backlotProjectId || undefined,
        },
      );
      if (res?.error && res.success === false) {
        setComposeMsg(res.error);
        return;
      }
      setReviewedGates((g) => ({ ...g, [stageId]: true }));
      if (backlotProjectId) refreshBacklotBoard(backlotProjectId);
    } catch (e) {
      setComposeMsg((e as Error).message || 'Could not approve gate.');
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

  const runOpenMontageSetup = async () => {
    setSetupMsg('');
    setRunning(true);
    try {
      const res = await invoke<{ success?: boolean; error?: string; stdout?: string; method?: string }>('run-openmontage-setup');
      if (res.error) {
        setSetupMsg(res.error);
        return;
      }
      setSetupMsg(res.success ? `Setup complete (${res.method || 'make setup'}). Refresh status below.` : 'Setup finished with warnings.');
      await refresh();
    } catch (e) {
      setSetupMsg((e as Error).message || 'OpenMontage setup failed — run deploy/setup-openmontage.ps1 locally.');
    } finally {
      setRunning(false);
    }
  };

  const applyExampleBrief = (text: string, pipeline?: string) => {
    setBrief(text);
    if (pipeline) setSelectedPipeline(pipeline);
  };

  const loadVaultBrief = (text: string, prompt?: VaultPrompt) => {
    const core = briefFromVaultLoad(text, prompt);
    applyExampleBrief(core, prompt?.pipeline || undefined);
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

      <section className="ivs-prereqs card">
        <button type="button" className="ivs-prereqs-toggle" onClick={() => setShowPrereqs((s) => !s)}>
          {showPrereqs ? 'Hide' : 'Show'} Prerequisites &amp; Install (OpenMontage)
        </button>
        {showPrereqs && (
          <div className="ivs-prereqs-body">
            <h4>Prerequisites</h4>
            <ul className="muted ivs-prereqs-list">
              <li><strong>Python 3.10+</strong> — <a href="https://www.python.org/" target="_blank" rel="noopener noreferrer">python.org</a></li>
              <li><strong>FFmpeg</strong> — <code>brew install ffmpeg</code> / <code>sudo apt install ffmpeg</code> / <a href="https://ffmpeg.org/" target="_blank" rel="noopener noreferrer">ffmpeg.org</a> / <code>winget install Gyan.FFmpeg</code></li>
              <li><strong>Node.js 18+</strong> — <a href="https://nodejs.org/" target="_blank" rel="noopener noreferrer">nodejs.org</a></li>
              <li><strong>AI coding assistant</strong> — Claude Code, Cursor, Copilot, Windsurf, or Codex (reads <code>brain/skills/video-studio/</code>)</li>
            </ul>
            <h4>Install &amp; run</h4>
            <p className="muted" style={{ fontSize: '0.8rem', margin: '0 0 8px' }}>
              Standalone OpenMontage (official):
            </p>
            <pre className="ivs-backlot-cli">{`git clone https://github.com/calesthio/OpenMontage.git
cd OpenMontage
make setup`}</pre>
            <p className="muted" style={{ fontSize: '0.8rem', margin: '0 0 4px' }}>
              <strong>No make?</strong> macOS / Linux (inside <code>OpenMontage</code> or <code>vendor/OpenMontage</code>):
            </p>
            <pre className="ivs-backlot-cli">{`python3 -m venv .venv && source .venv/bin/activate && python -m pip install -r requirements.txt && cd remotion-composer && npm install && cd .. && python -m pip install piper-tts && cp .env.example .env`}</pre>
            <p className="muted" style={{ fontSize: '0.8rem', margin: '0 0 4px' }}>
              <strong>No make?</strong> Windows PowerShell (inside <code>OpenMontage</code> or <code>vendor\OpenMontage</code>):
            </p>
            <pre className="ivs-backlot-cli">{`py -3 -m venv .venv; .\\.venv\\Scripts\\Activate.ps1; python -m pip install -r requirements.txt; cd remotion-composer; npm install; cd ..; python -m pip install piper-tts; Copy-Item .env.example .env`}</pre>
            <p className="muted" style={{ fontSize: '0.78rem', margin: '0 0 8px' }}>
              <strong>Windows:</strong> If <code>npm install</code> fails with <code>ERR_INVALID_ARG_TYPE</code>, use{' '}
              <code>npx --yes npm install</code> instead (still inside <code>remotion-composer</code>).
            </p>
            <p className="muted" style={{ fontSize: '0.8rem', margin: '0 0 8px' }}>
              Social Imperialism wrappers (same result):
            </p>
            <pre className="ivs-backlot-cli">{`# macOS / Linux
bash deploy/setup-openmontage.sh

# Windows
powershell -File deploy/setup-openmontage.ps1`}</pre>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', margin: '8px 0' }}>
              <button type="button" className="btn" disabled={running} onClick={runOpenMontageSetup}>
                Run setup (local API / desktop)
              </button>
            </div>
            {setupMsg && <p className="muted" style={{ fontSize: '0.78rem', margin: '0 0 8px' }}>{setupMsg}</p>}
            <h4>What you get with zero API keys</h4>
            <p className="muted" style={{ fontSize: '0.8rem', margin: '0 0 8px' }}>
              You don&apos;t need paid API keys to make real videos. After <code>make setup</code> (or the manual one-liner),
              OpenMontage gives you a full free floor — add keys later to unlock cloud gen.
            </p>
            <table className="ivs-zero-keys-table muted">
              <thead>
                <tr>
                  <th>Capability</th>
                  <th>Free tool</th>
                  <th>What it does</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Narration</td>
                  <td>Piper TTS</td>
                  <td>Offline text-to-speech — human-sounding narration</td>
                </tr>
                <tr>
                  <td>Open footage</td>
                  <td>Archive.org + NASA + Wikimedia</td>
                  <td>Free archival footage, educational media, documentary texture</td>
                </tr>
                <tr>
                  <td>Extra stock</td>
                  <td>Pexels + Unsplash + Pixabay</td>
                  <td>Free stock footage/images (developer keys are free to get)</td>
                </tr>
                <tr>
                  <td>Composition (React)</td>
                  <td>Remotion</td>
                  <td>Spring-animated scenes, text/stat cards, charts, word-level captions, TalkingHead</td>
                </tr>
                <tr>
                  <td>Composition (HTML/GSAP)</td>
                  <td>HyperFrames</td>
                  <td>Kinetic type, product promos, launch reels, registry blocks, website-to-video, SVG character rigs</td>
                </tr>
                <tr>
                  <td>Post-production</td>
                  <td>FFmpeg</td>
                  <td>Encoding, subtitle burn-in, audio mixing, color grading</td>
                </tr>
                <tr>
                  <td>Subtitles</td>
                  <td>Built-in</td>
                  <td>Auto-generated captions with word-level timing</td>
                </tr>
              </tbody>
            </table>
            <p className="muted" style={{ fontSize: '0.78rem', margin: '0.65rem 0 8px' }}>
              OpenMontage picks <strong>Remotion</strong> vs <strong>HyperFrames</strong> at proposal time (locked as{' '}
              <code>render_runtime</code>). Remotion is the default for data-driven explainers and the React scene stack;
              HyperFrames for motion-graphics-heavy briefs and character-animation SVG/GSAP output. See{' '}
              <code>vendor/OpenMontage/skills/core/hyperframes.md</code> for the decision matrix.
            </p>
            <p className="muted" style={{ fontSize: '0.78rem', margin: '0 0 6px' }}>
              <strong>Two free-ish paths:</strong> (1) <em>zero-key</em> — Piper + public-domain stock + Remotion/HyperFrames + FFmpeg;
              (2) <em>free developer keys</em> — Pexels / Pixabay / Unsplash for larger stock libraries (no paid subscription).
            </p>
            <ul className="muted ivs-prereqs-list" style={{ fontSize: '0.78rem', margin: '0 0 8px' }}>
              <li>
                <strong>Image-based video</strong> — Piper narrates your script, images provide the visuals, and Remotion animates them into a polished edit.
              </li>
              <li>
                <strong>Local character animation</strong> — SVG rigs, pose libraries, GSAP timelines, and HyperFrames render cartoon character acting to{' '}
                <code>projects/&lt;project-name&gt;/renders/final.mp4</code>.
              </li>
              <li>
                <strong>Real-footage video</strong> — the documentary montage pipeline builds a CLIP-searchable corpus from Archive.org, NASA, Wikimedia Commons,
                and optional free-key sources (Pexels, Unsplash), then cuts actual motion footage into a finished video.
              </li>
            </ul>
            <p className="muted" style={{ fontSize: '0.78rem', margin: '0 0 12px' }}>
              For real footage, prompt for a <em>documentary montage</em>, <em>tone poem</em>, or <em>stock-footage collage</em>, and explicitly say{' '}
              <strong>use real footage only</strong>.
            </p>
            <h4>Supported providers</h4>
            <p className="muted" style={{ fontSize: '0.8rem', margin: '0 0 8px' }}>
              OpenMontage integrates <strong>14 video</strong>, <strong>10 image</strong>, and <strong>4 TTS</strong> providers plus Suno/ElevenLabs music,
              free stock (Pexels, Pixabay, Wikimedia), local GPU gen, and Remotion/HyperFrames compose.
              Agent preflight uses <code>provider_menu_summary()</code> — scored 7-dimension provider selection.
              Full tables + pricing: <Link href="/prompt-vault">Prompt Vault</Link> → <em>Supported providers</em> or{' '}
              <a href="https://github.com/calesthio/OpenMontage/blob/main/docs/PROVIDERS.md" target="_blank" rel="noopener noreferrer">docs/PROVIDERS.md</a>.
              Style playbooks: Vault → <em>Style system</em> or table below.
            </p>
            <h4>Style system — playbooks</h4>
            <p className="muted" style={{ fontSize: '0.8rem', margin: '0 0 8px' }}>
              Playbooks define typography, palettes, motion, and audio rules. Request one in your brief — e.g. &quot;Use Clean Professional playbook.&quot;
            </p>
            <table className="ivs-zero-keys-table ivs-style-playbooks-table muted">
              <thead>
                <tr>
                  <th scope="col">Playbook</th>
                  <th scope="col">Best for</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Clean Professional</td>
                  <td>Corporate, educational, SaaS</td>
                </tr>
                <tr>
                  <td>Flat Motion Graphics</td>
                  <td>Social media, TikTok, startups</td>
                </tr>
                <tr>
                  <td>Minimalist Diagram</td>
                  <td>Technical deep-dives, architecture</td>
                </tr>
                <tr>
                  <td>Premium Minimalist</td>
                  <td>High-end product, luxury brand films</td>
                </tr>
                <tr>
                  <td>Anime Ghibli</td>
                  <td>Ghibli-style illustration, warm fantasy atmospheres</td>
                </tr>
              </tbody>
            </table>
            <p className="muted" style={{ fontSize: '0.78rem', margin: '0.65rem 0 8px' }}>
              Files: <code>vendor/OpenMontage/styles/*.yaml</code>
            </p>
            <h4>Platform output profiles</h4>
            <p className="muted" style={{ fontSize: '0.8rem', margin: '0 0 8px' }}>
              Built-in render targets — specify in your brief to lock aspect ratio at proposal. Full reference:{' '}
              <Link href="/prompt-vault">Prompt Vault</Link> → <em>Platform output profiles</em>.
            </p>
            <table className="ivs-zero-keys-table ivs-platform-profiles-table muted">
              <thead>
                <tr>
                  <th scope="col">Profile</th>
                  <th scope="col">Resolution</th>
                  <th scope="col">Aspect</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>YouTube Landscape</td>
                  <td>1920×1080</td>
                  <td>16:9</td>
                </tr>
                <tr>
                  <td>YouTube 4K</td>
                  <td>3840×2160</td>
                  <td>16:9</td>
                </tr>
                <tr>
                  <td>YouTube Shorts</td>
                  <td>1080×1920</td>
                  <td>9:16</td>
                </tr>
                <tr>
                  <td>Instagram Reels</td>
                  <td>1080×1920</td>
                  <td>9:16</td>
                </tr>
                <tr>
                  <td>Instagram Feed</td>
                  <td>1080×1080</td>
                  <td>1:1</td>
                </tr>
                <tr>
                  <td>TikTok</td>
                  <td>1080×1920</td>
                  <td>9:16</td>
                </tr>
                <tr>
                  <td>LinkedIn</td>
                  <td>1920×1080</td>
                  <td>16:9</td>
                </tr>
                <tr>
                  <td>Cinematic</td>
                  <td>2560×1080</td>
                  <td>21:9</td>
                </tr>
              </tbody>
            </table>
            <h4>Production governance</h4>
            <p className="muted" style={{ fontSize: '0.8rem', margin: '0 0 8px' }}>
              OpenMontage enforces quality like engineering — not suggestions. Gates pause on proposal, script, scene plan, assets, and publish;
              checkpoint writer rejects completed gated stages without approval. Review on the Production board below or Backlot.
            </p>
            <ul className="muted ivs-prereqs-list" style={{ fontSize: '0.78rem', margin: '0 0 8px' }}>
              <li>
                <strong>Pre-compose validation</strong> — blocks render if delivery promise is violated, slideshow risk is critical, or renderer is missing.
              </li>
              <li>
                <strong>Post-render self-review</strong> — ffprobe, frame samples, audio levels, subtitle check; failed review hides the output.
              </li>
              <li>
                <strong>Slideshow risk</strong> — 6-dimension score prevents animated PowerPoint outputs.
              </li>
              <li>
                <strong>Scored provider selection</strong> — 7-dimension engine; decisions logged with alternatives.
              </li>
              <li>
                <strong>Budget controls</strong> — estimate, reserve, reconcile; default $10 cap, $0.50 per-action approval threshold.
              </li>
            </ul>
            <p className="muted" style={{ fontSize: '0.78rem', margin: '0 0 12px' }}>
              Vault reference: <Link href="/prompt-vault">Production governance</Link> · <em>Agent compatibility</em> · <em>Contributing</em>.
            </p>
            <h4>Add API keys (optional — more keys = more tools)</h4>
            <p className="muted" style={{ fontSize: '0.8rem', margin: '0 0 8px' }}>
              <code>.env</code> — every key is optional; add what you have to unlock cloud image/video gen, premium voice, and AI music.
            </p>
            <p className="muted" style={{ fontSize: '0.8rem', margin: '0 0 8px' }}>
              <strong>Two places to configure:</strong>{' '}
              <Link href="/integrations">Settings → Integrations</Link> (desktop API syncs into OpenMontage), or{' '}
              <code>vendor/OpenMontage/.env</code> (see <code>.env.example</code> — put your key before any inline <code>#</code> comment).
            </p>
            <ul className="muted ivs-prereqs-list" style={{ fontSize: '0.8rem', margin: '0 0 8px' }}>
              <li><strong>FAL_KEY</strong> — FLUX images, Kling / Veo / MiniMax video, Recraft (<a href="https://fal.ai/dashboard/keys" target="_blank" rel="noopener noreferrer">fal.ai</a>)</li>
              <li><strong>GOOGLE_API_KEY</strong> — Google Imagen images, Google TTS (700+ voices) (<a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener noreferrer">AI Studio</a>)</li>
              <li><strong>ELEVENLABS_API_KEY</strong> — premium TTS, AI music, sound effects (<a href="https://elevenlabs.io" target="_blank" rel="noopener noreferrer">elevenlabs.io</a>)</li>
              <li><strong>OPENAI_API_KEY</strong> — OpenAI TTS, GPT Image 2 images, Sora video</li>
              <li><strong>XAI_API_KEY</strong> — Grok image edits/generation + Grok video</li>
              <li><strong>HEYGEN_API_KEY</strong> — VEO, Sora, Runway, Kling via single gateway</li>
              <li><strong>RUNWAY_API_KEY</strong> — Runway Gen-4 direct</li>
              <li><strong>VIDEO_GEN_LOCAL_ENABLED=true</strong> — free local video gen with a GPU (<code>diffusers</code> stack)</li>
              <li><strong>PEXELS_API_KEY</strong> / <strong>PIXABAY_API_KEY</strong> / <strong>UNSPLASH_ACCESS_KEY</strong> — stock footage &amp; stills (free tiers)</li>
            </ul>
            <p className="muted" style={{ fontSize: '0.78rem', margin: '0 0 4px' }}>Re-check what unlocked (inside <code>vendor/OpenMontage</code>, venv active):</p>
            <pre className="ivs-backlot-cli" style={{ margin: '0 0 12px' }}>{`python -c "from tools.tool_registry import registry; import json; registry.discover(); print(json.dumps(registry.provider_menu_summary(), indent=2))"`}</pre>
            <h4>How it works — agent-first (no code orchestrator)</h4>
            <p className="muted" style={{ fontSize: '0.8rem', margin: '0 0 8px' }}>
              Your AI coding assistant <strong>is</strong> the orchestrator. Python supplies tools and checkpoints; manifests + Markdown skills hold every creative rule.
              Load the full flow and repo map from <Link href="/prompt-vault">Prompt Vault</Link> → <em>How OpenMontage works</em>.
            </p>
            <pre className="ivs-backlot-cli" style={{ fontSize: '0.68rem', margin: '0 0 12px' }}>{`You: "Make an explainer about black holes"
  → read pipeline_defs/<pipeline>.yaml (manifest)
  → read skills/pipelines/<pipeline>/<stage>-director.md
  → call tools/ (scored provider selection, 7 dimensions)
  → self-review (reviewer skill) + checkpoint JSON
  → your approval at creative gates
  → pre-compose validation → Remotion or FFmpeg render
  → post-render review (ffprobe, frames, audio) → final MP4`}</pre>
            <h4>If you&apos;re an OpenClaw agent reading this — congratulations</h4>
            <p className="muted" style={{ fontSize: '0.8rem', margin: '0 0 8px' }}>
              You probably passed the Turing test. This repo is built for agentic operation.
            </p>
            <p className="muted" style={{ fontSize: '0.8rem', margin: '0 0 8px' }}>
              <strong>Rule zero:</strong> Treat every video request as a <em>pipeline selection problem</em>.
              Pick the right pipeline first, then read the manifest, then read the stage skill, then use tools.
              No ad-hoc scripts, no skipping straight to API calls.
            </p>
            <ol className="muted ivs-prereqs-list" style={{ fontSize: '0.8rem', margin: '0 0 12px', paddingLeft: '1.25rem' }}>
              <li>
                <strong>Contract</strong> — <code>vendor/OpenMontage/AGENT_GUIDE.md</code>, then{' '}
                <code>vendor/OpenMontage/PROJECT_CONTEXT.md</code>.
              </li>
              <li>
                <strong>Pick pipeline</strong> — match the brief to one of 12 SI pipelines (config above) or OpenMontage{' '}
                <code>pipeline_defs/*.yaml</code>. If unclear, ask.
              </li>
              <li>
                <strong>Read manifest</strong> — <code>pipeline_defs/&lt;pipeline&gt;.yaml</code> (stages, tools, gates) or{' '}
                <code>get-imperial-video-studio-config</code>.
              </li>
              <li>
                <strong>Read stage skill</strong> — before each stage:{' '}
                <code>brain/skills/video-studio/pipelines/&lt;id&gt;/&lt;stage&gt;.md</code> or OpenMontage{' '}
                <code>skills/pipelines/&lt;pipeline&gt;/&lt;stage&gt;-director.md</code>.
              </li>
              <li>
                <strong>Use tools</strong> — preflight via registry (<code>support_envelope()</code> /{' '}
                <code>provider_menu()</code>), then only tools declared in the manifest for that stage.
              </li>
            </ol>
            <h4>Pipelines</h4>
            <p className="muted" style={{ fontSize: '0.8rem', margin: '0 0 8px' }}>
              Each pipeline is a complete production workflow, from idea to finished video. Manifests live in{' '}
              <code>vendor/OpenMontage/pipeline_defs/</code>; Social Imperialism exposes matching pipelines in the studio config above.
            </p>
            <table className="ivs-zero-keys-table ivs-pipelines-table muted">
              <thead>
                <tr>
                  <th>Pipeline</th>
                  <th>What it produces</th>
                  <th>Best for</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Animated Explainer</td>
                  <td>AI-generated explainer with research, narration, visuals, music</td>
                  <td>Educational content, tutorials, topic breakdowns</td>
                </tr>
                <tr>
                  <td>Animation</td>
                  <td>Motion graphics, kinetic typography, animated sequences</td>
                  <td>Social media, product demos, abstract concepts</td>
                </tr>
                <tr>
                  <td>Avatar Spokesperson</td>
                  <td>Avatar-driven presenter videos</td>
                  <td>Corporate comms, training, announcements</td>
                </tr>
                <tr>
                  <td>Cinematic</td>
                  <td>Trailer, teaser, and mood-driven edits</td>
                  <td>Brand films, teasers, promotional content</td>
                </tr>
                <tr>
                  <td>Clip Factory</td>
                  <td>Batch of ranked short-form clips from one long source</td>
                  <td>Repurposing long content for social media</td>
                </tr>
                <tr>
                  <td>Documentary Montage</td>
                  <td>Thematic montage from a CLIP-indexed corpus of free stock and open archives (Pexels, Archive.org, NASA, Wikimedia, Unsplash)</td>
                  <td>Video essays, mood pieces, retrieval-first B-roll, real-footage without paid gen APIs</td>
                </tr>
                <tr>
                  <td>Hybrid</td>
                  <td>Source footage + AI-generated support visuals</td>
                  <td>Enhancing existing footage with graphics</td>
                </tr>
                <tr>
                  <td>Localization &amp; Dub</td>
                  <td>Subtitle, dub, and translate existing video</td>
                  <td>Multi-language distribution</td>
                </tr>
                <tr>
                  <td>Podcast Repurpose</td>
                  <td>Podcast highlights to video</td>
                  <td>Podcast marketing, audiogram videos</td>
                </tr>
                <tr>
                  <td>Screen Demo</td>
                  <td>Polished software screen recordings and walkthroughs</td>
                  <td>Product demos, tutorials, documentation</td>
                </tr>
                <tr>
                  <td>Talking Head</td>
                  <td>Footage-led speaker videos</td>
                  <td>Presentations, vlogs, interviews</td>
                </tr>
              </tbody>
            </table>
            <p className="muted" style={{ fontSize: '0.78rem', margin: '0.5rem 0 4px' }}>Every pipeline follows the same structured flow:</p>
            <pre className="ivs-backlot-cli" style={{ margin: '0 0 8px', fontSize: '0.72rem' }}>{`research -> proposal -> script -> scene_plan -> assets -> edit -> compose`}</pre>
            <p className="muted" style={{ fontSize: '0.78rem', margin: '0 0 8px' }}>
              Each stage has a dedicated <strong>director skill</strong> — a markdown file in{' '}
              <code>skills/pipelines/&lt;pipeline&gt;/&lt;stage&gt;-director.md</code> (or{' '}
              <code>brain/skills/video-studio/pipelines/&lt;id&gt;/&lt;stage&gt;.md</code> in SI). The agent reads the skill,
              uses tools, self-reviews, checkpoints state, and asks for human approval at creative gates.
            </p>
            <p className="muted" style={{ fontSize: '0.78rem', margin: '0 0 12px', paddingLeft: '0.65rem', borderLeft: '2px solid var(--accent3)' }}>
              <strong>Web research is a first-class stage.</strong> Before script, the agent searches YouTube, Reddit, Hacker News,
              news sites, and academic sources — data points, audience questions, trending angles, visual references — cited in a
              structured research brief. Videos are grounded in real, current information, not hallucinated facts.
            </p>
            <h4>Prompt Gallery (Vault)</h4>
            <p className="muted" style={{ fontSize: '0.8rem', margin: '0 0 8px' }}>
              OpenMontage-tested prompts live in <Link href="/prompt-vault">Prompt Vault</Link> under{' '}
              <strong>Imperial Video Studio</strong> — zero-key demos, explainers, FAL/anime, HyperFrames, broadcast quality (Veo/Kling + ElevenLabs + Suno), audience-specific briefs, and tips.
              Load one into your brief below, or copy into your AI coding assistant after <code>make setup</code>.
            </p>
            <h4>Try these prompts</h4>
            <p className="muted" style={{ fontSize: '0.8rem', margin: '0 0 8px' }}>
              Quick-fill buttons for common starts. For the full gallery (36 templates — prompts, providers, styles, governance, architecture, tips), use{' '}
              <strong>Prompt Vault</strong> on the brief. Reference workflows: paste URL in{' '}
              <strong>Start From A Video You Already Love</strong> first.
            </p>
            <p className="ivs-prompt-tier">Start from a reference video</p>
            <div className="ivs-example-briefs">
              <button type="button" className="btn" onClick={() => applyExampleBrief('Analyze this Reel and give me 3 original variants I could make for my own product launch.', 'kinetic-promo')}>
                Reel → 3 launch variants
              </button>
              <button type="button" className="btn" onClick={() => applyExampleBrief('I like the pacing and hook in this video. Keep that energy, but turn it into a 45-second explainer about black holes.', 'social-explainer')}>
                Reference pacing → black holes
              </button>
              <button type="button" className="btn" onClick={() => applyExampleBrief(`Here's a YouTube short I love. Make me something like this, but about CRISPR for high school students.`, 'social-explainer')}>
                YouTube short → CRISPR
              </button>
            </div>
            <p className="ivs-prompt-tier">Zero keys needed</p>
            <div className="ivs-example-briefs">
              <button type="button" className="btn" onClick={() => applyExampleBrief('Make a 45-second animated explainer about why the sky is blue', 'social-explainer')}>
                Why the sky is blue
              </button>
              <button type="button" className="btn" onClick={() => applyExampleBrief('Create a 60-second video about the history of the internet, with narration and captions', 'social-explainer')}>
                History of the internet
              </button>
              <button type="button" className="btn" onClick={() => applyExampleBrief('Make a data-driven explainer about coffee consumption around the world', 'social-explainer')}>
                Coffee consumption data
              </button>
              <button type="button" className="btn" onClick={() => applyExampleBrief('Make a 90-second animated explainer about quantum computing for middle school students, with a fun narrator voice and custom soundtrack', 'social-explainer')}>
                Quantum computing (90s)
              </button>
              <button type="button" className="btn" onClick={() => applyExampleBrief('Make a 45-second character short: a curious robot discovers music for the first time. Cartoon SVG character, HyperFrames render.', 'character-short')}>
                Character short (HyperFrames)
              </button>
            </div>
            <p className="ivs-prompt-tier">Free real-footage documentary path</p>
            <div className="ivs-example-briefs">
              <button type="button" className="btn" onClick={() => applyExampleBrief('Make a 90-second documentary montage about what a city feels like at 4am. Use real footage only, no narration, elegiac tone.', 'stock-montage')}>
                City at 4am
              </button>
              <button type="button" className="btn" onClick={() => applyExampleBrief('Create a 60-second Adam-Curtis-style archival collage about 1950s consumer optimism. Prefer Archive.org and Wikimedia footage.', 'stock-montage')}>
                Adam Curtis archival
              </button>
              <button type="button" className="btn" onClick={() => applyExampleBrief('Cut together a dreamlike montage about coming home in the rain using real stock footage only. Music yes, narration no.', 'stock-montage')}>
                Coming home in the rain
              </button>
            </div>
            <p className="ivs-prompt-tier">With an image/video provider configured (~$0.15–$1.50)</p>
            <p className="muted ivs-prompt-tier-note">Needs <code>FAL_KEY</code> or similar — AI-generated visuals / motion clips.</p>
            <div className="ivs-example-briefs">
              <button type="button" className="btn" onClick={() => applyExampleBrief('Create a 30-second Ghibli-style animated video of a magical floating library in the clouds at golden hour', 'cinematic-teaser')}>
                Ghibli floating library
              </button>
              <button type="button" className="btn" onClick={() => applyExampleBrief('Make a 30-second anime-style animation of an underwater temple with bioluminescent coral and ancient ruins', 'cinematic-teaser')}>
                Anime underwater temple
              </button>
              <button type="button" className="btn" onClick={() => applyExampleBrief('Create an animated explainer about how CRISPR gene editing works, using AI-generated visuals', 'social-explainer')}>
                CRISPR (AI visuals)
              </button>
              <button type="button" className="btn" onClick={() => applyExampleBrief('Make a product launch teaser for a fictional smart water bottle called AquaPulse', 'kinetic-promo')}>
                AquaPulse launch teaser
              </button>
            </div>
            <p className="ivs-prompt-tier">Broadcast quality (~$1.50–$2.50)</p>
            <p className="muted ivs-prompt-tier-note">
              Veo, Kling, Runway motion clips + ElevenLabs TTS + Suno music — broadcast-quality output. See Prompt Vault for full deliverables.
            </p>
            <div className="ivs-example-briefs">
              <button type="button" className="btn" onClick={() => applyExampleBrief('Create a cinematic 30-second trailer for a sci-fi concept: humanity receives a warning from 1000 years in the future. Use motion video clips, a cinematic soundtrack, and dramatic title cards.', 'cinematic-teaser')}>
                Cinematic sci-fi trailer
              </button>
              <button type="button" className="btn" onClick={() => applyExampleBrief('Make a 90-second animated explainer about quantum computing for middle school students. Use a fun narrator voice, custom soundtrack, and AI-generated visuals of qubits and quantum gates.', 'social-explainer')}>
                Quantum explainer (premium)
              </button>
              <button type="button" className="btn" onClick={() => applyExampleBrief('Create a 60-second avatar spokesperson video announcing a company rebrand. Professional tone, clean background, with animated text overlays showing the new brand values.', 'avatar-presenter')}>
                Avatar spokesperson rebrand
              </button>
            </div>
            <p className="ivs-prompt-tier">For specific audiences</p>
            <div className="ivs-example-briefs">
              <button type="button" className="btn" onClick={() => applyExampleBrief('Create a 3-minute animated explainer about photosynthesis for 8th graders. Make it fun and visual — use diagrams, charts showing energy conversion, and a friendly narrator voice.', 'social-explainer')}>
                Teachers — photosynthesis
              </button>
              <button type="button" className="btn" onClick={() => applyExampleBrief('Make a 60-second product demo video for our new REST API. Show the request/response flow with animated diagrams, include latency benchmarks as bar charts, and end with a quick start code snippet.', 'social-explainer')}>
                Dev advocates — REST API
              </button>
              <button type="button" className="btn" onClick={() => applyExampleBrief('Create a 30-second Product Hunt launch video for my SaaS tool that helps teams track OKRs. Show 3 key features with animated stat cards and comparison views. Upbeat, modern.', 'kinetic-promo')}>
                Indie hackers — Product Hunt
              </button>
              <button type="button" className="btn" onClick={() => applyExampleBrief('Take my recent blog post about AI trends in 2026 and turn it into a 90-second video. Research current data to ground it, use animated charts for the statistics, and add a conversational narrator.', 'social-explainer')}>
                Creators — blog to video
              </button>
            </div>
            <p className="muted" style={{ fontSize: '0.78rem', margin: '0.85rem 0 0.35rem' }}>
              <strong>Tips:</strong> Name chart types (bar, donut, KPI grid), specify duration and audience, or say &quot;use only free tools&quot; for zero-key routing.
              Load <em>Tips for better video results</em> from Prompt Vault for the full checklist.
            </p>
            <p className="muted" style={{ fontSize: '0.78rem', margin: '0.85rem 0 0.35rem' }}>
              Want more? See the full{' '}
              <a href="https://github.com/calesthio/OpenMontage/blob/main/PROMPT_GALLERY.md" target="_blank" rel="noopener noreferrer">
                Prompt Gallery
              </a>{' '}
              for tested prompts with expected costs and output examples, or render zero-key demos instantly:
            </p>
            <pre className="ivs-backlot-cli" style={{ margin: '0 0 0', fontSize: '0.7rem' }}>{`# macOS / Linux (inside vendor/OpenMontage)
make demo
make demo-list

# Windows / no make
cd vendor/OpenMontage
.\\.venv\\Scripts\\Activate.ps1
python render_demo.py
python render_demo.py --list`}</pre>
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
        <p className="ivs-backlot-lead">
          {backlotStatus?.chatVsBacklot || 'Chat tells you what the agent said. Backlot shows you what the production is actually doing.'}
        </p>
        <p className="muted" style={{ fontSize: '0.82rem', margin: '0 0 10px' }}>
          A local board that fills itself in as the pipeline runs — stages light up, the script lands as a screenplay page,
          scene cards shimmer while assets generate, and every provider decision and dollar spent is on the wall.
          When a production starts, the agent opens Backlot for you automatically. No setup, no reporting — the board
          derives everything from the project files the pipeline already writes.
        </p>
        {backlotStatus?.features?.length ? (
          <ul className="ivs-backlot-features muted">
            {backlotStatus.features.map((f) => <li key={f}>{f}</li>)}
          </ul>
        ) : null}
        {backlotStatus && (
          <p className="muted" style={{ fontSize: '0.78rem', margin: '0 0 8px' }}>
            {backlotStatus.note}
            {backlotStatus.running ? ` · ${backlotStatus.projectCount ?? 0} production(s) in library` : ''}
            {backlotBoard?.live ? (
              <span className="badge is-ok" style={{ marginLeft: 8 }}>LIVE</span>
            ) : null}
          </p>
        )}
        <pre className="ivs-backlot-cli muted">
{(backlotStatus?.cli || [
  'python -m backlot open',
  'python -m backlot open <project-id>',
  'python scripts/backlot_simulate_run.py',
]).join('\n')}
        </pre>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
          <button type="button" className="btn primary" onClick={() => openBacklot(backlotProjectId)}>
            Open live board {backlotProjectId ? `(${backlotProjectId})` : ''}
          </button>
          <button type="button" className="btn" onClick={() => openBacklot(null)}>
            Library — all projects
          </button>
          <button type="button" className="btn" disabled={running} onClick={runBacklotSimulate}>
            Watch simulated run
          </button>
        </div>
        {backlotSimMsg && <p className="muted" style={{ fontSize: '0.78rem', margin: '0 0 8px' }}>{backlotSimMsg}</p>}
        {backlotBoard?.cost?.total_spent_usd != null && (
          <p className="muted" style={{ fontSize: '0.78rem', margin: '0 0 8px' }}>
            Spend on wall: <strong>${backlotBoard.cost.total_spent_usd.toFixed(2)}</strong>
            {backlotBoard.storyboard?.length ? ` · ${backlotBoard.storyboard.length} scene card(s)` : ''}
          </p>
        )}
        {backlotBoard?.stages?.filter((s) => s.status === 'awaiting_human').length ? (
          <div className="ivs-backlot-gates">
            <p className="muted" style={{ margin: '0 0 6px', fontSize: '0.78rem' }}>
              <strong>Creative gates</strong> — approve in chat or mark reviewed here before render:
            </p>
            {backlotBoard.stages.filter((s) => s.status === 'awaiting_human').map((s) => (
              <div key={s.name} className="ivs-backlot-gate-row">
                <span>{s.name.replace(/_/g, ' ')}</span>
                <span className="muted">{s.review?.summary || 'Awaiting approval'}</span>
                <button type="button" className="btn" onClick={() => approveBacklotGate(s.name)}>
                  Approve gate
                </button>
              </div>
            ))}
          </div>
        ) : null}
        {backlotBoard?.stages?.length ? (
          <ol className="ivs-backlot-rail">
            {backlotBoard.stages.map((s) => (
              <li
                key={s.name}
                className={`ivs-backlot-stage is-${s.status || 'pending'}${s.gated ? ' is-gated' : ''}`}
                title={s.review?.summary}
              >
                <span className="stage-dot" aria-hidden />
                <span>{s.name.replace(/_/g, ' ')}</span>
                <span className="muted">{s.status?.replace(/_/g, ' ') || 'pending'}</span>
              </li>
            ))}
          </ol>
        ) : (
          <p className="muted" style={{ fontSize: '0.78rem', margin: 0 }}>
            No production yet? Click <strong>Watch simulated run</strong> to see Backlot live (~1 min demo).
            Or run a full pipeline — Backlot opens automatically.
          </p>
        )}
        <p className="muted ivs-backlot-replay" style={{ fontSize: '0.72rem', margin: '10px 0 0' }}>
          When a run completes, hit <strong>▶ REPLAY RUN</strong> on the board — scrub the whole production end-to-end from timestamps.
          See <code>vendor/OpenMontage/backlot/README.md</code> for how it works.
        </p>
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
        <PromptVaultPicker feature="video-studio" onLoad={loadVaultBrief} compact limit={36} />
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
                        onClick={() => {
                          approveBacklotGate(s.id);
                          setReviewedGates((g) => ({ ...g, [s.id]: true }));
                        }}
                      >
                        Approve gate (Backlot + chat)
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