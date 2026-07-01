'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { apiFetch } from '@/lib/api';
import { MetricTile } from '@/components/DashboardViz';

type AdminUser = {
  id: string;
  email: string;
  name?: string | null;
  createdAt: string;
  isAdmin?: boolean;
  organizations: Array<{
    id: string;
    name: string;
    slug: string;
    plan: string;
    role: string;
    projects: Array<{ id: string; name: string; brandName?: string; domain?: string; isActive?: boolean }>;
    billing?: { planName?: string; status?: string };
  }>;
};

type AdminDirectory = {
  summary?: { userCount?: number; orgCount?: number; projectCount?: number };
  users?: AdminUser[];
  organizations?: Array<{
    id: string;
    name: string;
    slug: string;
    plan: string;
    memberCount: number;
    projects: Array<{ id: string; name: string }>;
  }>;
};

export function AdminDirectoryPanel() {
  const [data, setData] = useState<AdminDirectory | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await apiFetch('/api/admin/directory') as AdminDirectory;
      setData(res);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load().catch(console.error);
  }, [load]);

  const filteredUsers = useMemo(() => {
    const users = data?.users || [];
    const q = filter.trim().toLowerCase();
    if (!q) return users;
    return users.filter(
      (u) =>
        u.email.toLowerCase().includes(q)
        || (u.name || '').toLowerCase().includes(q)
        || u.organizations.some((o) => o.name.toLowerCase().includes(q) || o.slug.toLowerCase().includes(q)),
    );
  }, [data?.users, filter]);

  if (loading) {
    return <p style={{ color: '#94a3b8', fontSize: '0.9rem' }}>Loading platform directory…</p>;
  }

  if (error) {
    return (
      <div className="card" style={{ borderColor: '#ef4444' }}>
        <p style={{ margin: 0 }}>{error}</p>
        <button type="button" className="btn" onClick={() => load()} style={{ marginTop: 8 }}>Retry</button>
      </div>
    );
  }

  const summary = data?.summary || {};

  return (
    <div>
      <div className="grid grid-4" style={{ marginBottom: '1rem' }}>
        <MetricTile label="Users" value={summary.userCount ?? 0} sub="all accounts" />
        <MetricTile label="Organizations" value={summary.orgCount ?? 0} sub="tenants" />
        <MetricTile label="Projects" value={summary.projectCount ?? 0} sub="campaigns" />
        <MetricTile label="Filtered" value={filteredUsers.length} sub="visible rows" />
      </div>

      <div className="card" style={{ marginBottom: '1rem' }}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 12 }}>
          <input
            className="input"
            placeholder="Filter by email, name, or org…"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            style={{ flex: '1 1 200px', maxWidth: 360 }}
          />
          <button type="button" className="btn" onClick={() => load()}>Refresh</button>
          <Link href="/dashboard/users" className="btn">My Account</Link>
          <a href="/sitemap.html" target="_blank" rel="noopener noreferrer" className="btn">sitemap.html</a>
          <a href="/feed.xml" target="_blank" rel="noopener noreferrer" className="btn">feed.xml</a>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', fontSize: '0.82rem', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ textAlign: 'left', borderBottom: '1px solid #334155' }}>
                <th style={{ padding: '8px 6px' }}>User</th>
                <th style={{ padding: '8px 6px' }}>Role</th>
                <th style={{ padding: '8px 6px' }}>Organizations</th>
                <th style={{ padding: '8px 6px' }}>Campaigns</th>
                <th style={{ padding: '8px 6px' }}>Joined</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map((u) => {
                const projectCount = u.organizations.reduce((n, o) => n + o.projects.length, 0);
                return (
                  <tr key={u.id} style={{ borderBottom: '1px solid #1e293b' }}>
                    <td style={{ padding: '8px 6px' }}>
                      <div>{u.email}</div>
                      {u.name && <div style={{ color: '#64748b', fontSize: '0.75rem' }}>{u.name}</div>}
                    </td>
                    <td style={{ padding: '8px 6px' }}>
                      {u.isAdmin ? <span style={{ color: '#a855f7' }}>Admin</span> : 'User'}
                    </td>
                    <td style={{ padding: '8px 6px' }}>
                      {u.organizations.map((o) => (
                        <div key={o.id}>
                          {o.name} <span style={{ color: '#64748b' }}>({o.plan})</span>
                        </div>
                      ))}
                    </td>
                    <td style={{ padding: '8px 6px' }}>{projectCount}</td>
                    <td style={{ padding: '8px 6px', color: '#64748b', whiteSpace: 'nowrap' }}>
                      {new Date(u.createdAt).toLocaleDateString()}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {filteredUsers.length === 0 && (
          <p style={{ color: '#94a3b8', marginTop: 12 }}>No users match your filter.</p>
        )}
      </div>

      {(data?.organizations || []).length > 0 && (
        <div className="card">
          <h3 style={{ marginTop: 0 }}>All organizations</h3>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', fontSize: '0.82rem', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ textAlign: 'left', borderBottom: '1px solid #334155' }}>
                  <th style={{ padding: '8px 6px' }}>Org</th>
                  <th style={{ padding: '8px 6px' }}>Plan</th>
                  <th style={{ padding: '8px 6px' }}>Members</th>
                  <th style={{ padding: '8px 6px' }}>Projects</th>
                </tr>
              </thead>
              <tbody>
                {(data?.organizations || []).map((o) => (
                  <tr key={o.id} style={{ borderBottom: '1px solid #1e293b' }}>
                    <td style={{ padding: '8px 6px' }}>{o.name} <span style={{ color: '#64748b' }}>{o.slug}</span></td>
                    <td style={{ padding: '8px 6px' }}>{o.plan}</td>
                    <td style={{ padding: '8px 6px' }}>{o.memberCount}</td>
                    <td style={{ padding: '8px 6px' }}>{o.projects.length}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}