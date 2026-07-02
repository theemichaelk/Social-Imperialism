'use client';

import Link from 'next/link';
import { DataPanel, MetricTile } from '@/components/DashboardViz';
import { HomeFooter } from '@/components/HomeFooter';
import { HomePublicNav } from '@/components/HomePublicNav';
import { getDesktopDownloadInfo } from '@/lib/desktopDownload';
import { BLUEPRINT_METRICS } from '@/lib/siteBlueprint';

const DESKTOP_FEATURES = [
  'Full offline-capable Electron shell with 382+ IPC channels',
  'Native OAuth flows and platform publishing',
  'Live feed engine, AI replies, and automation worker',
  'Same campaign data as the web dashboard — sync via your account',
];

export default function DownloadPage() {
  const info = getDesktopDownloadInfo();

  return (
    <div className="home-page download-page">
      <div className="home-bg-grid" aria-hidden />
      <HomePublicNav variant="founder" />

      <section className="home-container" style={{ padding: '2.5rem 1rem 3rem', maxWidth: 960, margin: '0 auto' }}>
        <span className="home-section-eyebrow">Desktop</span>
        <h1 style={{ margin: '0.5rem 0 0.75rem' }}>Download Desktop App</h1>
        <p style={{ color: '#94a3b8', marginBottom: '1.5rem', maxWidth: 640 }}>
          Windows installer — full Social Imperialism power on your machine with native OAuth and automation.
        </p>

        <div className="dash-hero" style={{ marginBottom: '1.25rem' }}>
          <div className="dash-hero-grid">
            <MetricTile label="Version" value={info.version} accent="#38bdf8" />
            <MetricTile label="Platform" value="Windows" sub="NSIS installer" />
            <MetricTile label="IPC Channels" value={BLUEPRINT_METRICS.ipcChannels} sub="desktop parity" />
            <MetricTile label="Size" value={info.sizeHint || '—'} sub="approximate" />
          </div>
        </div>

        <DataPanel title="Get Social Imperialism for Windows" live>
          <p className="settings-panel-desc" style={{ marginBottom: 16 }}>
            The desktop app runs the full automation engine locally — OAuth, scheduling, AI replies,
            and verified node workflows. Use the same login as the web dashboard.
          </p>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
            <a
              href={info.url}
              className="btn primary"
              style={{ fontSize: '1rem', padding: '12px 24px' }}
              download={info.filename}
              rel="noopener noreferrer"
            >
              Download {info.filename}
            </a>
            <Link href="/login" className="btn">Sign in on web</Link>
            <Link href="/support" className="btn">Install help</Link>
          </div>
          <p className="post-meta" style={{ marginTop: 12, wordBreak: 'break-all' }}>
            Direct link: <a href={info.url} style={{ color: '#38bdf8' }}>{info.url}</a>
          </p>
        </DataPanel>

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
              <li>Download the installer above.</li>
              <li>Run <strong>{info.filename}</strong> and follow the setup wizard.</li>
              <li>Launch Social Imperialism from the Start menu or desktop shortcut.</li>
              <li>Sign in with your Social Imperialism account.</li>
            </ol>
          </DataPanel>
        </div>
      </section>

      <HomeFooter />
    </div>
  );
}