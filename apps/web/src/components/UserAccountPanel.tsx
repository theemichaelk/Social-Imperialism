'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { auth, invoke } from '@/lib/api';
import { MetricTile } from '@/components/DashboardViz';
import { getPublicDiscoveryStats, getSiteBaseUrl } from '@/lib/publicSiteFeed';

type MeUser = { id?: string; email?: string; name?: string; isAdmin?: boolean };
type Org = { id?: string; name?: string; slug?: string; plan?: string; role?: string; isActive?: boolean };
type Project = { id: string; name?: string; brandName?: string; domain?: string; isActive?: boolean };
type BillingPlan = { plan?: string; planName?: string; status?: string };

export function UserAccountPanel({ compact = false }: { compact?: boolean }) {
  const [user, setUser] = useState<MeUser | null>(null);
  const [org, setOrg] = useState<Org | null>(null);
  const [organizations, setOrganizations] = useState<Org[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [allProjects, setAllProjects] = useState<Project[]>([]);
  const [billing, setBilling] = useState<BillingPlan>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const base = getSiteBaseUrl();
  const discovery = getPublicDiscoveryStats();

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [me, bill] = await Promise.all([
        auth.me(),
        invoke<BillingPlan>('get-billing-plan').catch(() => ({})),
      ]);
      setUser(me.user || null);
      const orgs = (me as { organizations?: Org[] }).organizations
        || ((me as { organization?: Org }).organization ? [(me as { organization: Org }).organization] : []);
      setOrganizations(orgs);
      setOrg(orgs.find((o) => o.isActive) || orgs[0] || (me as { organization?: Org }).organization || null);
      setProjects(me.projects || []);
      setAllProjects((me as { allProjects?: Project[] }).allProjects || me.projects || []);
      setBilling(bill || {});
      await invoke('cache-user-account-summary', {
        organizations: orgs.length,
        campaigns: (me as { allProjects?: Project[] }).allProjects?.length || (me.projects || []).length,
      }).catch(() => {});
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
        <MetricTile label="Profile" value={user?.name || user?.email?.split('@')[0] || '—'} sub={user?.email || ''} />
        <MetricTile
          label="Organizations"
          value={organizations.length || (org ? 1 : 0)}
          sub={org?.name || '—'}
        />
        <MetricTile
          label="Campaigns"
          value={allProjects.length || projects.length}
          sub={activeProject?.brandName || activeProject?.name || 'none active'}
        />
        <MetricTile label="Plan" value={billing.planName || billing.plan || org?.plan || '—'} sub={billing.status || 'active'} />
      </div>

      <div className={compact ? 'grid grid-1' : 'grid grid-2'}>
        <div className="card">
          <h3 style={{ marginTop: 0 }}>Your profile</h3>
          <div className="table-scroll-wrap">
          <table style={{ width: '100%', fontSize: '0.85rem', borderCollapse: 'collapse', minWidth: 280 }}>
            <tbody>
              <tr><td style={{ color: '#94a3b8', padding: '4px 8px 4px 0' }}>User ID</td><td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', wordBreak: 'break-all' }}>{user?.id}</td></tr>
              <tr><td style={{ color: '#94a3b8', padding: '4px 8px 4px 0' }}>Name</td><td>{user?.name || '—'}</td></tr>
              <tr><td style={{ color: '#94a3b8', padding: '4px 8px 4px 0' }}>Email</td><td>{user?.email}</td></tr>
              <tr><td style={{ color: '#94a3b8', padding: '4px 8px 4px 0' }}>Role</td><td>{user?.isAdmin ? 'Platform Admin' : 'Subscriber'}</td></tr>
              <tr><td style={{ color: '#94a3b8', padding: '4px 8px 4px 0' }}>Org slug</td><td>{org?.slug || '—'}</td></tr>
            </tbody>
          </table>
          </div>
          <div style={{ marginTop: 12, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <Link href="/settings" className="btn">Settings</Link>
            <Link href="/account-hub" className="btn">Account Hub</Link>
            {user?.isAdmin && <Link href="/dashboard/admin" className="btn primary">Admin Directory</Link>}
          </div>
        </div>

        <div className="card">
          <h3 style={{ marginTop: 0 }}>Your organizations</h3>
          {organizations.length === 0 ? (
            <p style={{ color: '#94a3b8', fontSize: '0.9rem' }}>No organization membership found.</p>
          ) : (
            <ul style={{ margin: '0 0 12px', paddingLeft: '1.1rem', fontSize: '0.88rem' }}>
              {organizations.map((o) => (
                <li key={o.id} style={{ marginBottom: 6 }}>
                  <strong>{o.name}</strong>
                  {o.isActive && <span style={{ color: '#10b981', marginLeft: 6 }}>active session</span>}
                  <span style={{ color: '#64748b', marginLeft: 6 }}>{o.plan || 'starter'}{o.role ? ` · ${o.role}` : ''}</span>
                </li>
              ))}
            </ul>
          )}
          <h4 style={{ margin: '0 0 8px', fontSize: '0.95rem' }}>Campaigns {org?.name ? `— ${org.name}` : ''}</h4>
          {projects.length === 0 ? (
            <p style={{ color: '#94a3b8', fontSize: '0.9rem' }}>No campaigns in this org — run the Setup Wizard.</p>
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
          {allProjects.length > projects.length && (
            <p className="settings-panel-desc" style={{ marginTop: 10 }}>
              {allProjects.length} campaign(s) total across {organizations.length} organization(s).
            </p>
          )}
        </div>
      </div>

      <div className="card" style={{ marginTop: '1rem' }}>
        <h3 style={{ marginTop: 0 }}>Site discovery — sitemap &amp; feed</h3>
        <p style={{ color: '#94a3b8', fontSize: '0.88rem', marginTop: 0 }}>
          Public SEO discovery only (marketing + blog). Sitemap lists {discovery.sitemapTotal} crawlable URLs;
          RSS lists {discovery.feedTotal} published articles. Private app modules are excluded from the public sitemap.
        </p>
        <div className="grid grid-2" style={{ marginBottom: 12 }}>
          <MetricTile label="Sitemap URLs" value={discovery.sitemapTotal} sub="/sitemap.html · /sitemap.xml" />
          <MetricTile label="RSS articles" value={discovery.feedTotal} sub="/feed.xml" />
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