'use client';
import { useState, type ReactNode } from 'react';
import { invoke } from '@/lib/api';

export function InvokePanel({
  title,
  channel,
  args = [],
  buttonLabel,
  renderResult,
}: {
  title: string;
  channel: string;
  args?: unknown[];
  buttonLabel?: string;
  renderResult?: (data: unknown) => ReactNode;
}) {
  const [data, setData] = useState<unknown>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function run() {
    setLoading(true);
    setError('');
    try {
      setData(await invoke(channel, ...args));
    } catch (e) {
      setError((e as Error).message);
      setData(null);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <h3 style={{ margin: 0 }}>{title}</h3>
        <button className="btn" onClick={run} disabled={loading}>{loading ? '…' : (buttonLabel || 'Run')}</button>
      </div>
      {error && <p style={{ color: '#f87171', fontSize: '0.85rem' }}>{error}</p>}
      {data != null && (
        renderResult
          ? renderResult(data)
          : <pre style={{ fontSize: '0.75rem', overflow: 'auto', maxHeight: 200, margin: 0 }}>{JSON.stringify(data, null, 2)}</pre>
      )}
    </div>
  );
}