'use client';
import { useState, useEffect, ReactNode } from 'react';
import { invoke } from '@/lib/api';

type ChannelConfig = { channel: string; label: string; args?: unknown[] };

export function FeaturePage({
  title,
  subtitle,
  channels = [],
  children,
}: {
  title: string;
  subtitle?: string;
  channels?: ChannelConfig[];
  children?: ReactNode;
}) {
  const [results, setResults] = useState<Record<string, { ok: boolean; data?: unknown; error?: string }>>({});
  const [loading, setLoading] = useState(false);

  async function runChecks() {
    setLoading(true);
    const out: typeof results = {};
    for (const ch of channels) {
      try {
        const data = await invoke(ch.channel, ...(ch.args || []));
        out[ch.channel] = { ok: true, data };
      } catch (e) {
        out[ch.channel] = { ok: false, error: (e as Error).message };
      }
    }
    setResults(out);
    setLoading(false);
  }

  useEffect(() => { if (channels.length) runChecks(); }, []);

  return (
    <div>
      <h1 className="page-title">{title}</h1>
      {subtitle && <p className="page-sub">{subtitle}</p>}
      {children}
      {channels.length > 0 && (
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3>API Status</h3>
            <button className="btn" onClick={runChecks} disabled={loading}>{loading ? 'Checking…' : 'Refresh'}</button>
          </div>
          <div className="grid grid-2">
            {channels.map((ch) => {
              const r = results[ch.channel];
              return (
                <div key={ch.channel} style={{ fontSize: '0.85rem' }}>
                  <strong className={r?.ok ? 'status-ok' : r ? '' : 'status-partial'}>{ch.label}</strong>
                  <div style={{ color: '#94a3b8', marginTop: 4 }}>
                    {r?.ok ? '✓ Connected' : r?.error || '…'}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}