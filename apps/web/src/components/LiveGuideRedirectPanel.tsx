'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { apiFetch } from '@/lib/api';

type GuideView = { id: string; label: string; href: string; section?: string };

export function LiveGuideRedirectPanel() {
  const [email, setEmail] = useState('');
  const [query, setQuery] = useState('');
  const [viewId, setViewId] = useState('');
  const [views, setViews] = useState<GuideView[]>([]);
  const [productUrl, setProductUrl] = useState('https://www.socialimperialism.com');
  const [msg, setMsg] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    apiFetch('/api/guide/views')
      .then((res) => {
        const data = res as { views?: GuideView[]; productUrl?: string };
        setViews(data.views || []);
        if (data.productUrl) setProductUrl(data.productUrl);
      })
      .catch(() => setViews([]));
  }, []);

  const groupedViews = useMemo(() => {
    const groups = new Map<string, GuideView[]>();
    for (const v of views) {
      const g = v.section || 'Modules';
      if (!groups.has(g)) groups.set(g, []);
      groups.get(g)!.push(v);
    }
    return [...groups.entries()];
  }, [views]);

  const push = useCallback(async () => {
    const trimmed = email.trim();
    if (!trimmed) {
      setMsg('Enter the user’s Social Imperialism login email');
      return;
    }
    if (!viewId && !query.trim()) {
      setMsg('Pick a module or enter natural language');
      return;
    }
    setLoading(true);
    setMsg('Pushing live redirect…');
    try {
      const res = await apiFetch('/api/guide/remote/push', {
        method: 'POST',
        body: JSON.stringify({
          email: trimmed,
          viewId: viewId || undefined,
          query: query.trim() || undefined,
        }),
      }) as { success?: boolean; targetEmail?: string; actionCount?: number; reply?: string; error?: string };
      if (res.error) throw new Error(res.error);
      setMsg(`Pushed to ${res.targetEmail} on ${productUrl} — ${res.actionCount} action(s). ${res.reply || ''}`);
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [email, query, viewId, productUrl]);

  return (
    <div className="card live-guide-redirect-panel" style={{ marginTop: '1rem' }}>
      <p className="overlord-trace-eyebrow" style={{ margin: '0 0 0.35rem' }}>THEE_MICHAEL · Social Imperialism Live Guide</p>
      <h3 style={{ margin: '0 0 0.5rem', fontSize: '1rem' }}>Push real-time navigation on socialimperialism.com</h3>
      <p style={{ margin: '0 0 0.75rem', fontSize: '0.8rem', color: 'var(--muted)' }}>
        The user’s session polls every 4s — their browser navigates, expands Focus mode tabs, and highlights the left sidebar module.
      </p>

      <label className="support-search-label" htmlFor="lgr-email">User email</label>
      <input
        id="lgr-email"
        type="email"
        className="support-search-input"
        placeholder="user@their-domain.com"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        style={{ marginBottom: '0.65rem' }}
      />

      <label className="support-search-label" htmlFor="lgr-view">Social Imperialism module</label>
      <select
        id="lgr-view"
        className="support-search-input"
        value={viewId}
        onChange={(e) => setViewId(e.target.value)}
        style={{ marginBottom: '0.65rem' }}
      >
        <option value="">— Pick sidebar module —</option>
        {groupedViews.map(([section, items]) => (
          <optgroup key={section} label={section}>
            {items.map((v) => (
              <option key={v.id} value={v.id}>{v.label}</option>
            ))}
          </optgroup>
        ))}
      </select>

      <label className="support-search-label" htmlFor="lgr-query">Or natural language</label>
      <input
        id="lgr-query"
        type="text"
        className="support-search-input"
        placeholder="take them to Integrations / Prompt Vault / can't find AI Replies tab…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        style={{ marginBottom: '0.75rem' }}
      />

      <button type="button" className="btn primary" onClick={push} disabled={loading}>
        {loading ? 'Pushing…' : 'Push live redirect'}
      </button>
      {msg && <p style={{ margin: '0.65rem 0 0', fontSize: '0.78rem', color: 'var(--muted)' }}>{msg}</p>}
    </div>
  );
}