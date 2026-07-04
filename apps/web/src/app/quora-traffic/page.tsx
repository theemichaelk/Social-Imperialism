'use client';

import { useCallback, useEffect, useState } from 'react';
import { invoke } from '@/lib/api';
import { PageShell } from '@/components/PageShell';
import { RichTextEditor } from '@/components/RichTextEditor';
import { SectionLivePanel } from '@/components/SectionLivePanel';

type Framework = { id: string; name: string; description: string };
type Angle = {
  id: string;
  name: string;
  brandPositioning?: string;
  keywords?: string;
  cta?: string;
  ctaUrl?: string;
  productContext?: string;
};
type Document = { id: string; name: string; content: string };
type QuoraQuestion = {
  id?: string;
  question?: string;
  content?: string;
  url?: string;
  views?: number;
  upvotes?: number;
  answerCount?: number;
  viewsLabel?: string;
  upvotesLabel?: string;
  metricsSource?: string;
};
type SavedAnswer = {
  id?: string;
  question?: string;
  content?: string;
  answer?: string;
  status?: string;
  createdAt?: string;
};
type QuoraSettings = {
  mode?: string;
  model?: string;
  minViews?: number;
  minUpvotes?: number;
  autoPublish?: boolean;
  activeAngleId?: string;
  angles?: Angle[];
  documents?: Document[];
  answers?: SavedAnswer[];
  publishedLog?: Array<{ at?: string; question?: string; success?: boolean }>;
};
type QuoraStatus = {
  hasAI?: boolean;
  hasGemini?: boolean;
  hasOpenRouter?: boolean;
  hasSerpApi?: boolean;
  nodriverOk?: boolean;
  puppeteerOk?: boolean;
  quoraLinked?: boolean;
  quoraHandle?: string;
  sessionValid?: boolean;
  draftCount?: number;
  publishedCount?: number;
};

const STEPS = ['research', 'generate', 'publish'] as const;
type Step = typeof STEPS[number];

function formatNum(n?: number) {
  if (!n) return '0';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

function qText(q: QuoraQuestion) {
  return q.question || q.content || '';
}

export default function QuoraTrafficPage() {
  const [step, setStep] = useState<Step>('research');
  const [settings, setSettings] = useState<QuoraSettings>({});
  const [frameworks, setFrameworks] = useState<Framework[]>([]);
  const [status, setStatus] = useState<QuoraStatus>({});
  const [questions, setQuestions] = useState<QuoraQuestion[]>([]);
  const [selected, setSelected] = useState<QuoraQuestion | null>(null);
  const [keyword, setKeyword] = useState('marketing automation');
  const [manualUrl, setManualUrl] = useState('');
  const [answer, setAnswer] = useState('');
  const [genMode, setGenMode] = useState<'website' | 'youtube'>('website');
  const [frameworkId, setFrameworkId] = useState('problem-insight');
  const [aiModel, setAiModel] = useState('gemini');
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [transcriptStatus, setTranscriptStatus] = useState('');
  const [editingAngleId, setEditingAngleId] = useState<string | null>(null);
  const [angleDraft, setAngleDraft] = useState<Angle>({ id: '', name: '' });
  const [docName, setDocName] = useState('');
  const [docContent, setDocContent] = useState('');
  const [msg, setMsg] = useState('');
  const [loading, setLoading] = useState(false);

  const angles = settings.angles || [];
  const documents = settings.documents || [];
  const drafts = (settings.answers || []).filter((a) => a.status !== 'published');
  const publishedLog = settings.publishedLog || [];

  const refresh = useCallback(async () => {
    const [st, cfg] = await Promise.all([
      invoke<QuoraStatus>('get-quora-traffic-status'),
      invoke<{ settings?: QuoraSettings; frameworks?: Framework[] }>('get-quora-traffic-settings'),
    ]);
    setStatus(st || {});
    const s = cfg.settings || {};
    setSettings(s);
    setFrameworks(cfg.frameworks || []);
    if (s.model) setAiModel(s.model);
    if (s.activeAngleId) setEditingAngleId(s.activeAngleId);
    const active = s.angles?.find((a) => a.id === s.activeAngleId) || s.angles?.[0];
    if (active) setAngleDraft(active);
  }, []);

  useEffect(() => { refresh().catch(console.error); }, [refresh]);

  async function saveSettings(partial: Partial<QuoraSettings>) {
    const res = await invoke<{ settings?: QuoraSettings }>('save-quora-traffic-settings', partial);
    if (res.settings) setSettings(res.settings);
  }

  async function scrape() {
    setLoading(true);
    setMsg('Scraping Quora…');
    try {
      const res = await invoke<{ questions?: QuoraQuestion[]; fallback?: boolean; warning?: string; error?: string }>(
        'scrape-quora-questions',
        { keyword, limit: 25, enrich: true },
      );
      if (res.questions?.length) {
        setQuestions(res.questions);
        setMsg(res.fallback ? `Cached results (${res.warning})` : `Found ${res.questions.length} questions`);
      } else {
        setMsg(res.error || 'No questions found');
      }
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function addQuestionUrl() {
    if (!manualUrl.trim()) return;
    setLoading(true);
    try {
      const res = await invoke<{ success?: boolean; question?: QuoraQuestion; error?: string }>('lookup-quora-question-url', { url: manualUrl.trim() });
      if (res.question) {
        setQuestions((prev) => [res.question!, ...prev]);
        setSelected(res.question);
        setMsg('Question added');
      } else {
        setMsg(res.error || 'Could not load question');
      }
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function generateAnswer() {
    if (!selected) { setMsg('Select a question first'); return; }
    setLoading(true);
    setMsg('Generating answer…');
    try {
      const activeAngle = angles.find((a) => a.id === settings.activeAngleId) || angles[0];
      const res = await invoke<{ answer?: string; formatted?: string; success?: boolean; error?: string }>('generate-quora-answer', {
        question: selected,
        keyword,
        frameworkId,
        mode: genMode,
        youtubeUrl: genMode === 'youtube' ? youtubeUrl : undefined,
        model: aiModel,
        angle: activeAngle,
        documents,
        settings,
      });
      const text = res.formatted || res.answer || '';
      setAnswer(text);
      setMsg(res.error ? res.error : 'Answer generated');
      await refresh();
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function publishAnswer(draft?: SavedAnswer) {
    const content = draft?.content || draft?.answer || answer;
    if (!content?.trim()) return;
    setLoading(true);
    setMsg('Publishing to Quora…');
    try {
      const res = await invoke<{ success?: boolean; error?: string }>('publish-quora-answer', {
        answer: { ...draft, content, question: draft?.question || qText(selected || {}) },
        automated: settings.mode === 'automated',
      });
      setMsg(res.success ? 'Published to Quora' : (res.error || 'Publish failed'));
      await refresh();
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function saveDraft() {
    await invoke('save-quora-traffic-answer', {
      id: `draft_${Date.now()}`,
      content: answer,
      question: qText(selected || {}),
      status: 'draft',
      keyword,
      createdAt: new Date().toISOString(),
    });
    setMsg('Draft saved');
    await refresh();
  }

  async function clearDrafts() {
    if (!drafts.length) return;
    if (!window.confirm(`Delete all ${drafts.length} Quora drafts? Published log is kept.`)) return;
    setLoading(true);
    try {
      const res = await invoke<{ success?: boolean; removed?: number; error?: string }>('clear-quora-traffic-drafts');
      setMsg(`Removed ${res.removed ?? 0} drafts`);
      await refresh();
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function saveAngle() {
    const updated = angles.some((a) => a.id === angleDraft.id)
      ? angles.map((a) => (a.id === angleDraft.id ? angleDraft : a))
      : [...angles, { ...angleDraft, id: angleDraft.id || `angle_${Date.now()}` }];
    await saveSettings({ angles: updated, activeAngleId: angleDraft.id || updated[updated.length - 1].id });
    setMsg('Angle saved');
  }

  async function addDocument() {
    if (!docName.trim() || !docContent.trim()) return;
    const doc: Document = { id: `doc_${Date.now()}`, name: docName.trim(), content: docContent.trim() };
    await saveSettings({ documents: [...documents, doc] });
    setDocName('');
    setDocContent('');
    setMsg('Document added');
  }

  async function fetchTranscript() {
    setTranscriptStatus('Fetching…');
    const res = await invoke<{ success?: boolean; transcript?: string; error?: string }>('fetch-youtube-transcript', { url: youtubeUrl });
    setTranscriptStatus(res.success ? `Transcript: ${(res.transcript || '').slice(0, 120)}…` : (res.error || 'Failed'));
  }

  const statusChips = [
    { ok: status.hasAI, label: status.hasAI ? 'AI ready' : 'Add AI keys in Settings' },
    { ok: status.quoraLinked, label: status.quoraLinked ? `Quora linked${status.quoraHandle ? ` (${status.quoraHandle})` : ''}` : 'Link Quora in Account Hub', link: !status.quoraLinked },
    { ok: status.sessionValid, label: status.sessionValid ? 'Session active' : 'Re-link Quora session', warn: status.quoraLinked && !status.sessionValid },
    { ok: true, label: `${status.draftCount ?? drafts.length} drafts · ${status.publishedCount ?? publishedLog.length} published` },
  ];

  return (
    <div className="quora-traffic-page">
      <PageShell title="Quora Traffic Ops" />

      <SectionLivePanel section="quora-traffic" accountPlatform="Quora" />

      <div className="quora-hero card">
        <div className="feature-pills">
          <span className="feature-pill">Views & upvotes upfront</span>
          <span className="feature-pill">Brand angles + CTAs</span>
          <span className="feature-pill">Website & YouTube modes</span>
          <span className="feature-pill">4 answer frameworks</span>
        </div>
      </div>

      <div className="status-bar" style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
        {statusChips.map((c, i) => (
          <span
            key={i}
            className={`badge ${c.ok && !c.warn ? 'status-ok' : c.link ? '' : 'status-partial'}`}
            style={{ cursor: c.link ? 'pointer' : undefined }}
            onClick={c.link ? () => window.location.assign('/account-hub') : undefined}
          >
            {c.label}
          </span>
        ))}
      </div>

      <div className="mode-bar card" style={{ marginBottom: 12 }}>
        <div>
          <h3 style={{ margin: '0 0 4px' }}>Workflow mode</h3>
          <p className="settings-panel-desc" style={{ margin: 0 }}>
            {settings.mode === 'automated'
              ? 'Automated — auto-publish when thresholds are met.'
              : 'Manual — review and edit every answer before publishing.'}
          </p>
          {settings.mode === 'automated' && (
            <div style={{ display: 'flex', gap: 12, marginTop: 12, flexWrap: 'wrap' }}>
              <label>Min views <input className="input" type="number" value={settings.minViews ?? 5000} onChange={(e) => saveSettings({ minViews: parseInt(e.target.value, 10) })} /></label>
              <label>Min upvotes <input className="input" type="number" value={settings.minUpvotes ?? 100} onChange={(e) => saveSettings({ minUpvotes: parseInt(e.target.value, 10) })} /></label>
              <label className="ac-check">
                <input type="checkbox" checked={!!settings.autoPublish} onChange={(e) => saveSettings({ autoPublish: e.target.checked })} />
                Auto-publish after generate
              </label>
            </div>
          )}
        </div>
        <div className="mode-toggle">
          <button type="button" className={`btn ${settings.mode !== 'automated' ? 'primary' : ''}`} onClick={() => saveSettings({ mode: 'manual' })}>Manual</button>
          <button type="button" className={`btn ${settings.mode === 'automated' ? 'primary' : ''}`} onClick={() => saveSettings({ mode: 'automated' })}>Automated</button>
        </div>
      </div>

      <div className="step-nav tabs" style={{ marginBottom: 12 }}>
        {STEPS.map((s, i) => (
          <button key={s} type="button" className={`tab ${step === s ? 'active' : ''}`} onClick={() => setStep(s)}>
            {String(i + 1).padStart(2, '0')} {s.charAt(0).toUpperCase() + s.slice(1)}
          </button>
        ))}
      </div>

      {step === 'research' && (
        <div className="card">
          <h3>Find questions with real traffic</h3>
          <p className="settings-panel-desc">See views, upvotes, and answer count before you write.</p>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
            <input className="input" style={{ flex: 1, minWidth: 200 }} value={keyword} onChange={(e) => setKeyword(e.target.value)} placeholder="e.g. affiliate marketing" />
            <button type="button" className="btn primary" onClick={scrape} disabled={loading}>Scrape Quora</button>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
            <input className="input" style={{ flex: 1 }} value={manualUrl} onChange={(e) => setManualUrl(e.target.value)} placeholder="Paste Quora question URL" />
            <button type="button" className="btn" onClick={addQuestionUrl} disabled={loading}>Add question</button>
          </div>

          {questions.length > 0 ? (
            <div className="table-scroll-wrap">
              <table className="quora-questions-table">
                <thead>
                  <tr><th>Question</th><th>Views</th><th>Upvotes</th><th>Answers</th></tr>
                </thead>
                <tbody>
                  {questions.map((q, i) => (
                    <tr
                      key={q.id || i}
                      className={selected === q ? 'selected' : ''}
                      onClick={() => setSelected(q)}
                    >
                      <td>{qText(q).slice(0, 120)}</td>
                      <td>{q.viewsLabel || formatNum(q.views)}{q.metricsSource === 'estimated' ? ' (est)' : ''}</td>
                      <td>▲ {q.upvotesLabel || formatNum(q.upvotes)}</td>
                      <td>✎ {q.answerCount ?? 0}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="settings-panel-desc">Enter a keyword and scrape to see high-traffic questions.</p>
          )}

          <button
            type="button"
            className="btn primary"
            style={{ marginTop: 12 }}
            disabled={!selected}
            onClick={() => setStep('generate')}
          >
            Use selected question → Generate
          </button>
        </div>
      )}

      {step === 'generate' && (
        <div className="grid grid-2">
          <div>
            <div className="card" style={{ marginBottom: 12 }}>
              <h4>Angle Manager</h4>
              {angles.map((a) => (
                <div
                  key={a.id}
                  className={`angle-item ${settings.activeAngleId === a.id ? 'active' : ''}`}
                  onClick={() => { setEditingAngleId(a.id); setAngleDraft(a); saveSettings({ activeAngleId: a.id }); }}
                >
                  {a.name}
                </div>
              ))}
              <button type="button" className="btn" style={{ width: '100%', marginTop: 6 }} onClick={() => {
                const na = { id: `angle_${Date.now()}`, name: 'New Angle' };
                setAngleDraft(na);
                setEditingAngleId(na.id);
              }}>+ Add angle</button>
            </div>

            <div className="card" style={{ marginBottom: 12 }}>
              <h4>Edit angle</h4>
              <input className="input" placeholder="Name" value={angleDraft.name} onChange={(e) => setAngleDraft({ ...angleDraft, name: e.target.value })} />
              <textarea className="input" rows={2} placeholder="Brand positioning" value={angleDraft.brandPositioning || ''} onChange={(e) => setAngleDraft({ ...angleDraft, brandPositioning: e.target.value })} />
              <input className="input" placeholder="Target keywords" value={angleDraft.keywords || ''} onChange={(e) => setAngleDraft({ ...angleDraft, keywords: e.target.value })} />
              <input className="input" placeholder="CTA text" value={angleDraft.cta || ''} onChange={(e) => setAngleDraft({ ...angleDraft, cta: e.target.value })} />
              <input className="input" placeholder="CTA URL" value={angleDraft.ctaUrl || ''} onChange={(e) => setAngleDraft({ ...angleDraft, ctaUrl: e.target.value })} />
              <textarea className="input" rows={2} placeholder="Product context" value={angleDraft.productContext || ''} onChange={(e) => setAngleDraft({ ...angleDraft, productContext: e.target.value })} />
              <button type="button" className="btn primary" style={{ width: '100%', marginTop: 8 }} onClick={saveAngle}>Save angle</button>
            </div>

            <div className="card">
              <h4>Documents</h4>
              {documents.map((d) => (
                <div key={d.id} className="doc-item">
                  <span>{d.name}</span>
                  <button type="button" className="btn" onClick={() => saveSettings({ documents: documents.filter((x) => x.id !== d.id) })}>×</button>
                </div>
              ))}
              <input className="input" placeholder="Doc name" value={docName} onChange={(e) => setDocName(e.target.value)} />
              <textarea className="input" rows={3} placeholder="Paste product docs…" value={docContent} onChange={(e) => setDocContent(e.target.value)} />
              <button type="button" className="btn" style={{ width: '100%', marginTop: 6 }} onClick={addDocument}>Add document</button>
            </div>
          </div>

          <div>
            <div className="card" style={{ marginBottom: 12, borderColor: '#38bdf8' }}>
              <h4>Selected question</h4>
              <p style={{ margin: 0, fontSize: '0.9rem' }}>
                {selected ? qText(selected) : 'No question selected — go to Research.'}
              </p>
            </div>

            <div className="card" style={{ marginBottom: 12 }}>
              <h4>Promotion mode</h4>
              <div className="mode-cards">
                <div className={`mode-card ${genMode === 'website' ? 'active' : ''}`} onClick={() => setGenMode('website')}>
                  <strong>Website Mode</strong>
                  <p className="settings-panel-desc">Position your product as the solution with a natural CTA.</p>
                </div>
                <div className={`mode-card ${genMode === 'youtube' ? 'active' : ''}`} onClick={() => setGenMode('youtube')}>
                  <strong>YouTube Mode</strong>
                  <p className="settings-panel-desc">Transcript + embed — Quora auto-embeds your video.</p>
                </div>
              </div>
              {genMode === 'youtube' && (
                <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                  <input className="input" placeholder="YouTube URL" value={youtubeUrl} onChange={(e) => setYoutubeUrl(e.target.value)} />
                  <button type="button" className="btn" onClick={fetchTranscript}>Transcript</button>
                </div>
              )}
              {transcriptStatus && <p style={{ fontSize: '0.75rem', color: '#64748b', marginTop: 4 }}>{transcriptStatus}</p>}
            </div>

            <div className="card" style={{ marginBottom: 12 }}>
              <h4>Answer framework</h4>
              <div className="framework-list">
                {frameworks.map((f) => (
                  <div
                    key={f.id}
                    className={`framework-opt ${frameworkId === f.id ? 'active' : ''}`}
                    onClick={() => setFrameworkId(f.id)}
                  >
                    <div className="fw-name">{f.name}</div>
                    <div className="fw-desc">{f.description}</div>
                  </div>
                ))}
              </div>
              <label className="ac-label" style={{ marginTop: 12 }}>AI model</label>
              <select className="input" value={aiModel} onChange={(e) => { setAiModel(e.target.value); saveSettings({ model: e.target.value }); }}>
                <option value="gemini">Gemini (recommended)</option>
                <option value="openai/gpt-4o-mini">GPT-4o Mini</option>
                <option value="openai/gpt-4o">GPT-4o</option>
                <option value="anthropic/claude-3.5-sonnet">Claude 3.5 Sonnet</option>
                <option value="google/gemini-2.0-flash-001">Gemini 2.0 Flash</option>
              </select>
              <button type="button" className="btn primary" style={{ marginTop: 12 }} onClick={generateAnswer} disabled={loading || !selected}>
                Generate answer
              </button>
            </div>

            <div className="card">
              <h4>Answer editor</h4>
              <RichTextEditor value={answer} onChange={setAnswer} rows={12} placeholder="Generated answer appears here…" />
              <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
                <button type="button" className="btn" onClick={saveDraft} disabled={!answer.trim()}>Save draft</button>
                <button type="button" className="btn primary" onClick={() => publishAnswer()} disabled={!answer.trim()}>Publish to Quora</button>
                <button type="button" className="btn" onClick={() => setStep('publish')}>Go to Publish →</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {step === 'publish' && (
        <div className="grid grid-2">
          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
              <h4 style={{ margin: 0 }}>Drafts ({drafts.length})</h4>
              {drafts.length > 0 && (
                <button type="button" className="btn" onClick={clearDrafts} disabled={loading}>Clear all drafts</button>
              )}
            </div>
            {drafts.map((d, i) => (
              <div key={d.id || i} className="draft-card">
                <div className="post-meta">{d.status || 'draft'} · {d.createdAt ? new Date(d.createdAt).toLocaleString() : ''}</div>
                <div className="preview">{(d.content || d.answer || '').slice(0, 200)}</div>
                <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                  <button type="button" className="btn" onClick={() => { setAnswer(d.content || d.answer || ''); setStep('generate'); }}>Edit</button>
                  <button type="button" className="btn primary" onClick={() => publishAnswer(d)}>Publish</button>
                  {d.id && (
                    <button type="button" className="btn" onClick={async () => { await invoke('delete-quora-traffic-answer', d.id); refresh(); }}>Delete</button>
                  )}
                </div>
              </div>
            ))}
            {!drafts.length && <p className="settings-panel-desc">No drafts yet — generate an answer first.</p>}
          </div>
          <div className="card">
            <h4>Published log</h4>
            <div className="pub-log">
              {publishedLog.map((entry, i) => (
                <div key={i} className="pub-log-item">
                  {entry.at ? new Date(entry.at).toLocaleString() : ''} — {entry.question?.slice(0, 80)}
                  {entry.success === false ? ' (failed)' : ''}
                </div>
              ))}
              {!publishedLog.length && <p className="settings-panel-desc">Published answers appear here.</p>}
            </div>
          </div>
        </div>
      )}

      {msg && <p style={{ marginTop: 12, color: '#94a3b8', fontSize: '0.85rem' }}>{msg}</p>}
    </div>
  );
}