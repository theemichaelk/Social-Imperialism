'use client';

import { useCallback, useEffect, useState } from 'react';
import { invoke } from '@/lib/api';
import { BarChart, LivePulse } from '@/components/DashboardViz';

type AccountSettings = {
  automationEnabled?: boolean;
  frequency?: string;
  autoReply?: boolean;
  postToGroups?: boolean;
  humanDelayMin?: number;
  humanDelayMax?: number;
  humanizeContent?: boolean;
};

type AutomationAccount = {
  id: string;
  handle?: string;
  platform: string;
  type?: string;
  connectionId?: string;
  loginEmail?: string;
  settings?: AccountSettings;
};

type AutomationTarget = {
  id: string;
  name: string;
  type?: string;
  platform?: string;
  source?: string;
  automationEnabled?: boolean;
  subreddit?: string;
};

type RowState = AccountSettings & { accountId: string };

export function AutomationMatrixPanel() {
  const [accounts, setAccounts] = useState<AutomationAccount[]>([]);
  const [rows, setRows] = useState<Record<string, RowState>>({});
  const [targets, setTargets] = useState<Record<string, AutomationTarget[]>>({});
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [msg, setMsg] = useState('');
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    const data = await invoke<{ accounts?: AutomationAccount[] }>('get-automation-targets');
    const seen = new Set<string>();
    const list = (data.accounts || []).filter((a) => {
      if (!a?.id || seen.has(a.id)) return false;
      seen.add(a.id);
      return true;
    });
    setAccounts(list);
    const next: Record<string, RowState> = {};
    list.forEach((acc) => {
      const s = acc.settings || {};
      next[acc.id] = {
        accountId: acc.id,
        automationEnabled: s.automationEnabled !== false,
        frequency: s.frequency || 'auto',
        autoReply: !!s.autoReply,
        postToGroups: s.postToGroups !== false,
        humanDelayMin: s.humanDelayMin ?? 30,
        humanDelayMax: s.humanDelayMax ?? 120,
        humanizeContent: s.humanizeContent !== false,
      };
    });
    setRows(next);
  }, []);

  useEffect(() => { refresh().catch(console.error); }, [refresh]);

  async function loadTargets(accountId: string) {
    const res = await invoke<{ targets?: AutomationTarget[] }>('get-account-automation-targets', accountId);
    setTargets((prev) => ({ ...prev, [accountId]: res.targets || [] }));
  }

  async function toggleExpand(accountId: string) {
    const next = !expanded[accountId];
    setExpanded((prev) => ({ ...prev, [accountId]: next }));
    if (next && !targets[accountId]) await loadTargets(accountId);
  }

  function updateRow(id: string, patch: Partial<RowState>) {
    setRows((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }));
  }

  function toggleTarget(accountId: string, targetId: string, enabled: boolean) {
    setTargets((prev) => ({
      ...prev,
      [accountId]: (prev[accountId] || []).map((t) =>
        t.id === targetId ? { ...t, automationEnabled: enabled } : t,
      ),
    }));
  }

  async function saveTargets(accountId: string) {
    const list = targets[accountId] || [];
    const enabledAccountIds = list.filter((t) => t.automationEnabled !== false && t.source !== 'group').map((t) => t.id);
    const enabledGroupIds = list.filter((t) => t.automationEnabled !== false && t.source === 'group').map((t) => t.id);
    const res = await invoke<{ success?: boolean; error?: string }>('save-automation-target-selection', {
      accountId,
      enabledAccountIds,
      enabledGroupIds,
    });
    setMsg(res.success ? `Saved ${enabledAccountIds.length + enabledGroupIds.length} target(s) for account` : (res.error || 'Target save failed'));
  }

  async function saveAll() {
    setLoading(true);
    try {
      const updates = Object.values(rows).map(({ accountId, ...settings }) => ({ accountId, settings }));
      const res = await invoke<{ success?: boolean; saved?: number; error?: string }>('save-bulk-account-automation', updates);
      setMsg(res.success ? `Saved automation for ${res.saved ?? 0} account(s)` : (res.error || 'Save failed'));
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  function enableAll(enabled: boolean) {
    setRows((prev) => {
      const next = { ...prev };
      Object.keys(next).forEach((id) => { next[id] = { ...next[id], automationEnabled: enabled }; });
      return next;
    });
  }

  const groups = new Map<string, AutomationAccount[]>();
  accounts.forEach((acc) => {
    const key = acc.connectionId || acc.loginEmail || 'ungrouped';
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(acc);
  });

  const enabledCount = Object.values(rows).filter((r) => r.automationEnabled).length;
  const connBars = [...groups.entries()].slice(0, 5).map(([key, items], i) => {
    const on = items.filter((a) => rows[a.id]?.automationEnabled).length;
    const colors = ['#38bdf8', '#a855f7', '#22c55e', '#f59e0b', '#f472b6'];
    return {
      label: (items[0].platform || 'Conn').slice(0, 6),
      value: on,
      color: colors[i % colors.length],
      title: `${key}: ${on}/${items.length} enabled`,
    };
  });

  return (
    <div className="card automation-matrix-panel">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
        <h3 style={{ margin: 0 }}>
          Per-Account Automation Matrix <LivePulse label="LIVE" />
        </h3>
        <div style={{ display: 'flex', gap: 8 }}>
          <button type="button" className="btn" onClick={() => enableAll(true)}>Enable All</button>
          <button type="button" className="btn" onClick={() => enableAll(false)}>Disable All</button>
          <button type="button" className="btn primary" onClick={saveAll} disabled={loading || !accounts.length}>
            Save Matrix
          </button>
        </div>
      </div>

      {accounts.length > 0 && (
        <div className="rules-matrix-summary">
          <span>{enabledCount}/{accounts.length} accounts enabled</span>
          {connBars.length > 0 && <BarChart items={connBars} maxHeight={72} />}
        </div>
      )}

      {!accounts.length && (
        <p className="settings-panel-desc" style={{ marginTop: 12 }}>
          No accounts linked yet — connect via Account Hub.
        </p>
      )}

      {[...groups.entries()].map(([key, items]) => {
        const header = items[0].loginEmail
          ? `${items[0].platform} — ${items[0].loginEmail}`
          : `${items[0].platform} connection`;
        return (
          <div key={key} className="automation-connection-block">
            <div className="automation-connection-header">{header}</div>
            {items.map((acc) => {
              const row = rows[acc.id];
              if (!row) return null;
              const accTargets = targets[acc.id] || [];
              const isOpen = !!expanded[acc.id];
              return (
                <div key={acc.id} className="automation-account-row">
                  <div className="automation-account-meta">
                    <strong>{acc.handle || acc.id}</strong>
                    <span className="post-meta">{acc.type || 'Profile'} · {acc.platform}</span>
                  </div>
                  <div className="automation-fields">
                    <label className="ac-check">
                      <input
                        type="checkbox"
                        checked={row.automationEnabled}
                        onChange={(e) => updateRow(acc.id, { automationEnabled: e.target.checked })}
                      />
                      Enabled
                    </label>
                    <label>
                      Freq
                      <select
                        className="input"
                        value={row.frequency}
                        onChange={(e) => updateRow(acc.id, { frequency: e.target.value })}
                      >
                        <option value="auto">Auto</option>
                        <option value="realtime">Realtime</option>
                        <option value="hourly">Hourly</option>
                        <option value="daily">Daily</option>
                        <option value="manual">Manual</option>
                      </select>
                    </label>
                    <label className="ac-check">
                      <input type="checkbox" checked={!!row.autoReply} onChange={(e) => updateRow(acc.id, { autoReply: e.target.checked })} />
                      Auto-reply
                    </label>
                    <label className="ac-check">
                      <input type="checkbox" checked={row.postToGroups !== false} onChange={(e) => updateRow(acc.id, { postToGroups: e.target.checked })} />
                      Groups
                    </label>
                    <label>
                      Min s
                      <input
                        type="number"
                        className="input"
                        min={5}
                        max={600}
                        value={row.humanDelayMin}
                        onChange={(e) => updateRow(acc.id, { humanDelayMin: parseInt(e.target.value, 10) || 30 })}
                      />
                    </label>
                    <label>
                      Max s
                      <input
                        type="number"
                        className="input"
                        min={10}
                        max={900}
                        value={row.humanDelayMax}
                        onChange={(e) => updateRow(acc.id, { humanDelayMax: parseInt(e.target.value, 10) || 120 })}
                      />
                    </label>
                    <label className="ac-check">
                      <input type="checkbox" checked={row.humanizeContent !== false} onChange={(e) => updateRow(acc.id, { humanizeContent: e.target.checked })} />
                      Humanize
                    </label>
                    <button type="button" className="btn" style={{ fontSize: '0.72rem' }} onClick={() => toggleExpand(acc.id)}>
                      {isOpen ? 'Hide targets' : 'Group targets'}
                    </button>
                  </div>
                  {isOpen && (
                    <div className="automation-targets-panel">
                      {!accTargets.length && <p className="settings-panel-desc">Loading targets…</p>}
                      {accTargets.map((t) => (
                        <label key={t.id} className="automation-target-chip">
                          <input
                            type="checkbox"
                            checked={t.automationEnabled !== false}
                            onChange={(e) => toggleTarget(acc.id, t.id, e.target.checked)}
                          />
                          <span>
                            <strong>{t.name}</strong>
                            <span className="post-meta">{t.type}{t.source === 'group' ? ' · Group' : ''}{t.subreddit ? ` · r/${t.subreddit}` : ''}</span>
                          </span>
                        </label>
                      ))}
                      {accTargets.length > 0 && (
                        <button type="button" className="btn primary" style={{ marginTop: 8 }} onClick={() => saveTargets(acc.id)}>
                          Save Targets
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        );
      })}

      {msg && <p style={{ marginTop: 8, fontSize: '0.85rem', color: '#94a3b8' }}>{msg}</p>}
    </div>
  );
}