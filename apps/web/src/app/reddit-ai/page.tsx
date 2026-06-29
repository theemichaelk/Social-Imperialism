'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { invoke } from '@/lib/api';
import { PageShell } from '@/components/PageShell';
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
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const [st, q, s, l] = await Promise.all([
        invoke<Record<string, unknown>>('get-reddit-ai-status'),
        invoke<{ queue?: QueueItem[] }>('get-reddit-ai-queue', activeModule),
        invoke<SuiteSettings>('get-reddit-ai-settings'),
        invoke<unknown[]>('get-leads'),
      ]);
      setSettings(s || {});
      setQueue(q.queue || []);
      setActivity((st.log as typeof activity) || []);
      setLeads((l as typeof leads).slice(0, 10));
    } catch (e) {
      setMsg((e as Error).message);
    }
  }, [activeModule]);

  useEffect(() => { refresh().catch(console.error); }, [refresh]);

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

  async function saveModule(moduleId: string, quiet = false) {
    if (!quiet) {
      setLoading(true);
      setMsg('Saving settings…');
    }
    try {
      const ui = MODULE_UI[moduleId];
      const partial = {
        [ui.settingsKey]: getCfg(moduleId),
        modules: { ...settings.modules, [moduleId]: getMod(moduleId) },
      };
      const res = await invoke<{ success?: boolean; settings?: SuiteSettings; error?: string }>('save-reddit-ai-settings', partial);
      if (res.success === false) throw new Error(res.error || 'Save failed');
      if (res.settings) setSettings(res.settings);
      if (!quiet) setMsg('Settings saved');
      return true;
    } catch (e) {
      setMsg((e as Error).message);
      return false;
    } finally {
      if (!quiet) setLoading(false);
    }
  }

  async function runModule(moduleId: string) {
    setLoading(true);
    setMsg(`Running ${moduleId}…`);
    try {
      const saved = await saveModule(moduleId, true);
      if (!saved) return;
      const res = await invoke<{ success?: boolean; actionsQueued?: number; error?: string }>('run-reddit-ai-module', moduleId);
      if (res.success === false) throw new Error(res.error || 'Module run failed');
      setMsg(`Module complete — ${res.actionsQueued ?? 0} actions queued`);
      await refresh();
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function approveAction(id: string) {
    setMsg('Approving action…');
    try {
      const res = await invoke<{ success?: boolean; error?: string }>('approve-reddit-ai-action', id);
      if (res && typeof res === 'object' && 'success' in res && res.success === false) {
        throw new Error(res.error || 'Approve failed');
      }
      setMsg('Action approved');
      await refresh();
    } catch (e) {
      setMsg((e as Error).message);
    }
  }

  async function dismissAction(id: string) {
    setMsg('Dismissing action…');
    try {
      const res = await invoke<{ success?: boolean; error?: string }>('dismiss-reddit-ai-action', id);
      if (res && typeof res === 'object' && 'success' in res && res.success === false) {
        throw new Error(res.error || 'Dismiss failed');
      }
      setMsg('Action dismissed');
      await refresh();
    } catch (e) {
      setMsg((e as Error).message);
    }
  }

  const mod = MODULES.find((m) => m.id === activeModule)!;
  const ui = MODULE_UI[activeModule];
  const cfg = getCfg(activeModule);
  const msgIsError = /failed|error/i.test(msg);

  return (
    <div>
      <PageShell
        title="Growth Lab"
        actions={
          <>
            <Link href="/dashboard" className="btn primary">Leads →</Link>
            <Link href="/keywords" className="btn">Keywords</Link>
            <Link href="/automations" className="btn">Automations</Link>
          </>
        }
      />

      <SectionLivePanel section="reddit-ai" />

      {msg && (
        <div className="card" style={{ marginBottom: 12, borderColor: msgIsError ? '#f59e0b' : '#10b981' }}>
          <p style={{ margin: 0, fontSize: '0.9rem' }}>{msg}</p>
        </div>
      )}

      <div className="card lab-bridge-card" style={{ marginBottom: 12 }}>
        <Link href="/quora-traffic" style={{ textDecoration: 'none', color: 'inherit' }}>
          <h3 style={{ margin: '0 0 6px' }}>Quora Traffic Ops →</h3>
          <p style={{ margin: 0, fontSize: '0.85rem', color: '#94a3b8' }}>Research high-traffic questions, generate contextual answers, publish via linked Quora session.</p>
        </Link>
      </div>

      <div className="grid grid-2">
        {MODULES.map((m) => (
          <div
            key={m.id}
            role="button"
            tabIndex={0}
            className="card"
            style={{ borderColor: activeModule === m.id ? m.color : undefined, cursor: 'pointer' }}
            onClick={() => { setActiveModule(m.id); setMsg(''); }}
            onKeyDown={(e) => e.key === 'Enter' && setActiveModule(m.id)}
          >
            <h3 style={{ color: m.color, margin: '0 0 6px' }}>{m.icon} {m.name}</h3>
            <p style={{ fontSize: '0.78rem', color: '#94a3b8', margin: '0 0 8px' }}>{m.tagline}</p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
              {m.benefits.map((b) => <span key={b} className="badge" style={{ fontSize: '0.65rem' }}>{b}</span>)}
            </div>
            {getMod(m.id).enabled && <span className="badge status-ok" style={{ marginTop: 8, fontSize: '0.65rem' }}>Enabled</span>}
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
                <input
                  className="input"
                  type={f.type === 'number' ? 'number' : 'text'}
                  value={String(cfg[f.id] ?? '')}
                  onChange={(e) => updateCfg(activeModule, f.id, f.type === 'number' ? parseFloat(e.target.value) : e.target.value)}
                />
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
          <button type="button" className="btn" onClick={() => saveModule(activeModule)} disabled={loading}>Save</button>
          <button type="button" className="btn primary" onClick={() => runModule(activeModule)} disabled={loading}>
            {loading ? 'Running…' : 'Run Now'}
          </button>
        </div>
      </div>

      <div className="card">
        <h3>Action Queue ({queue.length})</h3>
        {queue.map((item) => (
          <div key={item.id} className="post-card">
            <span className="badge">{item.status || 'pending'}</span> {item.moduleId}
            <div>{(item.content || item.action || '').slice(0, 200)}</div>
            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
              <button type="button" className="btn primary" onClick={() => approveAction(item.id)} disabled={loading}>Approve</button>
              <button type="button" className="btn" onClick={() => dismissAction(item.id)} disabled={loading}>Dismiss</button>
            </div>
          </div>
        ))}
        {!queue.length && <p className="settings-panel-desc">Run a module to populate the approval queue.</p>}
        <h4 style={{ marginTop: 16, color: '#94a3b8', fontSize: '0.85rem' }}>Recent Activity</h4>
        {activity.length ? activity.slice(0, 8).map((a, i) => (
          <div key={i} style={{ fontSize: '0.75rem', color: '#64748b', padding: '4px 0', borderBottom: '1px solid rgba(51,65,85,0.4)' }}>
            {a.moduleId}: {a.message}
          </div>
        )) : <p className="settings-panel-desc">No recent activity.</p>}
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
      </div>
    </div>
  );
}