'use client';
import { useEffect, useState } from 'react';
import { invoke } from '@/lib/api';
import { PageHeader } from '@/components/PageHeader';

type Question = { content?: string; platform?: string; url?: string; views?: number; rankScore?: number };

export default function QuoraTrafficPage() {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [unanswered, setUnanswered] = useState<Question[]>([]);
  const [selected, setSelected] = useState<Question | null>(null);
  const [answer, setAnswer] = useState('');
  const [keyword, setKeyword] = useState('marketing automation');
  const [msg, setMsg] = useState('');
  const [qaSettings, setQaSettings] = useState<Record<string, unknown>>({});
  const [quoraSettings, setQuoraSettings] = useState<Record<string, unknown>>({});
  const [savedAnswers, setSavedAnswers] = useState<unknown[]>([]);
  const [youtubeUrl, setYoutubeUrl] = useState('');

  async function refresh() {
    const [u, s] = await Promise.all([
      invoke<Question[]>('get-unanswered-questions'),
      invoke<Record<string, unknown>>('get-qa-settings'),
    ]);
    setUnanswered(u);
    setQaSettings(s);
  }

  useEffect(() => {
    refresh().catch(console.error);
    invoke<Record<string, unknown>>('get-quora-traffic-settings').then(setQuoraSettings).catch(console.error);
    invoke<Record<string, unknown>>('get-quora-traffic-status').then((s) => setSavedAnswers((s as { answers?: unknown[] }).answers || [])).catch(console.error);
  }, []);

  async function discover() {
    setMsg('Discovering best questions…');
    const res = await invoke<{ questions?: Question[]; filtered?: number }>('discover-best-questions');
    setQuestions(res.questions || []);
    setMsg(`Found ${res.questions?.length ?? 0} questions (${res.filtered ?? 0} passed filters)`);
    refresh();
  }

  async function compose(q: Question) {
    setSelected(q);
    setMsg('Composing answer…');
    const res = await invoke<{ formatted?: string; answer?: string }>('compose-qa-answer', {
      question: q, platform: q.platform || 'Quora',
    });
    setAnswer(res.formatted || res.answer || '');
    setMsg('Answer drafted');
  }

  async function publish() {
    if (!selected || !answer.trim()) return;
    setMsg('Publishing…');
    const res = await invoke<{ success?: boolean; error?: string }>('publish-qa-answer', {
      question: selected, answer, platform: selected.platform || 'Quora',
    });
    setMsg(res.success ? 'Published' : (res.error || 'Failed'));
  }

  async function scrapeQuora() {
    setMsg('Scraping Quora…');
    const res = await invoke<Record<string, unknown>>('scrape-quora-questions', { keyword, limit: 10, enrich: false });
    setMsg(JSON.stringify(res).slice(0, 150));
  }

  async function generateQuoraAnswer() {
    if (!selected) return;
    setMsg('Generating…');
    const res = await invoke<{ answer?: string }>('generate-quora-answer', { question: selected.content, keyword });
    setAnswer(res.answer || '');
    setMsg('Answer generated');
  }

  async function saveAnswer() {
    await invoke('save-quora-traffic-answer', { content: answer, question: selected?.content, keyword });
    setMsg('Answer saved');
  }

  async function publishQuora() {
    setMsg('Publishing…');
    const res = await invoke('publish-quora-answer', { answer, automated: false });
    setMsg(JSON.stringify(res).slice(0, 120));
  }

  return (
    <div>
      <PageHeader title="Quora Traffic Ops" subtitle="Research → Generate → Publish pipeline with answer frameworks" />

      <div className="grid grid-2">
        <div className="card">
          <h3>Discovery</h3>
          <button className="btn primary" onClick={discover}>Discover Best Questions</button>
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <input className="input" value={keyword} onChange={(e) => setKeyword(e.target.value)} placeholder="Keyword" />
            <button className="btn" onClick={scrapeQuora}>Scrape Quora</button>
          </div>
          <p style={{ fontSize: '0.8rem', color: '#64748b', marginTop: 8 }}>Min views: {String(qaSettings.minViews ?? 500)} · Freq: {String(qaSettings.freq ?? 'daily')}</p>
        </div>
        <div className="card">
          <h3>Answer Composer</h3>
          <textarea className="input" rows={10} value={answer} onChange={(e) => setAnswer(e.target.value)} placeholder="Select a question and compose" />
          <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
            <button className="btn primary" onClick={publish} disabled={!selected}>Publish (Q&A)</button>
            <button className="btn primary" onClick={publishQuora}>Publish (Quora Ops)</button>
            <button className="btn" onClick={generateQuoraAnswer}>Generate Quora</button>
            <button className="btn" onClick={saveAnswer}>Save Draft</button>
            {selected && <button className="btn" onClick={() => compose(selected)}>Regenerate</button>}
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <input className="input" placeholder="YouTube URL for transcript" value={youtubeUrl} onChange={(e) => setYoutubeUrl(e.target.value)} />
            <button className="btn" onClick={async () => setMsg(JSON.stringify(await invoke('fetch-youtube-transcript', { url: youtubeUrl })).slice(0, 150))}>Transcript</button>
          </div>
        </div>
      </div>

      <div className="grid grid-2">
        <div className="card">
          <h3>Best Questions ({questions.length})</h3>
          {questions.map((q, i) => (
            <div key={i} className="post-card" style={{ cursor: 'pointer' }} onClick={() => compose(q)}>
              <span className="badge">{q.platform || 'Q&A'}</span>
              <div>{(q.content || '').slice(0, 200)}</div>
              <div className="post-meta">{q.views?.toLocaleString() ?? 0} views · Score {q.rankScore ?? '—'}</div>
            </div>
          ))}
        </div>
        <div className="card">
          <h3>Unanswered Tracker ({unanswered.length})</h3>
          {unanswered.slice(0, 15).map((q, i) => (
            <div key={i} className="post-card" style={{ cursor: 'pointer' }} onClick={() => compose(q)}>
              <div>{(q.content || '').slice(0, 180)}</div>
              {q.url && <a href={q.url} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}>Open →</a>}
            </div>
          ))}
        </div>
      </div>
      {msg && <p style={{ color: '#94a3b8' }}>{msg}</p>}
    </div>
  );
}