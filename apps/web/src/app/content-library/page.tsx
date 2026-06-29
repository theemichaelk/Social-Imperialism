'use client';

import { useCallback, useEffect, useState } from 'react';
import { invoke } from '@/lib/api';
import { PageShell } from '@/components/PageShell';
import { SectionLivePanel } from '@/components/SectionLivePanel';
import { GrokToolbar } from '@/components/GrokToolbar';
import Link from 'next/link';
import { ManageableTabNav } from '@/components/ManageableTabNav';

const FILTER_TABS = [
  { id: 'all', label: 'All', locked: true },
  { id: 'image', label: 'Images' },
  { id: 'video', label: 'Video' },
  { id: 'copy', label: 'Copy' },
];

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
    try {
      const res = await invoke<{ assets?: Asset[]; success?: boolean; error?: string }>('get-content-library');
      if (res && typeof res === 'object' && 'success' in res && res.success === false) {
        throw new Error(res.error || 'Failed to load library');
      }
      setAssets(res?.assets || []);
    } catch (e) {
      setMsg((e as Error).message);
    }
  }, []);

  useEffect(() => { refresh().catch(console.error); }, [refresh]);

  async function uploadFile(file: File) {
    setLoading(true);
    setMsg(`Uploading ${file.name}…`);
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ''));
        reader.onerror = () => reject(new Error('Could not read file'));
        reader.readAsDataURL(file);
      });
      const uploaded = await invoke<string>('upload-local-media', dataUrl);
      if (!uploaded || typeof uploaded !== 'string') {
        throw new Error('Upload failed — media could not be processed');
      }
      await invoke('save-content-asset', {
        name: file.name,
        type: file.type.startsWith('video') ? 'video' : 'image',
        url: uploaded,
        tags: ['upload'],
        source: 'upload',
      });
      setMsg(`Uploaded ${file.name}`);
      await refresh();
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function importWebsite() {
    if (!importUrl.trim()) return;
    setLoading(true);
    setMsg('Importing from website…');
    try {
      const res = await invoke<{ success?: boolean; error?: string; count?: number; assets?: Asset[] }>('import-website-to-library', { url: importUrl.trim() });
      if (!res.success) throw new Error(res.error || 'Import failed');
      setMsg(`Imported ${res.assets?.length ?? res.count ?? 0} asset(s) from website`);
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
    setLoading(true);
    setMsg('Saving copy…');
    try {
      const res = await invoke<{ success?: boolean; error?: string }>('import-text-to-library', { text: pasteText, name: 'Pasted copy', tags: ['paste'] });
      if (res && typeof res === 'object' && 'success' in res && res.success === false) {
        throw new Error(res.error || 'Save failed');
      }
      setPasteText('');
      setMsg('Copy saved to library');
      await refresh();
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function removeAsset(id: string) {
    setMsg('Removing asset…');
    try {
      await invoke('delete-content-asset', { id });
      setMsg('Asset removed');
      await refresh();
    } catch (e) {
      setMsg((e as Error).message);
    }
  }

  const shown = assets.filter((a) => {
    if (filter === 'all') return true;
    if (filter === 'copy') return a.type === 'copy' || a.type === 'text';
    return a.type === filter;
  });

  return (
    <div>
      <PageShell
        title="Content Library"
        actions={
          <>
            <Link href="/content-hub?tab=studio" className="btn primary">Open Create →</Link>
            <Link href="/design-studio" className="btn">Design Studio</Link>
          </>
        }
      />

      <SectionLivePanel section="content-library" />
      <GrokToolbar pageId="content-library" compact />

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
          <button type="button" className="btn" style={{ marginTop: 8 }} onClick={importPaste} disabled={loading}>Save to library</button>
        </div>
      </div>

      <ManageableTabNav
        pageId="content-library"
        catalog={FILTER_TABS.map((t) => ({
          ...t,
          label: t.id === 'all' ? `All (${assets.length})` : t.label,
        }))}
        active={filter}
        onChange={setFilter}
      />

      <div className="grid grid-2">
        {shown.map((a) => (
          <div key={a.id} className="card post-card">
            <div className="post-meta">{a.type} · {a.source} · {(a.tags || []).join(', ')}</div>
            <strong>{a.name}</strong>
            {a.url && a.type === 'video' && (
              <video src={a.url} controls style={{ maxWidth: '100%', maxHeight: 160, borderRadius: 8, marginTop: 8 }} />
            )}
            {a.url && a.type !== 'copy' && a.type !== 'text' && a.type !== 'video' && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={a.url} alt="" style={{ maxWidth: '100%', maxHeight: 160, borderRadius: 8, marginTop: 8 }} />
            )}
            {a.text && <p style={{ fontSize: '0.85rem', color: '#94a3b8', marginTop: 8 }}>{a.text.slice(0, 280)}{a.text.length > 280 ? '…' : ''}</p>}
            <button type="button" className="btn" style={{ marginTop: 8 }} onClick={() => removeAsset(a.id)}>Remove</button>
          </div>
        ))}
        {!shown.length && <div className="card"><p className="settings-panel-desc">No assets yet — upload or import above.</p></div>}
      </div>
      {msg && (
        <div className="card" style={{ marginTop: 12, borderColor: msg.includes('failed') || msg.includes('error') || msg.includes('No ') ? '#f59e0b' : '#10b981' }}>
          <p style={{ margin: 0, fontSize: '0.9rem' }}>{msg}</p>
        </div>
      )}
    </div>
  );
}