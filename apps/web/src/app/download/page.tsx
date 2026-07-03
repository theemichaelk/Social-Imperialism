'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { DataPanel, MetricTile } from '@/components/DashboardViz';
import {
  fetchDesktopDownloadInfo,
  fetchDesktopDownloadUrl,
  type DesktopDownloadMeta,
} from '@/lib/desktopDownload';
import { BLUEPRINT_METRICS } from '@/lib/siteBlueprint';

const DESKTOP_FEATURES = [
  'Full offline-capable Electron shell with 382+ IPC channels',
  'Native OAuth flows and platform publishing',
  'Live feed engine, AI replies, and automation worker',
  'Same campaign data as the web dashboard — sync via your account',
];

export default function DownloadPage() {
  const [info, setInfo] = useState<DesktopDownloadMeta | null>(null);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    fetchDesktopDownloadInfo().then(setInfo).catch(() => setInfo(null));
  }, []);

  const startDownload = useCallback(async () => {
    setLoading(true);
    setMsg('Generating secure download link…');
    try {
      const release = await fetchDesktopDownloadUrl();
      setMsg('Starting download…');
      window.location.href = release.url;
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  const meta = info || {
    version: '—',
    filename: 'Social Imperialism Setup.exe',
    platform: 'windows' as const,
    sizeHint: '~180 MB',
    requiresAuth: true as const,
  };

  return (
    <div style={{ maxWidth: 960 }}>
      <span className="home-section-eyebrow">Desktop</span>
      <h1 style={{ margin: '0.5rem 0 0.75rem' }}>Download Desktop App</h1>
      <p style={{ color: '#94a3b8', marginBottom: '1.5rem', maxWidth: 640 }}>
        Windows installer — full Social Imperialism power on your machine. Sign-in required to download.
      </p>

      <div className="dash-hero" style={{ marginBottom: '1.25rem' }}>
        <div className="dash-hero-grid">
          <MetricTile label="Version" value={meta.version} accent="#38bdf8" />
          <MetricTile label="Platform" value="Windows" sub="NSIS installer" />
          <MetricTile label="IPC Channels" value={BLUEPRINT_METRICS.ipcChannels} sub="desktop parity" />
          <MetricTile label="Size" value={meta.sizeHint || '—'} sub="approximate" />
        </div>
      </div>

      <DataPanel title="Get Social Imperialism for Windows" live>
        <p className="settings-panel-desc" style={{ marginBottom: 16 }}>
          The desktop app runs the full automation engine locally — OAuth, scheduling, AI replies,
          and verified node workflows.
        </p>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          <button
            type="button"
            className="btn primary"
            style={{ fontSize: '1rem', padding: '12px 24px' }}
            onClick={startDownload}
            disabled={loading}
          >
            {loading ? 'Preparing…' : `Download ${meta.filename}`}
          </button>
          <Link href="/dashboard" className="btn">Open Dashboard</Link>
          <Link href="/support" className="btn">Install help</Link>
        </div>
        <p className="post-meta" style={{ marginTop: 12, color: '#94a3b8' }}>
          Secure, time-limited download link — no public S3 access. Links expire after one hour.
        </p>
      </DataPanel>

      {msg && (
        <div className="card" style={{ marginTop: 12, borderColor: msg.includes('unavailable') || msg.includes('sign in') ? '#f59e0b' : '#10b981' }}>
          <p style={{ margin: 0, fontSize: '0.9rem' }}>{msg}</p>
        </div>
      )}

      <div className="grid grid-2" style={{ marginTop: 16, gap: 16 }}>
        <DataPanel title="What's included">
          <ul style={{ margin: 0, paddingLeft: '1.25rem', lineHeight: 1.7 }}>
            {DESKTOP_FEATURES.map((f) => (
              <li key={f} style={{ marginBottom: 6 }}>{f}</li>
            ))}
          </ul>
        </DataPanel>
        <DataPanel title="Install steps">
          <ol style={{ margin: 0, paddingLeft: '1.25rem', lineHeight: 1.7 }}>
            <li>Click Download above (signed-in account required).</li>
            <li>Run <strong>{meta.filename}</strong> and follow the setup wizard.</li>
            <li>Launch Social Imperialism from the Start menu or desktop shortcut.</li>
            <li>Sign in with your Social Imperialism account.</li>
          </ol>
        </DataPanel>
      </div>
    </div>
  );
}