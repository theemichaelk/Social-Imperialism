'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { apiFetch, invoke } from '@/lib/api';
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
    billing?: { planName?: string; status?: string; billingEmail?: string };
    projects: Array<{ id: string; name: string }>;
  }>;
};

function statusColor(status?: string) {
  if (status === 'active') return '#22c55e';
  if (status === 'past_due') return '#f59e0b';
  if (status === 'suspended') return '#f97316';
  if (status === 'canceled') return '#ef4444';
  return '#64748b';
}

export function AdminDirectoryPanel() {
  const [data, setData] = useState<AdminDirectory | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState('');
  const [filter, setFilter] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await apiFetch('/api/admin/directory') as AdminDirectory;
      setData(res);
      if (res.summary) {
        await invoke('cache-admin-directory-summary', {
          userCount: res.summary.userCount,
          orgCount: res.summary.orgCount,
          projectCount: res.summary.projectCount,
        }).catch(() => {});
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load().catch(console.error);
  }, [load]);

  async function subscriptionAction(orgId: string, action: 'activate' | 'suspend' | 'revoke', label: string) {
    if (!window.confirm(`${label} subscription for this organization?`)) return;
    setBusy(`${action}-${orgId}`);
    setMsg('');
    try {
      const res = await apiFetch(`/api/admin/subscriptions/${orgId}`, {
        method: 'PATCH',
        body: JSON.stringify({ action, reason: `Admin directory — ${label}` }),
      }) as { status?: string; sessionsRevoked?: number };
      setMsg(`${label} OK — status ${res.status || action}${res.sessionsRevoked ? ` · ${res.sessionsRevoked} session(s) revoked` : ''}`);
      await load();
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setBusy('');
    }
  }

  async function revokeUserSessions(userId: string, email: string) {
    if (!window.confirm(`Revoke all sessions for ${email}?`)) return;
    setBusy(`sessions-${userId}`);
    setMsg('');
    try {
      const res = await apiFetch(`/api/admin/users/${userId}/revoke-sessions`, { method: 'POST' }) as { sessionsRevoked?: number };
      setMsg(`Signed out ${email} — ${res.sessionsRevoked ?? 0} session(s) revoked`);
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setBusy('');
    }
  }

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

  const duplicateNames = useMemo(() => {
    const counts = new Map<string, number>();
    (data?.users || []).forEach((u) => {
      const key = (u.name || '').trim().toLowerCase();
      if (!key) return;
      counts.set(key, (counts.get(key) || 0) + 1);
    });
    return counts;
  }, [data?.users]);

  function uniqueProjectCount(user: AdminUser) {
    const ids = new Set<string>();
    user.organizations.forEach((o) => o.projects.forEach((p) => ids.add(p.id)));
    return ids.size;
  }

  const adminCount = (data?.users || []).filter((u) => u.isAdmin).length;
  const filterActive = filter.trim().length > 0;

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
        <MetricTile
          label={filterActive ? 'Filtered' : 'Admins'}
          value={filterActive ? filteredUsers.length : adminCount}
          sub={filterActive ? 'visible rows' : 'platform'}
        />
      </div>

      {msg && (
        <div className="card" style={{ marginBottom: '1rem', borderColor: /fail|error/i.test(msg) ? '#ef4444' : '#22c55e' }}>
          <p style={{ margin: 0, fontSize: '0.88rem' }}>{msg}</p>
        </div>
      )}

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
          <Link href="/dashboard/issues" className="btn">Issue Control</Link>
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
                <th style={{ padding: '8px 6px' }}>Subscription</th>
                <th style={{ padding: '8px 6px' }}>Campaigns</th>
                <th style={{ padding: '8px 6px' }}>Joined</th>
                <th style={{ padding: '8px 6px' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map((u) => {
                const projectCount = uniqueProjectCount(u);
                const nameKey = (u.name || '').trim().toLowerCase();
                const sharedName = nameKey && (duplicateNames.get(nameKey) || 0) > 1;
                return (
                  <tr key={u.id} style={{ borderBottom: '1px solid #1e293b' }}>
                    <td style={{ padding: '8px 6px' }}>
                      <div>{u.email}</div>
                      {u.name && (
                        <div style={{ color: '#64748b', fontSize: '0.75rem' }}>
                          {u.name}
                          {sharedName && <span style={{ color: '#f59e0b', marginLeft: 6 }}>shared name</span>}
                        </div>
                      )}
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
                    <td style={{ padding: '8px 6px' }}>
                      {u.organizations.map((o) => (
                        <div key={o.id} style={{ color: statusColor(o.billing?.status), fontSize: '0.78rem' }}>
                          {o.billing?.status || '—'}
                          {o.billing?.planName ? ` · ${o.billing.planName}` : ''}
                        </div>
                      ))}
                    </td>
                    <td style={{ padding: '8px 6px' }}>{projectCount}</td>
                    <td style={{ padding: '8px 6px', color: '#64748b', whiteSpace: 'nowrap' }}>
                      {new Date(u.createdAt).toLocaleDateString()}
                    </td>
                    <td style={{ padding: '8px 6px', whiteSpace: 'nowrap' }}>
                      {!u.isAdmin && (
                        <button type="button" className="btn btn-sm" disabled={!!busy} onClick={() => revokeUserSessions(u.id, u.email)}>
                          Sign out
                        </button>
                      )}
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
                  <th style={{ padding: '8px 6px' }}>Status</th>
                  <th style={{ padding: '8px 6px' }}>Members</th>
                  <th style={{ padding: '8px 6px' }}>Projects</th>
                  <th style={{ padding: '8px 6px' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {(data?.organizations || []).map((o) => (
                  <tr key={o.id} style={{ borderBottom: '1px solid #1e293b' }}>
                    <td style={{ padding: '8px 6px' }}>{o.name} <span style={{ color: '#64748b' }}>· {o.slug}</span></td>
                    <td style={{ padding: '8px 6px' }}>{o.billing?.planName || o.plan}</td>
                    <td style={{ padding: '8px 6px', color: statusColor(o.billing?.status) }}>{o.billing?.status || '—'}</td>
                    <td style={{ padding: '8px 6px' }}>{o.memberCount}</td>
                    <td style={{ padding: '8px 6px' }}>{o.projects.length}</td>
                    <td style={{ padding: '8px 6px' }}>
                      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                        <button type="button" className="btn btn-sm" disabled={!!busy} onClick={() => subscriptionAction(o.id, 'suspend', 'Suspend')}>Suspend</button>
                        <button type="button" className="btn btn-sm" disabled={!!busy} onClick={() => subscriptionAction(o.id, 'revoke', 'Revoke')}>Revoke</button>
                        <button type="button" className="btn btn-sm" disabled={!!busy} onClick={() => subscriptionAction(o.id, 'activate', 'Activate')}>Activate</button>
                      </div>
                    </td>
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