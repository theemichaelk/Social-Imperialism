'use client';

import { useCallback, useEffect, useState } from 'react';
import { invoke } from '@/lib/api';
import { PageHeader } from '@/components/PageHeader';
import { SectionLivePanel } from '@/components/SectionLivePanel';
import Link from 'next/link';

type Asset = {
  id: string;
  name: string;
  type: string;
  url?: string;
  text?: string;
  tags?: string[];
  source?: string;
};

export default function ContentLibraryPage() {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [msg, setMsg] = useState('');
  const [importUrl, setImportUrl] = useState('');
  const [rssUrl, setRssUrl] = useState('');
  const [pasteText, setPasteText] = useState('');
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState('all');

  const refresh = useCallback(async () => {
    const res = await invoke<{ assets?: Asset[] }>('get-content-library');
    setAssets(res.assets || []);
  }, []);

  useEffect(() => { refresh().catch(console.error); }, [refresh]);

  async function uploadFile(file: File) {
    const reader = new FileReader();
    reader.onload = async () => {
      const dataUrl = await invoke<string>('upload-local-media', reader.result);
      if (!dataUrl) { setMsg('Upload failed'); return; }
      await invoke('save-content-asset', {
        name: file.name,
        type: file.type.startsWith('video') ? 'video' : 'image',
        url: dataUrl,
        tags: ['upload'],
        source: 'upload',
      });
      setMsg(`Uploaded ${file.name}`);
      refresh();
    };
    reader.readAsDataURL(file);
  }

  async function importWebsite() {
    if (!importUrl.trim()) return;
    setLoading(true);
    setMsg('Importing from website…');
    try {
      const res = await invoke<{ success?: boolean; error?: string; count?: number }>('import-website-to-library', { url: importUrl.trim() });
      if (!res.success) throw new Error(res.error || 'Import failed');
      setMsg(`Imported ${res.count ?? 0} asset(s)`);
      refresh();
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function importRss() {
    if (!rssUrl.trim()) return;
    setLoading(true);
    try {
      const res = await invoke<{ success?: boolean; error?: string }>('import-rss-to-library', { feedUrl: rssUrl.trim() });
      if (!res.success) throw new Error(res.error || 'RSS failed');
      setMsg('RSS items imported');
      refresh();
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function importPaste() {
    if (!pasteText.trim()) return;
    await invoke('import-text-to-library', { text: pasteText, name: 'Pasted copy', tags: ['paste'] });
    setPasteText('');
    setMsg('Copy saved to library');
    refresh();
  }

  async function removeAsset(id: string) {
    await invoke('delete-content-asset', { id });
    refresh();
  }

  const shown = assets.filter((a) => filter === 'all' || a.type === filter);

  return (
    <div>
      <PageHeader
        title="Content Library"
        subtitle="Central hub for images, video, copy, and imports — drag assets into Create or Design Studio"
        actions={<Link href="/content-hub?tab=studio" className="btn primary">Open Create →</Link>}
      />

      <SectionLivePanel section="content-library" />

      <div className="grid grid-2" style={{ marginBottom: '1rem' }}>
        <div className="card">
          <h3>Upload</h3>
          <input type="file" accept="image/*,video/*" onChange={(e) => e.target.files?.[0] && uploadFile(e.target.files[0])} />
          <p className="settings-panel-desc" style={{ marginTop: 8 }}>Images and video save to your campaign library.</p>
        </div>
        <div className="card">
          <h3>Import website</h3>
          <div className="ch-overview-cta-row">
            <input className="input" placeholder="https://yourbusiness.com" value={importUrl} onChange={(e) => setImportUrl(e.target.value)} />
            <button type="button" className="btn" onClick={importWebsite} disabled={loading}>Import</button>
          </div>
        </div>
        <div className="card">
          <h3>Import RSS</h3>
          <div className="ch-overview-cta-row">
            <input className="input" placeholder="https://feed.url/rss.xml" value={rssUrl} onChange={(e) => setRssUrl(e.target.value)} />
            <button type="button" className="btn" onClick={importRss} disabled={loading}>Import</button>
          </div>
        </div>
        <div className="card">
          <h3>Paste copy</h3>
          <textarea className="input" rows={3} value={pasteText} onChange={(e) => setPasteText(e.target.value)} placeholder="Brand copy, captions, snippets…" />
          <button type="button" className="btn" style={{ marginTop: 8 }} onClick={importPaste}>Save to library</button>
        </div>
      </div>

      <div className="tabs">
        {['all', 'image', 'video', 'copy'].map((t) => (
          <button key={t} type="button" className={`tab ${filter === t ? 'active' : ''}`} onClick={() => setFilter(t)}>
            {t === 'all' ? `All (${assets.length})` : t}
          </button>
        ))}
      </div>

      <div className="grid grid-2">
        {shown.map((a) => (
          <div key={a.id} className="card post-card">
            <div className="post-meta">{a.type} · {a.source} · {(a.tags || []).join(', ')}</div>
            <strong>{a.name}</strong>
            {a.url && a.type !== 'copy' && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={a.url} alt="" style={{ maxWidth: '100%', maxHeight: 160, borderRadius: 8, marginTop: 8 }} />
            )}
            {a.text && <p style={{ fontSize: '0.85rem', color: '#94a3b8', marginTop: 8 }}>{a.text.slice(0, 280)}{a.text.length > 280 ? '…' : ''}</p>}
            <button type="button" className="btn" style={{ marginTop: 8 }} onClick={() => removeAsset(a.id)}>Remove</button>
          </div>
        ))}
        {!shown.length && <div className="card"><p className="settings-panel-desc">No assets yet — upload or import above.</p></div>}
      </div>
      {msg && <p className="ics-msg">{msg}</p>}
    </div>
  );
}