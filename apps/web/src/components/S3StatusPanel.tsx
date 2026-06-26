'use client';

import { useCallback, useEffect, useState } from 'react';
import { invoke } from '@/lib/api';
import { DataPanel, SparkRow } from '@/components/DashboardViz';

type S3Status = {
  configured?: boolean;
  bucket?: string;
  region?: string;
  ok?: boolean;
  error?: string;
};

type S3Upload = { key?: string; url?: string; uploadedAt?: string };

export function S3StatusPanel() {
  const [status, setStatus] = useState<S3Status>({});
  const [uploads, setUploads] = useState<S3Upload[]>([]);
  const [msg, setMsg] = useState('');

  const refresh = useCallback(async () => {
    const [s, list] = await Promise.all([
      invoke<S3Status>('get-s3-status'),
      invoke<{ uploads?: S3Upload[] }>('list-s3-uploads').catch(() => ({ uploads: [] })),
    ]);
    setStatus(s || {});
    setUploads(list.uploads || []);
  }, []);

  useEffect(() => { refresh().catch(console.error); }, [refresh]);

  return (
    <DataPanel title="AWS S3 Storage" live>
      <p className="settings-panel-desc">Media uploads and deployment artifacts — same health block as desktop Integrations.</p>
      <SparkRow items={[
        { label: 'Configured', value: status.configured ? 'Yes' : 'No', status: status.configured ? 'ok' : 'warn' },
        { label: 'Bucket', value: status.bucket || '—' },
        { label: 'Region', value: status.region || '—' },
      ]} />
      <div className="post-card" style={{ marginTop: 12, fontSize: '0.85rem' }}>
        {status.ok
          ? <span className="status-ok">S3 connection healthy</span>
          : <span className="status-partial">{status.error || 'S3 not configured — set AWS keys in Settings'}</span>}
      </div>
      <button type="button" className="btn" style={{ marginTop: 12 }} onClick={async () => {
        await refresh();
        setMsg('S3 status refreshed');
      }}>Refresh Status</button>
      {uploads.length > 0 && (
        <ul style={{ marginTop: 12, fontSize: '0.8rem', color: '#94a3b8' }}>
          {uploads.slice(0, 8).map((u, i) => (
            <li key={u.key || i}>{u.key} — {u.uploadedAt ? new Date(u.uploadedAt).toLocaleString() : ''}</li>
          ))}
        </ul>
      )}
      {msg && <p style={{ marginTop: 8, color: '#94a3b8', fontSize: '0.85rem' }}>{msg}</p>}
    </DataPanel>
  );
}