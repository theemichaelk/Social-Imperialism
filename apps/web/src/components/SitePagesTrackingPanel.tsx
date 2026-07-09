'use client';

import { useCallback, useEffect, useState } from 'react';
import { invoke } from '@/lib/api';
import { DataPanel, SparkRow } from '@/components/DashboardViz';
import {
  EMPTY_SITE_TRACKING,
  SEARCH_CONSOLE_LINKS,
  type SitePageConfig,
  type SiteTrackingSettings,
} from '@/lib/siteTracking';

type Props = {
  onMessage?: (msg: string) => void;
};

export function SitePagesTrackingPanel({ onMessage }: Props) {
  const [settings, setSettings] = useState<SiteTrackingSettings>(EMPTY_SITE_TRACKING);
  const [selectedPageId, setSelectedPageId] = useState<string | null>(null);
  const [previewPath, setPreviewPath] = useState('/');
  const [previewJson, setPreviewJson] = useState('');
  const [loading, setLoading] = useState(false);
  const [section, setSection] = useState<'pages' | 'global' | 'analytics' | 'search'>('pages');
  const [newPage, setNewPage] = useState({ path: '', title: '' });

  const refresh = useCallback(async () => {
    const res = await invoke<{ settings?: SiteTrackingSettings }>('get-site-tracking-settings');
    const s = res.settings || EMPTY_SITE_TRACKING;
    setSettings(s);
    if (!selectedPageId && s.pages?.length) setSelectedPageId(s.pages[0].id);
  }, [selectedPageId]);

  useEffect(() => { refresh().catch(console.error); }, [refresh]);

  const selectedPage = settings.pages.find((p) => p.id === selectedPageId) || settings.pages[0];

  function patchSettings(patch: Partial<SiteTrackingSettings>) {
    setSettings((prev) => ({ ...prev, ...patch }));
  }

  function patchPage(id: string, patch: Partial<SitePageConfig>) {
    setSettings((prev) => ({
      ...prev,
      pages: prev.pages.map((p) => (p.id === id ? { ...p, ...patch } : p)),
    }));
  }

  async function save() {
    setLoading(true);
    try {
      await invoke('save-site-tracking-settings', settings);
      onMessage?.('Site & tracking settings saved — public pages will use these snippets within ~2 minutes');
      await refresh();
    } catch (e) {
      onMessage?.((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function loadPreview() {
    try {
      const res = await invoke<{ preview?: Record<string, unknown> }>('get-public-site-tracking-preview', previewPath);
      setPreviewJson(JSON.stringify(res.preview || {}, null, 2));
    } catch (e) {
      setPreviewJson((e as Error).message);
    }
  }

  function addCustomPage() {
    const path = newPage.path.trim();
    if (!path) {
      onMessage?.('Enter a page path (e.g. /pricing)');
      return;
    }
    const normalized = path.startsWith('/') ? path : `/${path}`;
    const title = newPage.title.trim() || normalized;
    setSettings((prev) => {
      if (prev.pages.some((p) => p.path === normalized)) {
        onMessage?.('Page path already exists');
        return prev;
      }
      const entry: SitePageConfig = {
        id: `page_${Date.now()}`,
        path: normalized,
        title,
        type: 'custom',
        enabled: true,
        headerHtml: '',
        footerHtml: '',
        bodyHtml: '',
      };
      setSelectedPageId(entry.id);
      setNewPage({ path: '', title: '' });
      onMessage?.(`Added page ${normalized}`);
      return { ...prev, pages: [...prev.pages, entry] };
    });
  }

  const enabledCount = settings.pages.filter((p) => p.enabled).length;
  const trackingOn = [
    settings.ga4Enabled && settings.ga4MeasurementId,
    settings.gtmEnabled && settings.gtmContainerId,
    settings.googleSearchConsoleVerification,
    settings.bingWebmasterVerification,
    settings.yahooSiteVerification,
  ].filter(Boolean).length;

  return (
    <div className="site-tracking-panel">
      <div className="source-tabs" style={{ display: 'flex', gap: 6, marginBottom: 12, flexWrap: 'wrap' }}>
        <button type="button" className={`tab ${section === 'pages' ? 'active' : ''}`} onClick={() => setSection('pages')}>Pages & HTML</button>
        <button type="button" className={`tab ${section === 'global' ? 'active' : ''}`} onClick={() => setSection('global')}>Global Header/Footer</button>
        <button type="button" className={`tab ${section === 'analytics' ? 'active' : ''}`} onClick={() => setSection('analytics')}>Analytics</button>
        <button type="button" className={`tab ${section === 'search' ? 'active' : ''}`} onClick={() => setSection('search')}>Search Consoles</button>
      </div>

      <DataPanel title="Site & Tracking Overview" live>
        <SparkRow items={[
          { label: 'Pages', value: `${enabledCount}/${settings.pages.length}`, status: 'ok' },
          { label: 'Tracking', value: trackingOn, status: trackingOn ? 'ok' : 'warn' },
          { label: 'Updated', value: settings.updatedAt ? new Date(settings.updatedAt).toLocaleDateString() : '—' },
        ]} />
        <p className="settings-panel-desc">
          Manage each public page, inject custom HTML in the header or footer, connect Google Analytics 4, Google Tag Manager,
          Facebook Pixel, Microsoft Clarity, Hotjar, and verify Google / Bing / Yahoo search consoles.
          Snippets deploy to all visitors via the public site-tracking endpoint.
        </p>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
          <button type="button" className="btn primary" onClick={save} disabled={loading}>
            {loading ? 'Saving…' : 'Save All Site Settings'}
          </button>
          <button type="button" className="btn" onClick={() => refresh()}>Reload</button>
        </div>
      </DataPanel>

      {section === 'pages' && (
        <div className="grid grid-2 site-tracking-grid">
          <DataPanel title={`Pages (${settings.pages.length})`} live>
            <div className="site-tracking-page-list">
              {settings.pages.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  className={`post-card site-tracking-page-row${p.id === selectedPage?.id ? ' campaign-active' : ''}`}
                  onClick={() => setSelectedPageId(p.id)}
                >
                  <div>
                    <strong>{p.title}</strong>
                    <div className="post-meta">{p.path} · {p.type}</div>
                  </div>
                  <label className="ac-check" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={p.enabled}
                      onChange={(e) => patchPage(p.id, { enabled: e.target.checked })}
                    />
                    Live
                  </label>
                </button>
              ))}
            </div>
            <div className="grid grid-2" style={{ marginTop: 12, gap: 8 }}>
              <input className="input" placeholder="/custom-page" value={newPage.path} onChange={(e) => setNewPage({ ...newPage, path: e.target.value })} />
              <input className="input" placeholder="Page title" value={newPage.title} onChange={(e) => setNewPage({ ...newPage, title: e.target.value })} />
            </div>
            <button type="button" className="btn" style={{ marginTop: 8 }} onClick={addCustomPage}>+ Add Page</button>
          </DataPanel>

          {selectedPage && (
            <DataPanel title={`Edit HTML — ${selectedPage.title}`} live>
              <p className="settings-panel-desc">Per-page snippets merge with global header/footer on <code>{selectedPage.path}</code>.</p>
              <label className="ac-label">Header HTML (injected in &lt;head&gt;)</label>
              <textarea
                className="input site-tracking-code"
                rows={6}
                value={selectedPage.headerHtml || ''}
                onChange={(e) => patchPage(selectedPage.id, { headerHtml: e.target.value })}
                placeholder="<!-- Meta tags, schema, page-specific CSS -->"
              />
              <label className="ac-label">Body HTML (before closing &lt;/body&gt;)</label>
              <textarea
                className="input site-tracking-code"
                rows={5}
                value={selectedPage.bodyHtml || ''}
                onChange={(e) => patchPage(selectedPage.id, { bodyHtml: e.target.value })}
                placeholder="<!-- Widgets, chat, embeds -->"
              />
              <label className="ac-label">Footer HTML</label>
              <textarea
                className="input site-tracking-code"
                rows={5}
                value={selectedPage.footerHtml || ''}
                onChange={(e) => patchPage(selectedPage.id, { footerHtml: e.target.value })}
                placeholder="<!-- Footer scripts, badges -->"
              />
            </DataPanel>
          )}
        </div>
      )}

      {section === 'global' && (
        <DataPanel title="Global Header & Footer HTML" live>
          <p className="settings-panel-desc">Applied on every enabled public page, before page-specific snippets.</p>
          <label className="ac-label">Global header HTML</label>
          <textarea
            className="input site-tracking-code"
            rows={8}
            value={settings.globalHeaderHtml}
            onChange={(e) => patchSettings({ globalHeaderHtml: e.target.value })}
            placeholder="<!-- Site-wide head: fonts, schema.org, preconnect -->"
          />
          <label className="ac-label">Global footer HTML</label>
          <textarea
            className="input site-tracking-code"
            rows={8}
            value={settings.globalFooterHtml}
            onChange={(e) => patchSettings({ globalFooterHtml: e.target.value })}
            placeholder="<!-- Site-wide footer scripts -->"
          />
          <label className="ac-label">Extra &lt;head&gt; HTML</label>
          <textarea
            className="input site-tracking-code"
            rows={5}
            value={settings.customHeadHtml}
            onChange={(e) => patchSettings({ customHeadHtml: e.target.value })}
          />
          <label className="ac-label">Extra &lt;body&gt; HTML</label>
          <textarea
            className="input site-tracking-code"
            rows={5}
            value={settings.customBodyHtml}
            onChange={(e) => patchSettings({ customBodyHtml: e.target.value })}
          />
        </DataPanel>
      )}

      {section === 'analytics' && (
        <div className="grid grid-2">
          <DataPanel title="Google Analytics 4 (GA4)" live>
            <label className="ac-check" style={{ marginBottom: 10 }}>
              <input
                type="checkbox"
                checked={settings.ga4Enabled}
                onChange={(e) => patchSettings({ ga4Enabled: e.target.checked })}
              />
              Enable GA4 gtag.js
            </label>
            <input
              className="input"
              placeholder="G-XXXXXXXXXX"
              value={settings.ga4MeasurementId}
              onChange={(e) => {
                const ga4MeasurementId = e.target.value.trim();
                patchSettings({ ga4MeasurementId, ga4Enabled: !!ga4MeasurementId || settings.ga4Enabled });
              }}
            />
            <p className="settings-panel-desc">Measurement ID from GA4 Admin → Data Streams.</p>
          </DataPanel>

          <DataPanel title="Google Tag Manager" live>
            <label className="ac-check" style={{ marginBottom: 10 }}>
              <input
                type="checkbox"
                checked={settings.gtmEnabled}
                onChange={(e) => patchSettings({ gtmEnabled: e.target.checked })}
              />
              Enable GTM container
            </label>
            <input
              className="input"
              placeholder="GTM-XXXXXXX"
              value={settings.gtmContainerId}
              onChange={(e) => {
                const gtmContainerId = e.target.value.trim();
                patchSettings({ gtmContainerId, gtmEnabled: !!gtmContainerId || settings.gtmEnabled });
              }}
            />
          </DataPanel>

          <DataPanel title="More Analytics Pixels" live>
            <label className="ac-label">Facebook Pixel ID</label>
            <input className="input" placeholder="1234567890" value={settings.facebookPixelId} onChange={(e) => patchSettings({ facebookPixelId: e.target.value.trim() })} />
            <label className="ac-label">Microsoft Clarity ID</label>
            <input className="input" placeholder="clarity project id" value={settings.microsoftClarityId} onChange={(e) => patchSettings({ microsoftClarityId: e.target.value.trim() })} />
            <label className="ac-label">Hotjar Site ID</label>
            <input className="input" placeholder="1234567" value={settings.hotjarSiteId} onChange={(e) => patchSettings({ hotjarSiteId: e.target.value.trim() })} />
            <p className="settings-panel-desc">Pixel IDs are stored and exposed on the public tracking payload — add matching script tags in Global Header if needed.</p>
          </DataPanel>
        </div>
      )}

      {section === 'search' && (
        <div className="grid grid-2">
          <DataPanel title="Google Search Console" live>
            <p className="settings-panel-desc">
              Paste the <strong>content</strong> value from the HTML meta tag verification method.
              {' '}<a href={SEARCH_CONSOLE_LINKS.google} target="_blank" rel="noopener noreferrer">Open Search Console →</a>
            </p>
            <input
              className="input"
              placeholder="google-site-verification content value"
              value={settings.googleSearchConsoleVerification}
              onChange={(e) => patchSettings({ googleSearchConsoleVerification: e.target.value.trim() })}
            />
          </DataPanel>

          <DataPanel title="Bing Webmaster Tools" live>
            <p className="settings-panel-desc">
              Paste the <strong>content</strong> from <code>msvalidate.01</code> meta tag.
              {' '}<a href={SEARCH_CONSOLE_LINKS.bing} target="_blank" rel="noopener noreferrer">Open Bing Webmaster →</a>
            </p>
            <input
              className="input"
              placeholder="Bing verification content"
              value={settings.bingWebmasterVerification}
              onChange={(e) => patchSettings({ bingWebmasterVerification: e.target.value.trim() })}
            />
          </DataPanel>

          <DataPanel title="Yahoo Site Explorer" live>
            <p className="settings-panel-desc">Paste Yahoo <code>y_key</code> verification content (Bing Webmaster also syndicates to Yahoo).</p>
            <input
              className="input"
              placeholder="Yahoo y_key content"
              value={settings.yahooSiteVerification}
              onChange={(e) => patchSettings({ yahooSiteVerification: e.target.value.trim() })}
            />
          </DataPanel>

          <DataPanel title="Live Preview" live>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <input className="input" style={{ flex: 1, minWidth: 140 }} value={previewPath} onChange={(e) => setPreviewPath(e.target.value)} placeholder="/about" />
              <button type="button" className="btn" onClick={loadPreview}>Preview payload</button>
            </div>
            <pre className="site-tracking-preview">{previewJson || 'Click Preview payload to see what visitors receive on this path.'}</pre>
          </DataPanel>
        </div>
      )}
    </div>
  );
}