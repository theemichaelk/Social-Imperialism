'use client';

import { useCallback, useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';

type GuideView = { id: string; label: string; href: string };

export function LiveGuideRedirectPanel() {
  const [email, setEmail] = useState('');
  const [query, setQuery] = useState('');
  const [viewId, setViewId] = useState('');
  const [views, setViews] = useState<GuideView[]>([]);
  const [msg, setMsg] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    apiFetch('/api/guide/views')
      .then((res) => setViews((res as { views?: GuideView[] }).views || []))
      .catch(() => setViews([]));
  }, []);

  const push = useCallback(async () => {
    const trimmed = email.trim();
    if (!trimmed) {
      setMsg('Enter target user email');
      return;
    }
    if (!viewId && !query.trim()) {
      setMsg('Pick a view or enter natural language');
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
      setMsg(`Pushed to ${res.targetEmail} — ${res.actionCount} action(s). ${res.reply || ''}`);
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [email, query, viewId]);

  return (
    <div className="card live-guide-redirect-panel" style={{ marginTop: '1rem' }}>
      <p className="overlord-trace-eyebrow" style={{ margin: '0 0 0.35rem' }}>THEE_MICHAEL · Live Guide Redirect</p>
      <h3 style={{ margin: '0 0 0.5rem', fontSize: '1rem' }}>Push real-time navigation to any user</h3>
      <p style={{ margin: '0 0 0.75rem', fontSize: '0.8rem', color: 'var(--muted)' }}>
        Target user dashboard polls every 4s — redirect executes while they are logged in.
      </p>

      <label className="support-search-label" htmlFor="lgr-email">User email</label>
      <input
        id="lgr-email"
        type="email"
        className="support-search-input"
        placeholder="user@company.com"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        style={{ marginBottom: '0.65rem' }}
      />

      <label className="support-search-label" htmlFor="lgr-view">Quick view</label>
      <select
        id="lgr-view"
        className="support-search-input"
        value={viewId}
        onChange={(e) => setViewId(e.target.value)}
        style={{ marginBottom: '0.65rem' }}
      >
        <option value="">— Pick view (Skills, Mine, Studio…) —</option>
        {views.map((v) => (
          <option key={v.id} value={v.id}>{v.label}</option>
        ))}
      </select>

      <label className="support-search-label" htmlFor="lgr-query">Or natural language</label>
      <input
        id="lgr-query"
        type="text"
        className="support-search-input"
        placeholder="take them to Connect Apps / skills tab…"
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