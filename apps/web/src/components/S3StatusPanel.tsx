'use client';

import { useCallback, useEffect, useState } from 'react';
import { invoke } from '@/lib/api';
import { DataPanel, SparkRow } from '@/components/DashboardViz';

type StorageProviderStatus = {
  configured?: boolean;
  bucket?: string;
  region?: string;
  accountId?: string;
  provider?: string;
};

type S3Status = {
  configured?: boolean;
  bucket?: string;
  region?: string;
  ok?: boolean;
  error?: string;
  r2?: StorageProviderStatus;
  storageProvider?: 'r2' | 's3' | 'none';
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
    <DataPanel title="Cloud Storage (R2 / S3)" live>
      <p className="settings-panel-desc">Media uploads — Cloudflare R2 preferred when configured; AWS S3 fallback.</p>
      <SparkRow items={[
        { label: 'Active provider', value: status.storageProvider === 'r2' ? 'Cloudflare R2' : status.storageProvider === 's3' ? 'AWS S3' : 'None', status: status.storageProvider && status.storageProvider !== 'none' ? 'ok' : 'warn' },
        { label: 'R2 configured', value: status.r2?.configured ? 'Yes' : 'No', status: status.r2?.configured ? 'ok' : 'warn' },
        { label: 'S3 configured', value: status.configured ? 'Yes' : 'No', status: status.configured ? 'ok' : 'warn' },
      ]} />
      {status.r2?.configured && (
        <SparkRow items={[
          { label: 'R2 bucket', value: status.r2.bucket || '—' },
          { label: 'R2 account', value: status.r2.accountId ? `${status.r2.accountId.slice(0, 8)}…` : '—' },
        ]} />
      )}
      {status.configured && (
        <SparkRow items={[
          { label: 'S3 bucket', value: status.bucket || '—' },
          { label: 'S3 region', value: status.region || '—' },
        ]} />
      )}
      <div className="post-card" style={{ marginTop: 12, fontSize: '0.85rem' }}>
        {status.storageProvider && status.storageProvider !== 'none'
          ? <span className="status-ok">{status.storageProvider === 'r2' ? 'R2' : 'S3'} storage active</span>
          : <span className="status-partial">{status.error || 'No storage configured — set CLOUDFLARE_R2_* or AWS_S3_* in API env'}</span>}
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