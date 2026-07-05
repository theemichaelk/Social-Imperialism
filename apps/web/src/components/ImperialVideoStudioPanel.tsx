'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { invoke } from '@/lib/api';
import { executeLiveSupportAction } from '@/lib/liveSupportActions';

type Pipeline = {
  id: string;
  label: string;
  stability: string;
  bestFor: string;
};

type StageFlow = { id: string; label: string; approval: boolean };

type StudioConfig = {
  pipelineCount: number;
  toolCount: number;
  skillCount: number;
  stageFlow: StageFlow[];
  pipelines: Pipeline[];
};

type StoryboardStage = {
  stage: string;
  label: string;
  status: string;
  gate: string;
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
  deliverable?: string;
  error?: string;
};

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
  const [referenceAnalysis, setReferenceAnalysis] = useState<string | null>(null);
  const [job, setJob] = useState<JobResult | null>(null);
  const [toolSummary, setToolSummary] = useState<string>('');
  const [running, setRunning] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [composeMsg, setComposeMsg] = useState('');
  const [brandName, setBrandName] = useState('Social Imperialism');

  const refresh = useCallback(async () => {
    setConfigLoading(true);
    setConfigError('');
    try {
      const [cfg, tools, result] = await Promise.all([
        invoke<StudioConfig>('get-imperial-video-studio-config'),
        invoke<{ toolCount: number; skillCount: number; capabilities: Array<{ name: string; configured: number; total: number }> }>('get-imperial-video-tool-registry').catch(() => null),
        invoke<JobResult>('get-imperial-video-pipeline-result').catch(() => null),
      ]);
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
      if (normalized) setJob(normalized);
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
    if (typeof window === 'undefined' || window.location.hash !== '#run') return;
    document.getElementById('ivs-run-pipeline')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, []);

  useEffect(() => {
    if (job?.status !== 'running') return undefined;
    const t = setInterval(() => {
      invoke<JobResult>('get-imperial-video-pipeline-result')
        .then((r) => {
          const normalized = normalizeJobResult(r);
          if (normalized) setJob(normalized);
        })
        .catch(() => { /* ignore */ });
    }, 2500);
    return () => clearInterval(t);
  }, [job?.status]);

  const analyzeReference = async () => {
    if (!referenceUrl.trim()) return;
    setRunning(true);
    try {
      const res = await invoke<{ analysis?: { pacing?: string; structure?: string }; concepts?: Array<{ title: string; angle: string }>; recommendedPipeline?: string }>(
        'analyze-reference-video',
        { url: referenceUrl.trim(), topic: brief.trim() || 'social growth' },
      );
      const lines = [
        res.analysis?.pacing && `Pacing: ${res.analysis.pacing}`,
        res.analysis?.structure && `Structure: ${res.analysis.structure}`,
        ...(res.concepts || []).map((c) => `• ${c.title}: ${c.angle}`),
        res.recommendedPipeline && `Recommended pipeline: ${res.recommendedPipeline}`,
      ].filter(Boolean);
      setReferenceAnalysis(lines.join('\n'));
      if (res.recommendedPipeline) setSelectedPipeline(res.recommendedPipeline);
    } catch (e) {
      setReferenceAnalysis((e as Error).message || 'Reference analysis failed.');
    } finally {
      setRunning(false);
    }
  };

  const queueComposition = async () => {
    setComposeMsg('');
    setRunning(true);
    try {
      const res = await invoke<{ message?: string; status?: string }>('run-imperial-video-compose', {
        pipelineId: job?.pipelineId || selectedPipeline,
        runtime: 'design-compositor',
        brief: brief.trim() || undefined,
      });
      setComposeMsg(res.message || 'Composition queued — open Create to attach clips and publish.');
    } catch (e) {
      setComposeMsg((e as Error).message || 'Could not queue composition.');
    } finally {
      setRunning(false);
    }
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
    setRunning(true);
    setShowHistory(true);
    setJob({ status: 'running', pipelineId: selectedPipeline });
    const topic = brief.trim() || `Agentic video for ${brandName}`;
    try {
      const res = await invoke<JobResult>('run-imperial-video-pipeline', {
        pipelineId: selectedPipeline,
        brief: topic,
        topic,
        brandName,
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

  return (
    <div className="imperial-video-studio card">
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
          {toolSummary && <p className="imperial-video-studio-tools">{toolSummary}</p>}
        </div>
        <div className="imperial-video-studio-head-actions">
          <button type="button" className="btn" onClick={() => setShowHistory((s) => !s)}>
            {showHistory ? 'Hide board' : 'Production board'}
          </button>
        </div>
      </header>

      <section className="imperial-video-studio-ref">
        <h3>Start from a reference</h3>
        <p className="muted">Paste a Short, Reel, TikTok, or YouTube URL — get pacing, structure, and 3 concept variants before you spend on assets.</p>
        <div className="imperial-video-studio-ref-row">
          <input
            type="url"
            className="input"
            placeholder="https://…"
            value={referenceUrl}
            onChange={(e) => setReferenceUrl(e.target.value)}
          />
          <button type="button" className="btn" disabled={running || !referenceUrl.trim()} onClick={analyzeReference}>
            Analyze
          </button>
        </div>
        {referenceAnalysis && (
          <pre className="imperial-video-studio-analysis">{referenceAnalysis}</pre>
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
        <label htmlFor="ivs-brief">Brief</label>
        <textarea
          id="ivs-brief"
          className="input"
          rows={3}
          placeholder="Make a 60-second explainer about…"
          value={brief}
          onChange={(e) => setBrief(e.target.value)}
        />
        <div id="ivs-run-pipeline" className="imperial-video-studio-run-row">
          <button type="button" className="btn primary" disabled={pipelineBusy} onClick={() => runPipeline(false)}>
            {pipelineBusy ? 'Running…' : 'Run full pipeline'}
          </button>
          <button type="button" className="btn" disabled={pipelineBusy} onClick={() => runPipeline(true)}>
            Quick preview
          </button>
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
          <p className="muted">Stages light up as the agent runs — approval gates pause for your review before any paid asset generation.</p>
          <ol className="imperial-video-studio-stage-flow">
            {stages.map((s) => {
              const live = storyboard.find((b) => b.stage === s.id);
              return (
                <li key={s.id} className={`imperial-video-studio-stage is-${live?.status || 'pending'} ${s.approval ? 'needs-approval' : ''}`}>
                  <span className="stage-dot" aria-hidden />
                  <div>
                    <strong>{s.label}</strong>
                    {live && <span className="stage-gate">{live.gate}</span>}
                    {s.approval && <span className="stage-approval-badge">Approval gate</span>}
                  </div>
                </li>
              );
            })}
          </ol>
          {job?.deliverable && job.status === 'complete' && (
            <div className="imperial-video-studio-deliverable">
              <h4>Deliverable preview</h4>
              <pre>{job.deliverable.slice(0, 1200)}{job.deliverable.length > 1200 ? '…' : ''}</pre>
              <div className="imperial-video-studio-publish-row" style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
                <button type="button" className="btn primary" disabled={running} onClick={queueComposition}>
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