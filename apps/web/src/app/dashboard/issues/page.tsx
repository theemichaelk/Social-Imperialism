'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { invoke } from '@/lib/api';
import { checkPlatformAdmin } from '@/lib/adminAccess';
import { PageShell } from '@/components/PageShell';
import { DataPanel, LivePulse, MetricTile, SparkRow } from '@/components/DashboardViz';
import { SectionLivePanel } from '@/components/SectionLivePanel';
import { type IssueLedgerEntry, type PlatformIssue } from '@/lib/issueControlPlane';

function severityColor(sev: string) {
  if (sev === 'critical' || sev === 'high') return '#f87171';
  if (sev === 'medium') return '#fbbf24';
  return '#34d399';
}

export default function DashboardIssuesPage() {
  const router = useRouter();
  const [authorized, setAuthorized] = useState<boolean | null>(null);
  const [active, setActive] = useState<PlatformIssue[]>([]);
  const [ledger, setLedger] = useState<IssueLedgerEntry[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editPatch, setEditPatch] = useState('');
  const [msg, setMsg] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    checkPlatformAdmin()
      .then((ok) => {
        if (!ok) {
          router.replace('/dashboard');
          return;
        }
        setAuthorized(true);
      })
      .catch(() => router.replace('/login'));
  }, [router]);

  const selected = active.find((x) => x.id === selectedId) || null;

  const refresh = useCallback(async () => {
    const [a, l] = await Promise.all([
      invoke<{ issues?: PlatformIssue[] }>('get-active-issues'),
      invoke<{ ledger?: IssueLedgerEntry[] }>('get-issues-ledger'),
    ]);
    setActive(a?.issues || []);
    setLedger(l?.ledger || []);
    if (!selectedId && a?.issues?.length) setSelectedId(a.issues[0].id);
  }, [selectedId]);

  useEffect(() => {
    if (authorized !== true) return;
    refresh().catch((e) => setMsg((e as Error).message));
  }, [refresh, authorized]);

  useEffect(() => {
    if (selected?.patchCode) setEditPatch(selected.patchCode);
  }, [selected?.id, selected?.patchCode]);

  async function act(fn: () => Promise<unknown>, ok: string) {
    setLoading(true);
    try {
      await fn();
      setMsg(ok);
      await refresh();
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function runGuardianScan() {
    setLoading(true);
    setMsg('Running Guardian scan…');
    try {
      const res = await invoke<{ success?: boolean; alertCount?: number; error?: string }>('run-guardian-scan');
      if (res.success === false) throw new Error(res.error || 'Guardian scan failed');
      setMsg(`Guardian scan complete — ${res.alertCount ?? 0} alert(s)`);
      await refresh();
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  if (authorized !== true) {
    return (
      <div className="dash-loading" style={{ minHeight: '40vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ color: '#94a3b8', fontSize: '0.9rem' }}>Verifying administrator access…</p>
      </div>
    );
  }

  return (
    <div>
      <PageShell
        title="Issue Control Plane"
        subtitle="THEE_MICHAEL Web-Augmented GitOps — Approve, deny, edit, or delete runtime repair tickets"
        eyebrow="Dashboard / Issues"
        actions={
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button type="button" className="btn primary" onClick={runGuardianScan} disabled={loading}>Run Guardian Scan</button>
            <button type="button" className="btn" onClick={() => refresh()} disabled={loading}>Refresh</button>
            <Link href="/settings?tab=guardian-api" className="btn">Guardian Settings</Link>
          </div>
        }
      />

      <SectionLivePanel section="dashboard-issues" />

      {msg && (
        <div className="card" style={{ marginBottom: '1rem', borderColor: '#38bdf8' }}>
          <p style={{ margin: 0, fontSize: '0.9rem' }}>{msg}</p>
        </div>
      )}

      <div className="grid grid-3" style={{ marginBottom: '1rem' }}>
        <MetricTile label="Pending Review" value={active.length} sub="Active queue" accent="#f59e0b" />
        <MetricTile label="Ledger Entries" value={ledger.length} sub="Historical audit" accent="#38bdf8" />
        <MetricTile label="Engine" value="V12" sub="Web-augmented repair" accent="#22c55e" />
      </div>

      <div className="grid grid-2">
        <DataPanel title="Active Issues Queue" live>
          <SparkRow items={[
            { label: 'Queue', value: active.length, status: active.length ? 'warn' : 'ok' },
            { label: 'Ledger', value: ledger.length },
            { label: 'Worker', value: loading ? 'BUSY' : 'idle', status: loading ? 'warn' : 'off' },
          ]} />
          <div style={{ maxHeight: 420, overflowY: 'auto', marginTop: 12 }}>
            {active.length === 0 && (
              <p className="settings-panel-desc">
                No pending issues — Guardian scan and runtime interceptors are monitoring.
                Use <strong>Run Guardian Scan</strong> to enqueue diagnostics from the latest health pass.
              </p>
            )}
            {active.map((issue) => (
              <button
                key={issue.id}
                type="button"
                className="post-card"
                style={{
                  width: '100%',
                  textAlign: 'left',
                  marginBottom: 8,
                  border: selectedId === issue.id ? '1px solid #38bdf8' : undefined,
                  cursor: 'pointer',
                }}
                onClick={() => setSelectedId(issue.id)}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: '#94a3b8' }}>{issue.issueSignature}</span>
                  <span className="badge" style={{ color: severityColor(issue.severity) }}>{issue.severity}</span>
                </div>
                <p style={{ margin: '6px 0 0', fontSize: '0.9rem' }}>{issue.rootCause || issue.errorCode}</p>
                <p className="settings-panel-desc" style={{ margin: '4px 0 0' }}>{issue.filePath} · {issue.platform || 'multi'}</p>
              </button>
            ))}
          </div>
        </DataPanel>

        <DataPanel title="Patch Workspace" live>
          {!selected ? (
            <p className="settings-panel-desc">Select an issue to review the web-augmented patch.</p>
          ) : (
            <>
              <div className="settings-panel-desc" style={{ marginBottom: 12 }}>
                <p style={{ margin: '0 0 6px' }}><strong>Component:</strong> {selected.component || '—'}</p>
                <p style={{ margin: 0 }}><strong>Root cause:</strong> {selected.rootCause}</p>
                {selected.webSources?.length ? (
                  <div style={{ marginTop: 8 }}>
                    <strong>Web sources:</strong>
                    <ul style={{ margin: '6px 0 0', paddingLeft: '1.1rem', fontSize: '0.82rem' }}>
                      {selected.webSources.slice(0, 3).map((s, i) => (
                        <li key={i}>
                          <a href={s.url} target="_blank" rel="noreferrer" style={{ color: '#38bdf8' }}>{s.title}</a>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </div>
              <textarea
                className="input"
                style={{ minHeight: 180, fontFamily: 'var(--font-mono)', fontSize: '0.78rem' }}
                value={editPatch}
                onChange={(e) => setEditPatch(e.target.value)}
              />
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
                <button type="button" className="btn primary" disabled={loading} onClick={() => act(
                  () => invoke('approve-issue-patch', { issueId: selected.id, actedBy: 'THEE_MICHAEL' }),
                  'Patch approved — sandbox validation queued',
                )}>Approve</button>
                <button type="button" className="btn" disabled={loading} onClick={() => act(
                  () => invoke('deny-issue-patch', { issueId: selected.id, quarantinePlatform: true, actedBy: 'THEE_MICHAEL' }),
                  'Patch denied — platform quarantined',
                )}>Deny</button>
                <button type="button" className="btn" disabled={loading} onClick={() => act(
                  () => invoke('edit-issue-patch', { issueId: selected.id, patchCode: editPatch, actedBy: 'THEE_MICHAEL' }),
                  'Patch saved',
                )}>Save Edit</button>
                <button type="button" className="btn" disabled={loading} onClick={() => act(
                  () => invoke('dispatch-issue-diagnostic-email', { issueId: selected.id }),
                  'Diagnostic email dispatched',
                )}>Email Report</button>
                <button type="button" className="btn" disabled={loading} onClick={() => act(
                  () => invoke('delete-issue', { issueId: selected.id, actedBy: 'THEE_MICHAEL' }),
                  'Issue removed from queue',
                )}>Delete</button>
              </div>
              <pre className="post-card" style={{ marginTop: 12, maxHeight: 120, overflow: 'auto', fontSize: '0.72rem', color: '#94a3b8' }}>{selected.traceback}</pre>
            </>
          )}
        </DataPanel>
      </div>

      <DataPanel title="Past Issues Ledger" live className="grid-span-2">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
          <LivePulse label={ledger.length ? 'AUDIT' : 'EMPTY'} />
          <span className="settings-panel-desc" style={{ margin: 0 }}>
            {ledger.length ? `${ledger.length} historical repair action(s)` : 'No ledger entries yet — approvals and denials appear here.'}
          </span>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', fontSize: '0.82rem', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ textAlign: 'left', borderBottom: '1px solid #334155' }}>
                <th style={{ padding: '8px 6px' }}>When</th>
                <th style={{ padding: '8px 6px' }}>Action</th>
                <th style={{ padding: '8px 6px' }}>Signature</th>
                <th style={{ padding: '8px 6px' }}>Outcome</th>
                <th style={{ padding: '8px 6px' }}>Ops</th>
              </tr>
            </thead>
            <tbody>
              {ledger.map((row) => (
                <tr key={row.id} style={{ borderBottom: '1px solid #1e293b' }}>
                  <td style={{ padding: '8px 6px', color: '#64748b', whiteSpace: 'nowrap' }}>
                    {row.createdAt ? new Date(row.createdAt).toLocaleString() : '—'}
                  </td>
                  <td style={{ padding: '8px 6px' }}>{row.action}</td>
                  <td style={{ padding: '8px 6px', fontFamily: 'var(--font-mono)', fontSize: '0.75rem' }}>{row.issueSignature}</td>
                  <td style={{ padding: '8px 6px', color: '#94a3b8' }}>{row.outcome || '—'}</td>
                  <td style={{ padding: '8px 6px' }}>
                    <button
                      type="button"
                      className="btn"
                      style={{ fontSize: '0.75rem', padding: '2px 8px' }}
                      disabled={loading}
                      onClick={() => act(
                        () => invoke('delete-issue', { fromLedger: true, ledgerId: row.id }),
                        'Ledger entry removed',
                      )}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!ledger.length && (
            <p className="settings-panel-desc" style={{ marginTop: 12 }}>Ledger is empty — no repair tickets have been approved or denied yet.</p>
          )}
        </div>
      </DataPanel>
    </div>
  );
}