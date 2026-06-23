'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { invoke } from '@/lib/api';
import { MetricTile } from '@/components/DashboardViz';

type Props = {
  onStartCreate?: () => void;
};

export function ContentHubDashboard({ onStartCreate }: Props) {
  const [website, setWebsite] = useState('');
  const [msg, setMsg] = useState('');
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState({ accounts: 0, library: 0, queue: 0, scheduled: 0, brand: false });

  async function refresh() {
    const [accounts, lib, queue, sched, brand] = await Promise.all([
      invoke<Array<{ id: string }>>('get-linked-accounts').catch(() => []),
      invoke<{ count?: number }>('get-content-library').catch(() => ({ count: 0 })),
      invoke<unknown[]>('get-content-queue').catch(() => []),
      invoke<unknown[]>('get-scheduled-posts').catch(() => []),
      invoke<{ brandName?: string; domain?: string }>('get-brand-guidelines').catch(() => ({ brandName: '', domain: '' })),
    ]);
    setStats({
      accounts: accounts?.length || 0,
      library: lib?.count || 0,
      queue: Array.isArray(queue) ? queue.length : 0,
      scheduled: Array.isArray(sched) ? sched.length : 0,
      brand: !!(brand?.brandName || brand?.domain),
    });
  }

  useEffect(() => { refresh().catch(console.error); }, []);

  async function seedFromWebsite() {
    const domain = website.trim().replace(/^https?:\/\//, '').replace(/\/$/, '');
    if (!domain) { setMsg('Enter your business website'); return; }
    setLoading(true);
    setMsg('Seeding brand voice and content library…');
    try {
      const res = await invoke<{ success?: boolean; error?: string; domain?: string }>('seed-brand-from-website', { url: domain });
      if (!res.success) throw new Error(res.error || 'Seed failed');
      setMsg(`Brand seeded from ${res.domain || domain}. Open Create to generate posts.`);
      await refresh();
      onStartCreate?.();
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="ch-overview">
      <div className="card ch-overview-hero">
        <h2>Create & publish from one hub</h2>
        <p className="settings-panel-desc" style={{ margin: 0, maxWidth: 720 }}>
          Generate on-brand posts, manage your library, design in the Visual Builder, review the queue, and publish to calendar.
        </p>
        <div className="ch-overview-pills">
          <span className="badge">Post Generation</span>
          <span className="badge">Content Library</span>
          <span className="badge">Design Studio</span>
          <span className="badge">Review Queue</span>
        </div>
      </div>

      <div className="dash-hero">
        <div className="dash-hero-grid">
          <MetricTile label="Accounts" value={stats.accounts} sub="linked" />
          <MetricTile label="Library" value={stats.library} sub="assets" />
          <MetricTile label="Review queue" value={stats.queue} sub="pending" />
          <MetricTile label="Scheduled" value={stats.scheduled} sub="calendar" />
          <MetricTile label="Brand" value={stats.brand ? 'Set' : '—'} sub={stats.brand ? 'ready' : 'seed website'} accent={stats.brand ? '#22c55e' : '#f59e0b'} />
        </div>
      </div>

      <div className="grid grid-2">
        <Link href="/content-hub?tab=studio" className="card" style={{ textDecoration: 'none', color: 'inherit' }} onClick={() => onStartCreate?.()}>
          <h3>Create</h3>
          <p className="settings-panel-desc">Generate posts from brand, library assets, and topics. Approve and schedule.</p>
        </Link>
        <Link href="/content-library" className="card" style={{ textDecoration: 'none', color: 'inherit' }}>
          <h3>Content Library</h3>
          <p className="settings-panel-desc">Upload images, video, and copy. Import from websites and RSS.</p>
        </Link>
        <Link href="/design-studio" className="card" style={{ textDecoration: 'none', color: 'inherit' }}>
          <h3>Design Studio</h3>
          <p className="settings-panel-desc">Fill design templates with library assets and generate captions.</p>
        </Link>
        <Link href="/brand" className="card" style={{ textDecoration: 'none', color: 'inherit' }}>
          <h3>Brand Guidelines</h3>
          <p className="settings-panel-desc">Voice, do/don&apos;t rules, and sample messages for on-brand output.</p>
        </Link>
        <Link href="/content-hub?tab=queue" className="card" style={{ textDecoration: 'none', color: 'inherit' }}>
          <h3>Review Queue</h3>
          <p className="settings-panel-desc">Approve, edit, and schedule generated content before publish.</p>
        </Link>
        <Link href="/calendar" className="card" style={{ textDecoration: 'none', color: 'inherit' }}>
          <h3>Calendar</h3>
          <p className="settings-panel-desc">Visual planning, drag-and-drop scheduling, best-time suggestions.</p>
        </Link>
      </div>

      <div className="card ch-overview-cta">
        <h3>Enter your business website</h3>
        <p className="settings-panel-desc">Seed brand voice and import assets into your library in one step.</p>
        <div className="ch-overview-cta-row">
          <input
            className="input"
            placeholder="https://yourbusiness.com"
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && seedFromWebsite()}
          />
          <button type="button" className="btn primary" onClick={seedFromWebsite} disabled={loading}>
            {loading ? 'Seeding…' : 'Seed brand & library'}
          </button>
        </div>
        {msg && <p className="ics-msg">{msg}</p>}
      </div>
    </div>
  );
}