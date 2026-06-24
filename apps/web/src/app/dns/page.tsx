'use client';

import { useCallback, useEffect, useState } from 'react';
import { invoke } from '@/lib/api';
import { PageHeader } from '@/components/PageHeader';
import { DataPanel, MetricTile } from '@/components/DashboardViz';

type DnsSite = {
  id: string;
  domain: string;
  name: string;
  source?: string;
  scope?: string;
  projectId?: string;
  status?: string;
  hostedZoneId?: string;
};

type DnsRecord = {
  id: string;
  type: string;
  name: string;
  value: string;
  ttl: number;
  priority?: number;
  alias?: boolean;
  status?: string;
};

type DnsConfig = {
  recordTypes?: string[];
  route53Configured?: boolean;
  defaultHostedZone?: string | null;
};

const EMPTY_RECORD = { type: 'A', name: '@', value: '', ttl: 300, priority: undefined as number | undefined };

export default function DnsPage() {
  const [sites, setSites] = useState<DnsSite[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [selectedId, setSelectedId] = useState('');
  const [records, setRecords] = useState<DnsRecord[]>([]);
  const [config, setConfig] = useState<DnsConfig>({});
  const [newSiteDomain, setNewSiteDomain] = useState('');
  const [newSiteName, setNewSiteName] = useState('');
  const [draft, setDraft] = useState({ ...EMPTY_RECORD });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [msg, setMsg] = useState('');
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState('');

  const selected = sites.find((s) => s.id === selectedId);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [siteRes, cfg] = await Promise.all([
        invoke<{ sites?: DnsSite[]; isAdmin?: boolean }>('get-dns-sites'),
        invoke<DnsConfig>('get-dns-config'),
      ]);
      const list = siteRes.sites || [];
      setSites(list);
      setIsAdmin(!!siteRes.isAdmin);
      setConfig(cfg);
      if (!selectedId && list.length) setSelectedId(list[0].id);
      else if (selectedId && !list.find((s) => s.id === selectedId) && list.length) {
        setSelectedId(list[0].id);
      }
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [selectedId]);

  const loadRecords = useCallback(async (siteId: string) => {
    if (!siteId) return;
    const res = await invoke<{ records?: DnsRecord[]; error?: string }>('get-dns-records', siteId);
    if (res.error) { setMsg(res.error); return; }
    setRecords(res.records || []);
  }, []);

  useEffect(() => { refresh().catch(console.error); }, [refresh]);
  useEffect(() => {
    if (selectedId) loadRecords(selectedId).catch(console.error);
  }, [selectedId, loadRecords]);

  async function syncSites() {
    setBusy('sync');
    try {
      const res = await invoke<{ count?: number; error?: string }>('sync-dns-sites');
      setMsg(`Synced ${res.count ?? 0} site(s) from campaigns & Quantum Pages`);
      await refresh();
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setBusy('');
    }
  }

  async function addSite() {
    const domain = newSiteDomain.trim();
    if (!domain) { setMsg('Enter a domain'); return; }
    setBusy('add-site');
    try {
      const res = await invoke<{ success?: boolean; site?: DnsSite; error?: string }>('add-dns-site', {
        domain,
        name: newSiteName.trim() || domain,
      });
      if (!res.success) { setMsg(res.error || 'Failed to add site'); return; }
      setNewSiteDomain('');
      setNewSiteName('');
      setMsg(`Added ${domain}`);
      await refresh();
      if (res.site?.id) setSelectedId(res.site.id);
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setBusy('');
    }
  }

  async function saveRecord() {
    if (!selectedId) return;
    setBusy('save');
    try {
      const res = await invoke<{ success?: boolean; error?: string }>('save-dns-record', {
        siteId: selectedId,
        record: editingId ? { ...draft, id: editingId } : draft,
      });
      if (!res.success) { setMsg(res.error || 'Save failed'); return; }
      setDraft({ ...EMPTY_RECORD });
      setEditingId(null);
      setMsg('Record saved');
      await loadRecords(selectedId);
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setBusy('');
    }
  }

  async function deleteRecord(recordId: string) {
    if (!selectedId || !confirm('Delete this DNS record?')) return;
    await invoke('delete-dns-record', { siteId: selectedId, recordId });
    await loadRecords(selectedId);
    setMsg('Record deleted');
  }

  async function verifyRecord(recordId: string) {
    if (!selectedId) return;
    setBusy(`verify-${recordId}`);
    try {
      const res = await invoke<{ ok?: boolean; resolved?: unknown; host?: string; error?: string }>(
        'verify-dns-record', { siteId: selectedId, recordId },
      );
      setMsg(res.ok ? `Verified OK — ${res.host}` : `Not propagated yet — ${res.host || res.error || ''}`);
    } finally {
      setBusy('');
    }
  }

  async function applyToRoute53() {
    if (!selectedId || !confirm(`Apply ${records.length} record(s) to Route53 for ${selected?.domain}?`)) return;
    setBusy('apply');
    try {
      const res = await invoke<{ success?: boolean; changeId?: string; error?: string; applied?: number }>(
        'apply-dns-records', selectedId,
      );
      if (!res.success) { setMsg(res.error || 'Apply failed'); return; }
      setMsg(`Applied ${res.applied} record(s) — change ${res.changeId || 'queued'}`);
      await loadRecords(selectedId);
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setBusy('');
    }
  }

  async function exportRecords() {
    if (!selectedId) return;
    const data = await invoke<Record<string, unknown>>('export-dns-records', selectedId);
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `dns-${selected?.domain || 'export'}.json`;
    a.click();
    setMsg('DNS export downloaded');
  }

  function startEdit(rec: DnsRecord) {
    setEditingId(rec.id);
    setDraft({ type: rec.type, name: rec.name, value: rec.value, ttl: rec.ttl, priority: rec.priority });
  }

  const scopeLabel = (s: DnsSite) => {
    if (s.scope === 'admin') return 'Admin';
    if (s.source === 'quantum') return 'Quantum Pages';
    if (s.source === 'project') return 'Campaign';
    return 'Manual';
  };

  return (
    <div className="page-stack">
      <PageHeader
        title="DNS Management"
        subtitle={isAdmin
          ? 'Admin view — all platform sites, Quantum Pages, and every client campaign domain'
          : 'Manage DNS records for your sites'}
      />

      {msg && (
        <div className="card" style={{ borderColor: 'rgba(56,189,248,0.4)', marginBottom: 12 }}>
          <p style={{ margin: 0, fontSize: '0.9rem' }}>{msg}</p>
        </div>
      )}

      <div className="grid grid-4" style={{ marginBottom: 16 }}>
        <MetricTile label="Sites" value={sites.length} sub={isAdmin ? 'admin access' : 'your sites'} />
        <MetricTile label="Records" value={records.length} sub={selected?.domain || '—'} />
        <MetricTile label="Route53" value={config.route53Configured ? 'Ready' : 'Off'} sub={config.defaultHostedZone || 'auto-detect'} />
        <MetricTile label="Role" value={isAdmin ? 'Admin' : 'Client'} sub="DNS access" />
      </div>

      <div className="grid grid-2">
        <DataPanel title="Sites" live>
          <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
            <button className="btn btn-sm" onClick={syncSites} disabled={busy === 'sync'}>Sync from campaigns</button>
          </div>
          <div className="site-picker-grid">
            {sites.map((s) => (
              <button
                key={s.id}
                type="button"
                className={`site-picker-chip ${selectedId === s.id ? 'active' : ''}`}
                onClick={() => setSelectedId(s.id)}
              >
                <strong>{s.domain}</strong>
                <span style={{ display: 'block', fontSize: '0.75rem', opacity: 0.8 }}>{scopeLabel(s)}</span>
              </button>
            ))}
            {!sites.length && !loading && (
              <p style={{ color: '#94a3b8', fontSize: '0.85rem' }}>No sites yet — add one or sync from campaigns.</p>
            )}
          </div>

          <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid rgba(148,163,184,0.2)' }}>
            <p className="settings-panel-desc">Add any domain — it gets its own DNS section automatically.</p>
            <input className="input" placeholder="domain.com" value={newSiteDomain} onChange={(e) => setNewSiteDomain(e.target.value)} style={{ marginBottom: 8 }} />
            <input className="input" placeholder="Site name (optional)" value={newSiteName} onChange={(e) => setNewSiteName(e.target.value)} style={{ marginBottom: 8 }} />
            <button className="btn" onClick={addSite} disabled={busy === 'add-site'}>Add Site</button>
          </div>
        </DataPanel>

        <DataPanel title={selected ? `DNS Records — ${selected.domain}` : 'DNS Records'} live>
          {selected ? (
            <>
              <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
                {config.route53Configured && (
                  <button className="btn btn-sm" onClick={applyToRoute53} disabled={busy === 'apply' || !records.length}>
                    Apply to Route53
                  </button>
                )}
                <button className="btn btn-sm" onClick={exportRecords}>Export JSON</button>
              </div>

              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', fontSize: '0.82rem', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ textAlign: 'left', color: '#94a3b8' }}>
                      <th style={{ padding: '6px 8px' }}>Type</th>
                      <th style={{ padding: '6px 8px' }}>Name</th>
                      <th style={{ padding: '6px 8px' }}>Value</th>
                      <th style={{ padding: '6px 8px' }}>TTL</th>
                      <th style={{ padding: '6px 8px' }}>Status</th>
                      <th style={{ padding: '6px 8px' }} />
                    </tr>
                  </thead>
                  <tbody>
                    {records.map((r) => (
                      <tr key={r.id} style={{ borderTop: '1px solid rgba(148,163,184,0.15)' }}>
                        <td style={{ padding: '6px 8px' }}>{r.type}</td>
                        <td style={{ padding: '6px 8px' }}>{r.name}</td>
                        <td style={{ padding: '6px 8px', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis' }} title={r.value}>{r.value}</td>
                        <td style={{ padding: '6px 8px' }}>{r.ttl}</td>
                        <td style={{ padding: '6px 8px' }}>{r.status || 'draft'}</td>
                        <td style={{ padding: '6px 8px', whiteSpace: 'nowrap' }}>
                          <button className="btn btn-sm" style={{ marginRight: 4 }} onClick={() => startEdit(r)}>Edit</button>
                          <button className="btn btn-sm" style={{ marginRight: 4 }} onClick={() => verifyRecord(r.id)} disabled={busy === `verify-${r.id}`}>Verify</button>
                          <button className="btn btn-sm" onClick={() => deleteRecord(r.id)}>Del</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {!records.length && <p style={{ color: '#94a3b8', marginTop: 12 }}>No records — add one below.</p>}
              </div>

              <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid rgba(148,163,184,0.2)' }}>
                <p style={{ margin: '0 0 8px', fontWeight: 600 }}>{editingId ? 'Edit Record' : 'Add Record'}</p>
                <div className="grid grid-2" style={{ gap: 8 }}>
                  <select className="input" value={draft.type} onChange={(e) => setDraft({ ...draft, type: e.target.value })}>
                    {(config.recordTypes || ['A', 'AAAA', 'CNAME', 'MX', 'TXT', 'NS']).map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                  <input className="input" placeholder="Name (@ or www)" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
                  <input className="input" placeholder="Value" value={draft.value} onChange={(e) => setDraft({ ...draft, value: e.target.value })} style={{ gridColumn: '1 / -1' }} />
                  <input className="input" type="number" placeholder="TTL" value={draft.ttl} onChange={(e) => setDraft({ ...draft, ttl: parseInt(e.target.value, 10) || 300 })} />
                </div>
                <div style={{ marginTop: 8, display: 'flex', gap: 8 }}>
                  <button className="btn" onClick={saveRecord} disabled={busy === 'save'}>{editingId ? 'Update' : 'Add'} Record</button>
                  {editingId && (
                    <button className="btn" onClick={() => { setEditingId(null); setDraft({ ...EMPTY_RECORD }); }}>Cancel</button>
                  )}
                </div>
              </div>
            </>
          ) : (
            <p style={{ color: '#94a3b8' }}>Select a site to manage DNS records.</p>
          )}
        </DataPanel>
      </div>
    </div>
  );
}