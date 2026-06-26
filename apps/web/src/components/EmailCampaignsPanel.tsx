'use client';

import { useCallback, useEffect, useState } from 'react';
import { invoke } from '@/lib/api';
import { DataPanel, SparkRow } from '@/components/DashboardViz';

type EmailCampaign = {
  id: string;
  name: string;
  trigger: string;
  subject?: string;
  enabled?: boolean;
  autoReply?: boolean;
  provider?: string;
};

type EmailState = {
  campaigns?: EmailCampaign[];
  settings?: {
    enabled?: boolean;
    alertEmail?: string;
    fromEmail?: string;
    providerPriority?: string[];
  };
};

type Props = {
  onCampaignsChange?: (active: number, total: number) => void;
};

export function EmailCampaignsPanel({ onCampaignsChange }: Props) {
  const [state, setState] = useState<EmailState>({});
  const [alertEmail, setAlertEmail] = useState('');
  const [testCampaignId, setTestCampaignId] = useState('');
  const [msg, setMsg] = useState('');
  const [saving, setSaving] = useState(false);

  const refresh = useCallback(async () => {
    const data = await invoke<EmailState>('get-email-campaigns');
    setState(data || {});
    setAlertEmail(data?.settings?.alertEmail || '');
    if (!testCampaignId && data?.campaigns?.[0]?.id) setTestCampaignId(data.campaigns[0].id);
    const camps = data?.campaigns || [];
    onCampaignsChange?.(camps.filter((c) => c.enabled).length, camps.length);
  }, [testCampaignId, onCampaignsChange]);

  useEffect(() => { refresh().catch(console.error); }, [refresh]);

  async function save(patch: Partial<EmailState['settings']>) {
    setSaving(true);
    try {
      await invoke('save-email-campaigns', {
        ...state,
        settings: { ...state.settings, ...patch },
      });
      setMsg('Email campaign settings saved');
      await refresh();
    } finally {
      setSaving(false);
    }
  }

  async function toggleCampaign(id: string, field: 'enabled' | 'autoReply', value: boolean) {
    const campaigns = (state.campaigns || []).map((c) => (c.id === id ? { ...c, [field]: value } : c));
    await invoke('save-email-campaigns', { ...state, campaigns });
    setState({ ...state, campaigns });
    setMsg('Campaign updated');
  }

  const active = (state.campaigns || []).filter((c) => c.enabled).length;

  return (
    <div className="grid grid-2">
      <DataPanel title="Email Auto-Reply Campaigns" live>
        <p className="settings-panel-desc">
          Triggered emails for new leads, AI replies, and Q&amp;A discoveries — mirrors desktop Integrations hub.
        </p>
        <SparkRow items={[
          { label: 'Campaigns', value: state.campaigns?.length || 0 },
          { label: 'Active', value: active, status: active ? 'ok' : 'warn' },
          { label: 'Enabled', value: state.settings?.enabled !== false ? 'Yes' : 'No' },
        ]} />
        <label className="ac-check" style={{ marginTop: 12 }}>
          <input
            type="checkbox"
            checked={state.settings?.enabled !== false}
            onChange={(e) => save({ enabled: e.target.checked })}
            disabled={saving}
          />
          Enable email auto-reply system
        </label>
        <div className="form-group" style={{ marginTop: 12 }}>
          <label>Alert / test recipient</label>
          <input className="input" value={alertEmail} onChange={(e) => setAlertEmail(e.target.value)} placeholder="you@company.com" />
          <button type="button" className="btn" style={{ marginTop: 8 }} onClick={() => save({ alertEmail })} disabled={saving}>Save Recipient</button>
        </div>
        <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {(state.campaigns || []).map((c) => (
            <div key={c.id} className="post-card" style={{ fontSize: '0.85rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
                <div>
                  <strong>{c.name}</strong>
                  <div className="post-meta">Trigger: {c.trigger} · {c.subject?.slice(0, 48)}</div>
                </div>
                <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                  <label className="ac-check"><input type="checkbox" checked={!!c.enabled} onChange={(e) => toggleCampaign(c.id, 'enabled', e.target.checked)} /> On</label>
                  <label className="ac-check"><input type="checkbox" checked={!!c.autoReply} onChange={(e) => toggleCampaign(c.id, 'autoReply', e.target.checked)} /> Auto</label>
                </div>
              </div>
            </div>
          ))}
          {!state.campaigns?.length && <p className="settings-panel-desc">No campaigns — they seed on first load from your active brand.</p>}
        </div>
      </DataPanel>
      <DataPanel title="Send & Test" live>
        <div className="form-group">
          <label>Campaign to send</label>
          <select className="input" value={testCampaignId} onChange={(e) => setTestCampaignId(e.target.value)}>
            {(state.campaigns || []).map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
          <button type="button" className="btn primary" onClick={async () => {
            setMsg('Sending test campaign…');
            const res = await invoke<{ success?: boolean; error?: string }>('send-email-campaign', {
              campaignId: testCampaignId,
              to: alertEmail || undefined,
            });
            setMsg(res.success !== false ? 'Test email sent' : (res.error || 'Send failed'));
          }}>Send Test Campaign</button>
          <button type="button" className="btn" onClick={async () => {
            const res = await invoke<{ sent?: number; skipped?: boolean }>('run-email-auto-reply', { trigger: 'ai_reply_drafted' });
            setMsg(res.skipped ? 'No matching trigger or recipient' : `Auto-reply processed (${res.sent ?? 0} sent)`);
          }}>Simulate AI Reply Trigger</button>
        </div>
        {msg && <p className="page-msg" style={{ marginTop: 12 }}>{msg}</p>}
      </DataPanel>
    </div>
  );
}