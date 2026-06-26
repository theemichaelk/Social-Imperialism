'use client';

import { useState } from 'react';
import { invoke } from '@/lib/api';
import { DataPanel } from '@/components/DashboardViz';

export function QaAnswerComposerPanel({
  onReuseContent,
}: {
  onReuseContent?: (text: string) => void;
}) {
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [preview, setPreview] = useState('');
  const [status, setStatus] = useState('');

  async function compose() {
    if (!question.trim()) { setStatus('Enter a question first'); return; }
    setStatus('Composing long-form answer…');
    try {
      const res = await invoke<{ answer?: string; formatted?: string; error?: string }>('compose-qa-answer', {
        question: { content: question, platform: 'Multi' },
      });
      const text = res.answer || res.formatted || '';
      setAnswer(text);
      setStatus(text ? 'Answer composed' : (res.error || 'No answer returned'));
    } catch (e) {
      setStatus((e as Error).message);
    }
  }

  function showPreview() {
    if (!answer.trim()) { setStatus('Compose an answer first'); return; }
    const platforms = ['Twitter', 'Reddit', 'LinkedIn', 'Quora'];
    setPreview(platforms.map((p) => {
      const limit = p === 'Twitter' ? 280 : 500;
      const slice = answer.slice(0, limit);
      return `${p}: ${slice}${answer.length > limit ? '…' : ''}`;
    }).join('\n\n'));
  }

  async function reuse(format: 'blog' | 'thread' | 'social') {
    if (!answer.trim()) return;
    const res = await invoke<{ content?: string }>('reuse-qa-as-content', { answer, format });
    if (res.content) {
      onReuseContent?.(res.content);
      setStatus(`Loaded as ${format} — switch to Quick Post to publish`);
    }
  }

  async function publish() {
    if (!answer.trim()) { setStatus('No answer to publish'); return; }
    setStatus('Publishing…');
    const res = await invoke<{ success?: boolean; message?: string; livePosted?: boolean; error?: string }>('publish-qa-answer', {
      question: { content: question || 'Q&A answer', platform: 'Multi' },
      answer,
      platform: 'Multi',
    });
    setStatus(res.message || res.error || (res.success ? 'Published' : 'Publish failed'));
  }

  return (
    <DataPanel title="Answer Composer" live>
      <p className="settings-panel-desc">
        Draft long Q&amp;A answers from dashboard discoveries — distribute to Reddit, Quora, X, LinkedIn, or reuse as posts.
      </p>
      <label className="ac-label">Question to answer</label>
      <textarea className="input" rows={3} value={question} onChange={(e) => setQuestion(e.target.value)} placeholder="Paste from Dashboard Q&A discovery…" />
      <div style={{ display: 'flex', gap: 8, margin: '12px 0', flexWrap: 'wrap' }}>
        <button type="button" className="btn primary" onClick={compose}>AI Compose Long Answer</button>
        <button type="button" className="btn" onClick={showPreview}>Platform Preview</button>
      </div>
      <label className="ac-label">Answer (edit freely)</label>
      <textarea className="input" rows={10} value={answer} onChange={(e) => setAnswer(e.target.value)} />
      {preview && <pre className="partner-code-sample" style={{ marginTop: 8 }}>{preview}</pre>}
      <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
        <button type="button" className="btn" onClick={() => reuse('blog')}>Reuse as Blog Post</button>
        <button type="button" className="btn" onClick={() => reuse('thread')}>Reuse as X Thread</button>
        <button type="button" className="btn" onClick={() => reuse('social')}>Social Snippet</button>
        <button type="button" className="btn primary" onClick={publish}>Distribute Answer</button>
      </div>
      {status && <p style={{ marginTop: 8, color: '#94a3b8', fontSize: '0.85rem' }}>{status}</p>}
    </DataPanel>
  );
}