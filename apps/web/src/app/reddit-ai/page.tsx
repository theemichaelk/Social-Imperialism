'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { invoke } from '@/lib/api';
import { PageHeader } from '@/components/PageHeader';
import { SectionLivePanel } from '@/components/SectionLivePanel';

const MODULES = [
  { id: 'subreddit-ascent', name: 'Subreddit Ascent', color: '#f97316', icon: '🚀', tagline: 'Organic Reddit presence — browse, vote, comment on autopilot.', benefits: ['Effortless growth', 'Genuine engagement', 'Increased visibility'] },
  { id: 'thread-weaver', name: 'Thread Weaver', color: '#38bdf8', icon: '💬', tagline: 'Turn Reddit threads into targeted traffic with AI-crafted comments.', benefits: ['Targeted traffic', 'Real discussions', 'Brand visibility'] },
  { id: 'front-page-forge', name: 'Front Page Forge', color: '#ef4444', icon: '🔥', tagline: 'Forge scroll-stopping titles engineered for Reddit visibility.', benefits: ['More traffic', 'Thought leadership', 'Faster creation'] },
  { id: 'inbox-echo', name: 'Inbox Echo', color: '#a78bfa', icon: '📥', tagline: 'AI engagement manager — thoughtful replies when you are away.', benefits: ['Auto replies', 'Stay in the loop', 'Full control'] },
  { id: 'headline-bridge', name: 'Headline Bridge', color: '#10b981', icon: '📰', tagline: 'Bridge breaking news to Medium thought-leadership articles.', benefits: ['Timely articles', 'News-to-narrative', '24/7 content'] },
  { id: 'momentum-lens', name: 'Momentum Lens', color: '#f59e0b', icon: '📈', tagline: 'Spot rising trends and spin them into campaign angles.', benefits: ['Beat competitors', 'Timely campaigns', 'Hidden niches'] },
];

const MODULE_UI: Record<string, {
  settingsKey: string;
  fields: Array<{ id: string; label: string; type: string; full?: boolean; options?: string[] }>;
  checks?: Array<{ id: string; label: string }>;
  how: string[];
}> = {
  'subreddit-ascent': {
    settingsKey: 'subredditAscent',
    fields: [
      { id: 'targetSubreddits', label: 'Target subreddits', type: 'textarea', full: true },
      { id: 'commentTemplates', label: 'Comment templates (one per line)', type: 'textarea', full: true },
      { id: 'upvoteRatio', label: 'Upvote ratio (0-1)', type: 'number' },
      { id: 'browsePostsPerRun', label: 'Posts per run', type: 'number' },
    ],
    checks: [{ id: 'autoSubscribe', label: 'Auto-subscribe to target subs' }, { id: 'reshareEnabled', label: 'Enable strategic resharing' }],
    how: ['Intelligent feed browsing', 'Strategic upvotes', 'Template-driven comments', 'Subreddit subscriptions'],
  },
  'thread-weaver': {
    settingsKey: 'threadWeaver',
    fields: [
      { id: 'promoteUrl', label: 'URL / content to promote', type: 'text', full: true },
      { id: 'nicheKeywords', label: 'Niche keywords', type: 'textarea', full: true },
      { id: 'maxThreads', label: 'Max threads per run', type: 'number' },
      { id: 'tone', label: 'Comment tone', type: 'select', options: ['helpful', 'expert', 'casual', 'consultative'] },
    ],
    how: ['Scan Reddit for relevant threads', 'AI crafts natural comments with your link', 'Queues for approval'],
  },
  'front-page-forge': {
    settingsKey: 'frontPageForge',
    fields: [
      { id: 'contentUrl', label: 'Website / blog URL', type: 'text', full: true },
      { id: 'targetSubreddit', label: 'Target subreddit', type: 'text' },
      { id: 'style', label: 'Post style', type: 'select', options: ['informative', 'story', 'listicle', 'debate'] },
    ],
    how: ['AI-generated catchy titles', 'Structured engaging posts', 'Algorithm-aware visibility tips'],
  },
  'inbox-echo': {
    settingsKey: 'inboxEcho',
    fields: [
      { id: 'monitorSubreddits', label: 'Subreddits to monitor', type: 'textarea', full: true },
      { id: 'replyStyle', label: 'Reply style', type: 'select', options: ['friendly', 'professional', 'witty', 'concise'] },
    ],
    checks: [{ id: 'autoApprove', label: 'Auto-approve replies (not recommended)' }],
    how: ['Monitors active discussions', 'Drafts contextual replies', 'Review before posting'],
  },
  'headline-bridge': {
    settingsKey: 'headlineBridge',
    fields: [
      { id: 'newsSources', label: 'News focus (topics)', type: 'text' },
      { id: 'mediumTone', label: 'Medium article tone', type: 'select', options: ['thought-leadership', 'tutorial', 'opinion', 'case-study'] },
    ],
    checks: [{ id: 'brandAngle', label: 'Weave brand/product into articles' }],
    how: ['Pulls live trending headlines', 'Transforms news into Medium drafts', 'Subtle conversion CTAs'],
  },
  'momentum-lens': {
    settingsKey: 'momentumLens',
    fields: [
      { id: 'industries', label: 'Industries to scan', type: 'text' },
      { id: 'productFocus', label: 'Product focus', type: 'text' },
      { id: 'scanDepth', label: 'Scan depth', type: 'select', options: ['headlines', 'deep'] },
    ],
    how: ['Scans headlines & social signals', 'Identifies rising trends', 'Suggests product ideas per trend'],
  },
};

type QueueItem = { id: string; moduleId?: string; action?: string; content?: string; status?: string };
type SuiteSettings = Record<string, unknown> & {
  modules?: Record<string, { enabled?: boolean; autoRun?: boolean }>;
};

export default function RedditAiPage() {
  const [activeModule, setActiveModule] = useState(MODULES[0].id);
  const [settings, setSettings] = useState<SuiteSettings>({});
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [activity, setActivity] = useState<Array<{ moduleId?: string; message?: string; timestamp?: string }>>([]);
  const [leads, setLeads] = useState<Array<{ title?: string; subreddit?: string; url?: string }>>([]);
  const [msg, setMsg] = useState('');

  async function refresh() {
    const [st, q, s, l] = await Promise.all([
      invoke<Record<string, unknown>>('get-reddit-ai-status'),
      invoke<{ queue?: QueueItem[] }>('get-reddit-ai-queue', activeModule),
      invoke<SuiteSettings>('get-reddit-ai-settings'),
      invoke<unknown[]>('get-leads'),
    ]);
    setSettings(s);
    setQueue(q.queue || []);
    setActivity((st.log as typeof activity) || []);
    setLeads((l as typeof leads).slice(0, 10));
  }

  useEffect(() => { refresh().catch(console.error); }, [activeModule]);

  function getCfg(moduleId: string) {
    const ui = MODULE_UI[moduleId];
    return (settings[ui.settingsKey] as Record<string, unknown>) || {};
  }

  function getMod(moduleId: string) {
    return settings.modules?.[moduleId] || { enabled: false, autoRun: false };
  }

  function updateCfg(moduleId: string, field: string, value: unknown) {
    const ui = MODULE_UI[moduleId];
    setSettings((prev) => ({
      ...prev,
      [ui.settingsKey]: { ...(prev[ui.settingsKey] as object || {}), [field]: value },
    }));
  }

  function updateMod(moduleId: string, field: 'enabled' | 'autoRun', value: boolean) {
    setSettings((prev) => ({
      ...prev,
      modules: { ...prev.modules, [moduleId]: { ...getMod(moduleId), [field]: value } },
    }));
  }

  async function saveModule(moduleId: string) {
    const ui = MODULE_UI[moduleId];
    const partial = {
      [ui.settingsKey]: getCfg(moduleId),
      modules: { ...settings.modules, [moduleId]: getMod(moduleId) },
    };
    const res = await invoke<{ success?: boolean; settings?: SuiteSettings }>('save-reddit-ai-settings', partial);
    if (res.settings) setSettings(res.settings);
    setMsg('Settings saved');
  }

  async function runModule(moduleId: string) {
    await saveModule(moduleId);
    setMsg(`Running ${moduleId}…`);
    const res = await invoke<Record<string, unknown>>('run-reddit-ai-module', moduleId);
    setMsg(res.success === false ? String(res.error) : `Module complete — ${res.actionsQueued ?? 0} actions queued`);
    refresh();
  }

  const mod = MODULES.find((m) => m.id === activeModule)!;
  const ui = MODULE_UI[activeModule];
  const cfg = getCfg(activeModule);

  return (
    <div>
      <PageHeader title="AI Growth Lab" subtitle="Six Reddit growth modules — configure, enable, run, approve" />

      <SectionLivePanel section="reddit-ai" />

      <div className="card lab-bridge-card" style={{ marginBottom: 12, cursor: 'pointer' }}>
        <Link href="/quora-traffic" style={{ textDecoration: 'none', color: 'inherit' }}>
          <h3 style={{ margin: '0 0 6px' }}>Quora Traffic Ops →</h3>
          <p style={{ margin: 0, fontSize: '0.85rem', color: '#94a3b8' }}>Research high-traffic questions, generate contextual answers, publish via linked Quora session.</p>
        </Link>
      </div>

      <div className="grid grid-2">
        {MODULES.map((m) => (
          <div key={m.id} className="card" style={{ borderColor: activeModule === m.id ? m.color : undefined, cursor: 'pointer' }} onClick={() => setActiveModule(m.id)}>
            <h3 style={{ color: m.color, margin: '0 0 6px' }}>{m.icon} {m.name}</h3>
            <p style={{ fontSize: '0.78rem', color: '#94a3b8', margin: '0 0 8px' }}>{m.tagline}</p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
              {m.benefits.map((b) => <span key={b} className="badge" style={{ fontSize: '0.65rem' }}>{b}</span>)}
            </div>
          </div>
        ))}
      </div>

      <div className="card">
        <h3 style={{ color: mod.color }}>{mod.name} — Settings</h3>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <input type="checkbox" checked={!!getMod(activeModule).enabled} onChange={(e) => updateMod(activeModule, 'enabled', e.target.checked)} />
          Enable module
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <input type="checkbox" checked={!!getMod(activeModule).autoRun} onChange={(e) => updateMod(activeModule, 'autoRun', e.target.checked)} />
          Auto-run with background worker
        </label>
        <ul style={{ fontSize: '0.82rem', color: '#94a3b8', margin: '0 0 12px', paddingLeft: '1.2rem' }}>
          {ui.how.map((h) => <li key={h}>{h}</li>)}
        </ul>
        <div className="grid grid-2">
          {ui.fields.map((f) => (
            <div key={f.id} style={f.full ? { gridColumn: '1 / -1' } : undefined}>
              <label style={{ fontSize: '0.75rem', color: '#94a3b8' }}>{f.label}</label>
              {f.type === 'textarea' ? (
                <textarea className="input" rows={3} value={String(cfg[f.id] ?? '')} onChange={(e) => updateCfg(activeModule, f.id, e.target.value)} />
              ) : f.type === 'select' ? (
                <select className="input" value={String(cfg[f.id] ?? f.options?.[0] ?? '')} onChange={(e) => updateCfg(activeModule, f.id, e.target.value)}>
                  {(f.options || []).map((o) => <option key={o} value={o}>{o}</option>)}
                </select>
              ) : (
                <input className="input" type={f.type === 'number' ? 'number' : 'text'} value={String(cfg[f.id] ?? '')} onChange={(e) => updateCfg(activeModule, f.id, f.type === 'number' ? parseFloat(e.target.value) : e.target.value)} />
              )}
            </div>
          ))}
          {ui.checks?.map((c) => (
            <label key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input type="checkbox" checked={!!cfg[c.id]} onChange={(e) => updateCfg(activeModule, c.id, e.target.checked)} />
              {c.label}
            </label>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
          <button className="btn" onClick={() => saveModule(activeModule)}>Save</button>
          <button className="btn primary" onClick={() => runModule(activeModule)}>Run Now</button>
        </div>
      </div>

      <div className="card">
        <h3>Action Queue ({queue.length})</h3>
        {queue.map((item) => (
          <div key={item.id} className="post-card">
            <span className="badge">{item.status || 'pending'}</span> {item.moduleId}
            <div>{(item.content || item.action || '').slice(0, 200)}</div>
            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
              <button className="btn primary" onClick={async () => { await invoke('approve-reddit-ai-action', item.id); refresh(); }}>Approve</button>
              <button className="btn" onClick={async () => { await invoke('dismiss-reddit-ai-action', item.id); refresh(); }}>Dismiss</button>
            </div>
          </div>
        ))}
        {!queue.length && <p style={{ color: '#94a3b8' }}>Run a module to populate the approval queue.</p>}
        <h4 style={{ marginTop: 16, color: '#94a3b8', fontSize: '0.85rem' }}>Recent Activity</h4>
        {activity.slice(0, 8).map((a, i) => (
          <div key={i} style={{ fontSize: '0.75rem', color: '#64748b', padding: '4px 0', borderBottom: '1px solid rgba(51,65,85,0.4)' }}>
            {a.moduleId}: {a.message}
          </div>
        ))}
        {leads.length > 0 && (
          <>
            <h4 style={{ marginTop: 16, color: '#94a3b8', fontSize: '0.85rem' }}>Leads ({leads.length})</h4>
            {leads.map((l, i) => (
              <div key={i} className="post-card" style={{ fontSize: '0.8rem' }}>
                {l.title || 'Lead'} {l.subreddit && <span className="badge">{l.subreddit}</span>}
                {l.url && <a href={l.url} target="_blank" rel="noreferrer" style={{ marginLeft: 8 }}>open</a>}
              </div>
            ))}
          </>
        )}
        {msg && <p style={{ marginTop: 8, color: '#94a3b8' }}>{msg}</p>}
      </div>
    </div>
  );
}