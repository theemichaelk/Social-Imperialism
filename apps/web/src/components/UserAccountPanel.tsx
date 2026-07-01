'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { auth, invoke } from '@/lib/api';
import { MetricTile } from '@/components/DashboardViz';
import { buildSitemapEntries, buildRssItems, getSiteBaseUrl } from '@/lib/publicSiteFeed';

type MeUser = { id?: string; email?: string; name?: string; isAdmin?: boolean };
type Org = { id?: string; name?: string; slug?: string; plan?: string };
type Project = { id: string; name?: string; brandName?: string; domain?: string; isActive?: boolean };
type BillingPlan = { plan?: string; planName?: string; status?: string };

export function UserAccountPanel({ compact = false }: { compact?: boolean }) {
  const [user, setUser] = useState<MeUser | null>(null);
  const [org, setOrg] = useState<Org | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [billing, setBilling] = useState<BillingPlan>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const base = getSiteBaseUrl();
  const sitemapCount = buildSitemapEntries().length;
  const feedCount = buildRssItems().length;

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [me, bill] = await Promise.all([
        auth.me(),
        invoke<BillingPlan>('get-billing-plan').catch(() => ({})),
      ]);
      setUser(me.user || null);
      setOrg((me as { organization?: Org }).organization || null);
      setProjects(me.projects || []);
      setBilling(bill || {});
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load().catch(console.error);
  }, [load]);

  if (loading) {
    return <p style={{ color: '#94a3b8', fontSize: '0.9rem' }}>Loading your account…</p>;
  }

  if (error) {
    return (
      <div className="card" style={{ borderColor: '#ef4444' }}>
        <p style={{ margin: 0 }}>{error}</p>
        <button type="button" className="btn" onClick={() => load()} style={{ marginTop: 8 }}>Retry</button>
      </div>
    );
  }

  const activeProject = projects.find((p) => p.isActive) || projects[0];

  return (
    <div>
      <div className="grid grid-4" style={{ marginBottom: '1rem' }}>
        <MetricTile label="Email" value={user?.email?.split('@')[0] || '—'} sub={user?.email || ''} />
        <MetricTile label="Organization" value={org?.name || '—'} sub={org?.plan || 'starter'} />
        <MetricTile label="Campaigns" value={projects.length} sub={activeProject?.name || 'none active'} />
        <MetricTile label="Plan" value={billing.planName || billing.plan || '—'} sub={billing.status || 'active'} />
      </div>

      <div className={compact ? 'grid grid-1' : 'grid grid-2'}>
        <div className="card">
          <h3 style={{ marginTop: 0 }}>Your profile</h3>
          <table style={{ width: '100%', fontSize: '0.85rem', borderCollapse: 'collapse' }}>
            <tbody>
              <tr><td style={{ color: '#94a3b8', padding: '4px 8px 4px 0' }}>User ID</td><td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem' }}>{user?.id}</td></tr>
              <tr><td style={{ color: '#94a3b8', padding: '4px 8px 4px 0' }}>Name</td><td>{user?.name || '—'}</td></tr>
              <tr><td style={{ color: '#94a3b8', padding: '4px 8px 4px 0' }}>Email</td><td>{user?.email}</td></tr>
              <tr><td style={{ color: '#94a3b8', padding: '4px 8px 4px 0' }}>Role</td><td>{user?.isAdmin ? 'Platform Admin' : 'Subscriber'}</td></tr>
              <tr><td style={{ color: '#94a3b8', padding: '4px 8px 4px 0' }}>Org slug</td><td>{org?.slug || '—'}</td></tr>
            </tbody>
          </table>
          <div style={{ marginTop: 12, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <Link href="/settings" className="btn">Settings</Link>
            <Link href="/account-hub" className="btn">Account Hub</Link>
            {user?.isAdmin && <Link href="/dashboard/admin" className="btn primary">Admin Directory</Link>}
          </div>
        </div>

        <div className="card">
          <h3 style={{ marginTop: 0 }}>Your campaigns</h3>
          {projects.length === 0 ? (
            <p style={{ color: '#94a3b8', fontSize: '0.9rem' }}>No campaigns yet — run the Setup Wizard.</p>
          ) : (
            <ul style={{ margin: 0, paddingLeft: '1.1rem', fontSize: '0.88rem' }}>
              {projects.map((p) => (
                <li key={p.id} style={{ marginBottom: 6 }}>
                  <strong>{p.brandName || p.name}</strong>
                  {p.isActive && <span style={{ color: '#10b981', marginLeft: 6 }}>active</span>}
                  {p.domain && <span style={{ color: '#64748b', marginLeft: 6 }}>{p.domain}</span>}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="card" style={{ marginTop: '1rem' }}>
        <h3 style={{ marginTop: 0 }}>Site discovery — sitemap &amp; feed</h3>
        <p style={{ color: '#94a3b8', fontSize: '0.88rem', marginTop: 0 }}>
          Public routes for search engines and RSS readers. Your account sees only your org data above;
          sitemap and feed list app modules available after sign-in.
        </p>
        <div className="grid grid-2" style={{ marginBottom: 12 }}>
          <MetricTile label="Sitemap URLs" value={sitemapCount} sub="/sitemap.html" />
          <MetricTile label="Feed items" value={feedCount} sub="/feed.xml" />
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <a href="/sitemap.html" target="_blank" rel="noopener noreferrer" className="btn primary">Open sitemap.html</a>
          <a href="/feed.xml" target="_blank" rel="noopener noreferrer" className="btn">Open feed.xml</a>
          <a href={`${base}/sitemap.html`} target="_blank" rel="noopener noreferrer" className="btn">Full URL sitemap</a>
        </div>
      </div>
    </div>
  );
}