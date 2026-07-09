'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { invoke } from '@/lib/api';
import { DataPanel } from '@/components/DashboardViz';
import { PromptVaultPicker } from '@/components/PromptVaultPicker';
import { getGrokToolbarActions } from '@/lib/grokPageActions';

type GrokResult = {
  success?: boolean;
  error?: string;
  text?: string;
  answer?: string;
  analysis?: string;
  caption?: string;
  imageUrl?: string;
  videoUrl?: string;
  primaryAsset?: { url?: string };
  assets?: Array<{ url?: string }>;
};

type Props = {
  prompt?: string;
  onText?: (text: string) => void;
  onMedia?: (url: string) => void;
  pageId?: string;
  compact?: boolean;
  title?: string;
  /** Show Python/nodriver setup hints (off on library/brand unless Grok is in use). */
  showInfraHints?: boolean;
  /** Parent already showed cloud/desktop limitation (e.g. Video Studio collapsible). */
  suppressCloudBanner?: boolean;
};

export function GrokToolbar({
  prompt = '',
  onText,
  onMedia,
  pageId = 'content-hub',
  compact,
  title = 'Grok Engine',
  showInfraHints = false,
  suppressCloudBanner = false,
}: Props) {
  const [localPrompt, setLocalPrompt] = useState(prompt);
  const [status, setStatus] = useState('');
  const [grokStatus, setGrokStatus] = useState<Record<string, unknown>>({});
  const [statusLoadError, setStatusLoadError] = useState('');
  const [preview, setPreview] = useState('');
  const [mediaPreview, setMediaPreview] = useState('');

  useEffect(() => { setLocalPrompt(prompt); }, [prompt]);

  const refreshGrokStatus = async () => {
    try {
      const st = await invoke<Record<string, unknown>>('grok-get-status');
      setGrokStatus(st || {});
      setStatusLoadError('');
    } catch (e) {
      setStatusLoadError((e as Error).message || 'Could not load Grok status');
    }
  };

  useEffect(() => { refreshGrokStatus().catch(() => {}); }, []);

  const loggedIn = !!(grokStatus as { session?: { loggedIn?: boolean } }).session?.loggedIn
    || !!(grokStatus as { settings?: { sessionValid?: boolean } }).settings?.sessionValid;
  const rawHint = String((grokStatus as { connectionHint?: string }).connectionHint || '');
  const requiresWindows = !!(grokStatus as { requiresWindows?: boolean }).requiresWindows;
  const connectionHint = (!showInfraHints && compact && /nodriver|python/i.test(rawHint))
    ? 'Grok browser tools — configure in Settings → Grok when needed.'
    : rawHint;
  const canAutomate = (grokStatus as { canAutomate?: boolean }).canAutomate !== false
    && !requiresWindows;
  const statusMessage = statusLoadError
    || connectionHint
    || (loggedIn ? '' : 'Not connected — save credentials and Connect in Settings → Grok');
  const nodriverReady = !!(grokStatus as { nodriverReady?: boolean }).nodriverReady;
  const selectedBrowser = (grokStatus as { nativeBrowser?: { selectedBrowser?: { label?: string; installed?: boolean } } })
    .nativeBrowser?.selectedBrowser;
  const installedBrowsers = ((grokStatus as { nativeBrowser?: { browsers?: Array<{ label: string; installed?: boolean; automationReady?: boolean }> } })
    .nativeBrowser?.browsers || []).filter((b) => b.installed);
  const actions = getGrokToolbarActions(pageId);

  function formatGrokError(message: string) {
    if (/requires windows|desktop app|localhost:4000/i.test(message)) {
      return `${message} Open Settings → Grok on a Windows machine with the desktop app or local dev server.`;
    }
    if (/edge not found|chrome not found|not found.*native browser/i.test(message)) {
      return `${message} Go to Settings → Grok → Native Browser and pick Chrome or Edge (both are installed on this PC).`;
    }
    if (/not connected|connect in settings|click connect/i.test(message)) {
      return `${message} Settings → Grok → save credentials → Connect & Authorize.`;
    }
    return message;
  }

  async function run(channel: string, payload: Record<string, unknown>) {
    if (!canAutomate) {
      setStatus(formatGrokError(connectionHint || 'Grok browser automation is not available on this API host.'));
      return;
    }
    if (!localPrompt.trim() && channel !== 'grok-get-status') {
      setStatus('Enter a prompt first');
      return;
    }
    setStatus('Running — native browser may take up to 60s…');
    try {
      const res = await invoke<GrokResult>(channel, payload);
      if (res?.success === false) {
        setStatus(formatGrokError(res.error || 'Grok action failed'));
        await refreshGrokStatus();
        return;
      }
      const text = String(res.text || res.answer || res.analysis || res.caption || '');
      const media = String(
        res.primaryAsset?.url || res.imageUrl || res.assets?.[0]?.url || res.videoUrl || '',
      );
      if (text) {
        setPreview(text);
        onText?.(text);
      }
      if (media) {
        setMediaPreview(media);
        onMedia?.(media);
        setStatus('Media asset ready');
      } else if (text) {
        setStatus('Text ready — applied to editor');
      } else {
        setStatus('Complete');
      }
    } catch (e) {
      setStatus(formatGrokError((e as Error).message));
      await refreshGrokStatus();
    }
  }

  async function rebuildPrompt() {
    setStatus('Rebuilding prompt with brand + keywords…');
    try {
      const res = await invoke<{ success?: boolean; prompt?: string; error?: string; primaryKeyword?: string | null }>(
        'grok-build-prompt-preview',
        { content: localPrompt, pageId },
      );
      if (res?.success === false || !res?.prompt) {
        setStatus(res?.error || 'Could not rebuild prompt — check active campaign and keywords');
        return;
      }
      setLocalPrompt(res.prompt);
      const kw = res.primaryKeyword ? ` (primary: ${res.primaryKeyword})` : '';
      setStatus(`Prompt rebuilt with campaign keywords${kw}`);
    } catch (e) {
      setStatus((e as Error).message || 'Rebuild prompt failed');
    }
  }

  const inner = (
    <>
      {!compact && (
        <p className="settings-panel-desc">
          Grok Text, Imagine, Video, and Infographics use a native browser session at grok.com — not an API key.
          {' '}Use <strong>Connect &amp; Authorize</strong> below to sign in at grok.com.
        </p>
      )}
      <div className="post-card" style={{ fontSize: '0.85rem', marginBottom: 12 }}>
        {loggedIn
          ? <span className="status-ok">Grok session active{selectedBrowser?.label ? ` · ${selectedBrowser.label}` : ''}</span>
          : statusMessage && <span className="status-partial">{statusMessage}</span>}
        {!loggedIn && !statusLoadError && (
          <p style={{ margin: '8px 0 0', fontSize: '0.8rem' }}>
            Save x.ai credentials in the toolbar below, then <strong>Connect &amp; Authorize</strong>
          </p>
        )}
        {showInfraHints && !nodriverReady && (
          <p style={{ margin: '8px 0 0', color: '#f59e0b', fontSize: '0.8rem' }}>
            nodriver/Python not ready — install the native browser stack on the desktop app host.
          </p>
        )}
        {installedBrowsers.length > 0 && !selectedBrowser?.installed && (
          <p style={{ margin: '8px 0 0', color: '#94a3b8', fontSize: '0.8rem' }}>
            Detected: {installedBrowsers.map((b) => b.label).join(', ')} — select a browser in the toolbar below.
          </p>
        )}
        {!canAutomate && !suppressCloudBanner && (
          <p style={{ margin: '8px 0 0', color: '#f59e0b', fontSize: '0.8rem' }}>
            {requiresWindows
              ? 'Cloud API cannot launch Edge/Chrome. Use localhost:3000 with a local API, or the desktop app.'
              : 'Browser automation is not ready on this host — check Settings → Grok → Native Browser.'}
            {' '}<Link href="/download">Download desktop app</Link>
          </p>
        )}
      </div>
      <PromptVaultPicker
        feature="grok"
        compact={compact}
        onLoad={(text) => {
          setLocalPrompt(text);
          setStatus('Prompt loaded from vault');
        }}
      />
      <textarea
        className="input"
        rows={compact ? 2 : 4}
        value={localPrompt}
        onChange={(e) => setLocalPrompt(e.target.value)}
        placeholder="Topic, post draft, or keyword-aware prompt…"
      />
      <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
        {actions.text && (
          <button type="button" className="btn" disabled={!canAutomate} onClick={() => run('grok-ask-text', { content: localPrompt, pageId })}>Grok Text</button>
        )}
        {actions.imagine && (
          <button type="button" className="btn" disabled={!canAutomate} onClick={() => run('grok-imagine', { content: localPrompt, pageId })}>Grok Imagine</button>
        )}
        {actions.video && (
          <button type="button" className="btn" disabled={!canAutomate} onClick={() => run('grok-generate-video', { content: localPrompt, pageId })}>Grok Video</button>
        )}
        {actions.infographic && (
          <button type="button" className="btn" disabled={!canAutomate} onClick={() => run('grok-generate-infographic', { content: localPrompt, pageId })}>Infographic</button>
        )}
        {actions.rebuild && (
          <button type="button" className="btn" onClick={rebuildPrompt} title="Inject brand, keywords, and page task — works without browser session">Rebuild Prompt</button>
        )}
      </div>
      {status && <p style={{ marginTop: 8, color: '#94a3b8', fontSize: '0.85rem' }}>{status}</p>}
      {preview && (
        <pre className="partner-code-sample" style={{ marginTop: 8, maxHeight: 160, overflow: 'auto' }}>
          {preview.slice(0, 800)}
        </pre>
      )}
      {mediaPreview && (
        <div style={{ marginTop: 8 }}>
          {mediaPreview.endsWith('.mp4') || mediaPreview.includes('video')
            ? <video src={mediaPreview} controls style={{ maxWidth: '100%', borderRadius: 8 }} />
            : <img src={mediaPreview} alt="Grok asset" style={{ maxWidth: '100%', borderRadius: 8 }} />}
        </div>
      )}
    </>
  );

  if (compact) return <div className="grok-toolbar-compact card">{inner}</div>;
  return <DataPanel title={title} live>{inner}</DataPanel>;
}