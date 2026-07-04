'use client';

import { useCallback, useEffect, useState } from 'react';
import { invoke } from '@/lib/api';

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
  status: string;
  accepted?: boolean;
  async?: boolean;
  pipelineId?: string;
  pipelineLabel?: string;
  stageCount?: number;
  storyboard?: StoryboardStage[];
  deliverable?: string;
  error?: string;
};

export function ImperialVideoStudioPanel() {
  const [config, setConfig] = useState<StudioConfig | null>(null);
  const [selectedPipeline, setSelectedPipeline] = useState('social-explainer');
  const [brief, setBrief] = useState('');
  const [referenceUrl, setReferenceUrl] = useState('');
  const [referenceAnalysis, setReferenceAnalysis] = useState<string | null>(null);
  const [job, setJob] = useState<JobResult | null>(null);
  const [toolSummary, setToolSummary] = useState<string>('');
  const [running, setRunning] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  const refresh = useCallback(async () => {
    const [cfg, tools, result] = await Promise.all([
      invoke<StudioConfig>('get-imperial-video-studio-config').catch(() => null),
      invoke<{ toolCount: number; skillCount: number; capabilities: Array<{ name: string; configured: number; total: number }> }>('get-imperial-video-tool-registry').catch(() => null),
      invoke<JobResult>('get-imperial-video-pipeline-result').catch(() => null),
    ]);
    if (cfg) setConfig(cfg);
    if (tools) {
      const caps = (tools.capabilities || [])
        .map((c) => `${c.name}: ${c.configured}/${c.total}`)
        .join(' · ');
      setToolSummary(`${tools.toolCount} tools · ${tools.skillCount}+ agent skills · ${caps}`);
    }
    if (result && result.status !== 'idle') setJob(result);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (job?.status !== 'running') return undefined;
    const t = setInterval(() => {
      invoke<JobResult>('get-imperial-video-pipeline-result')
        .then((r) => { if (r?.status) setJob(r); })
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
    } finally {
      setRunning(false);
    }
  };

  const runPipeline = async (quick = false) => {
    setRunning(true);
    setJob({ status: 'running', pipelineId: selectedPipeline });
    try {
      const res = await invoke<JobResult>('run-imperial-video-pipeline', {
        pipelineId: selectedPipeline,
        brief: brief.trim() || 'Agentic video for Social Imperialism',
        brandName: 'Social Imperialism',
        async: !quick,
        quick,
      });
      if (res.accepted) return;
      setJob(res);
    } catch (err) {
      setJob({ status: 'error', error: err instanceof Error ? err.message : 'Pipeline failed' });
    } finally {
      setRunning(false);
    }
  };

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
              : 'Loading studio config…'}
          </p>
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
        <div className="imperial-video-studio-run-row">
          <button type="button" className="btn primary" disabled={running} onClick={() => runPipeline(false)}>
            {running ? 'Running…' : 'Run full pipeline'}
          </button>
          <button type="button" className="btn" disabled={running} onClick={() => runPipeline(true)}>
            Quick preview
          </button>
        </div>
      </section>

      {(showHistory || storyboard.length > 0) && (
        <section className="imperial-video-studio-board">
          <h3>Production board</h3>
          <p className="muted">Stages light up as the agent runs — approval gates pause for THEE_MICHAEL review before assets spend.</p>
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
            </div>
          )}
          {job?.status === 'error' && job.error && (
            <p className="error-text">{job.error}</p>
          )}
        </section>
      )}
    </div>
  );
}