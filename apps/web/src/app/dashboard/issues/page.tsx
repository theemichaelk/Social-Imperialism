'use client';

import { useCallback, useEffect, useState } from 'react';
import { invoke } from '@/lib/api';
import { PageShell } from '@/components/PageShell';
import { DataPanel } from '@/components/DashboardViz';
import { type IssueLedgerEntry, type PlatformIssue, severityClass } from '@/lib/issueControlPlane';

export default function DashboardIssuesPage() {
  const [active, setActive] = useState<PlatformIssue[]>([]);
  const [ledger, setLedger] = useState<IssueLedgerEntry[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editPatch, setEditPatch] = useState('');
  const [msg, setMsg] = useState('');
  const [loading, setLoading] = useState(false);

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
    refresh().catch((e) => setMsg((e as Error).message));
  }, [refresh]);

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

  return (
    <PageShell
      title="Issue Control Plane"
      subtitle="THEE_MICHAEL Web-Augmented GitOps — Approve, deny, edit, or delete runtime repair tickets"
      eyebrow="Dashboard / Issues"
    >
      {msg && (
        <div className="mb-4 rounded-lg border border-cyan-500/30 bg-cyan-950/40 px-4 py-2 text-sm text-cyan-100">
          {msg}
        </div>
      )}

      <div className="mb-6 grid gap-4 md:grid-cols-3">
        <DataPanel title="Pending Review" value={String(active.length)} hint="Active queue" />
        <DataPanel title="Ledger Entries" value={String(ledger.length)} hint="Historical audit" />
        <DataPanel title="Engine" value="V12" hint="Web-augmented repair" />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-xl border border-white/10 bg-black/40 p-4">
          <h2 className="mb-3 text-lg font-semibold text-white">Active Issues Queue</h2>
          <div className="max-h-[420px] space-y-2 overflow-y-auto">
            {active.length === 0 && (
              <p className="text-sm text-zinc-400">No pending issues — Guardian scan and runtime interceptors are monitoring.</p>
            )}
            {active.map((issue) => (
              <button
                key={issue.id}
                type="button"
                onClick={() => setSelectedId(issue.id)}
                className={`w-full rounded-lg border px-3 py-2 text-left transition ${
                  selectedId === issue.id ? 'border-cyan-400/60 bg-cyan-950/30' : 'border-white/10 hover:border-white/20'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-xs text-zinc-400">{issue.issueSignature}</span>
                  <span className={`text-xs font-medium ${severityClass(issue.severity)}`}>{issue.severity}</span>
                </div>
                <p className="mt-1 text-sm text-white">{issue.rootCause || issue.errorCode}</p>
                <p className="text-xs text-zinc-500">{issue.filePath} · {issue.platform || 'multi'}</p>
              </button>
            ))}
          </div>
        </section>

        <section className="rounded-xl border border-white/10 bg-black/40 p-4">
          <h2 className="mb-3 text-lg font-semibold text-white">Patch Workspace</h2>
          {!selected ? (
            <p className="text-sm text-zinc-400">Select an issue to review the web-augmented patch.</p>
          ) : (
            <>
              <div className="mb-3 space-y-1 text-sm text-zinc-300">
                <p><strong>Component:</strong> {selected.component || '—'}</p>
                <p><strong>Root cause:</strong> {selected.rootCause}</p>
                {selected.webSources?.length ? (
                  <div>
                    <strong>Web sources:</strong>
                    <ul className="mt-1 list-disc pl-5 text-xs text-cyan-300">
                      {selected.webSources.slice(0, 3).map((s, i) => (
                        <li key={i}>
                          <a href={s.url} target="_blank" rel="noreferrer" className="underline">{s.title}</a>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </div>
              <textarea
                className="h-48 w-full rounded-lg border border-white/10 bg-black/60 p-3 font-mono text-xs text-emerald-100"
                value={editPatch}
                onChange={(e) => setEditPatch(e.target.value)}
              />
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={loading}
                  className="rounded-lg bg-emerald-600 px-3 py-1.5 text-sm text-white hover:bg-emerald-500 disabled:opacity-50"
                  onClick={() => act(
                    () => invoke('approve-issue-patch', { issueId: selected.id, actedBy: 'THEE_MICHAEL' }),
                    'Patch approved — sandbox validation queued'
                  )}
                >
                  Approve
                </button>
                <button
                  type="button"
                  disabled={loading}
                  className="rounded-lg bg-rose-700 px-3 py-1.5 text-sm text-white hover:bg-rose-600 disabled:opacity-50"
                  onClick={() => act(
                    () => invoke('deny-issue-patch', { issueId: selected.id, quarantinePlatform: true, actedBy: 'THEE_MICHAEL' }),
                    'Patch denied — platform quarantined'
                  )}
                >
                  Deny
                </button>
                <button
                  type="button"
                  disabled={loading}
                  className="rounded-lg bg-amber-700 px-3 py-1.5 text-sm text-white hover:bg-amber-600 disabled:opacity-50"
                  onClick={() => act(
                    () => invoke('edit-issue-patch', { issueId: selected.id, patchCode: editPatch, actedBy: 'THEE_MICHAEL' }),
                    'Patch saved'
                  )}
                >
                  Save Edit
                </button>
                <button
                  type="button"
                  disabled={loading}
                  className="rounded-lg border border-white/20 px-3 py-1.5 text-sm text-zinc-200 hover:bg-white/5 disabled:opacity-50"
                  onClick={() => act(
                    () => invoke('dispatch-issue-diagnostic-email', { issueId: selected.id }),
                    'Diagnostic email dispatched'
                  )}
                >
                  Email Report
                </button>
                <button
                  type="button"
                  disabled={loading}
                  className="rounded-lg border border-rose-500/40 px-3 py-1.5 text-sm text-rose-300 hover:bg-rose-950/40 disabled:opacity-50"
                  onClick={() => act(
                    () => invoke('delete-issue', { issueId: selected.id, actedBy: 'THEE_MICHAEL' }),
                    'Issue removed from queue'
                  )}
                >
                  Delete
                </button>
              </div>
              <pre className="mt-4 max-h-32 overflow-auto rounded bg-black/50 p-2 text-xs text-zinc-400">{selected.traceback}</pre>
            </>
          )}
        </section>
      </div>

      <section className="mt-6 rounded-xl border border-white/10 bg-black/40 p-4">
        <h2 className="mb-3 text-lg font-semibold text-white">Past Issues Ledger</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-zinc-300">
            <thead>
              <tr className="border-b border-white/10 text-xs uppercase text-zinc-500">
                <th className="py-2 pr-4">When</th>
                <th className="py-2 pr-4">Action</th>
                <th className="py-2 pr-4">Signature</th>
                <th className="py-2 pr-4">Outcome</th>
                <th className="py-2">Ops</th>
              </tr>
            </thead>
            <tbody>
              {ledger.map((row) => (
                <tr key={row.id} className="border-b border-white/5">
                  <td className="py-2 pr-4 text-xs">{row.createdAt ? new Date(row.createdAt).toLocaleString() : '—'}</td>
                  <td className="py-2 pr-4">{row.action}</td>
                  <td className="py-2 pr-4 font-mono text-xs">{row.issueSignature}</td>
                  <td className="py-2 pr-4 text-xs">{row.outcome || '—'}</td>
                  <td className="py-2">
                    <button
                      type="button"
                      className="text-xs text-rose-400 underline"
                      onClick={() => act(
                        () => invoke('delete-issue', { fromLedger: true, ledgerId: row.id }),
                        'Ledger entry removed'
                      )}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </PageShell>
  );
}