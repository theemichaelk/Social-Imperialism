'use client';

import { useState } from 'react';
import { invoke } from '@/lib/api';
import { GeneratedPost, IMPERIAL_TEMPLATES, TemplateCategory } from '@/lib/imperialContentTemplates';
import { SocialPostCard } from '@/components/SocialPostCard';

type Props = {
  post: GeneratedPost | null;
  accounts: Array<{ id: string; platform: string; handle?: string }>;
  onClose: () => void;
  onSave: (post: GeneratedPost) => void;
};

export function PostEditorModal({ post, accounts, onClose, onSave }: Props) {
  const [content, setContent] = useState(post?.content || '');
  const [mediaUrl, setMediaUrl] = useState(post?.mediaUrl || '');
  const [templateId, setTemplateId] = useState<TemplateCategory | undefined>(post?.templateId);
  const [platform, setPlatform] = useState(post?.platform || accounts[0]?.platform || 'LinkedIn');
  const [msg, setMsg] = useState('');
  const [loading, setLoading] = useState(false);

  if (!post) return null;

  const draft: GeneratedPost = {
    ...post,
    content,
    mediaUrl: mediaUrl || null,
    templateId,
    platform,
    headline: content.split('\n')[0]?.slice(0, 80),
  };

  async function regenerate() {
    setLoading(true);
    setMsg('Regenerating in your brand voice…');
    try {
      const text = await invoke<string>('generate-ai', `Rewrite this social post in an on-brand, professional voice — not generic AI. Keep platform: ${platform}. Original:\n${content}`);
      setContent(text);
      setMsg('Regenerated');
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function generateImage() {
    setLoading(true);
    setMsg('Generating branded visual…');
    try {
      const template = IMPERIAL_TEMPLATES.find((t) => t.id === templateId);
      const res = await invoke<{ imageUrl?: string; success?: boolean }>('generate-image', `Professional social media ${template?.label || 'post'} graphic. Brand content: ${content.slice(0, 200)}. Clean typography, modern layout, 4:5 aspect.`);
      if (res.imageUrl) {
        setMediaUrl(res.imageUrl);
        setMsg('Image ready');
      } else {
        setMsg('No image returned — try stock photo');
      }
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function stockPhoto() {
    const q = content.split('\n')[0]?.slice(0, 60) || 'business marketing';
    const res = await invoke<{ imageUrl?: string }>('search-stock-photo', q);
    if (res.imageUrl) {
      setMediaUrl(res.imageUrl);
      setMsg('Stock photo attached');
    }
  }

  function save(approve = false) {
    onSave({
      ...draft,
      status: approve ? 'approved' : draft.status,
    });
    onClose();
  }

  return (
    <div className="modal-overlay si-editor-overlay" onClick={onClose}>
      <div className="si-editor-modal" onClick={(e) => e.stopPropagation()}>
        <div className="si-editor-header">
          <div>
            <h3>Edit Post</h3>
            <p className="settings-panel-desc" style={{ margin: 0 }}>Social Imperialism — on-brand, fully editable before publish</p>
          </div>
          <button type="button" className="close-btn" onClick={onClose}>×</button>
        </div>

        <div className="si-editor-layout">
          <div className="si-editor-preview">
            <SocialPostCard post={draft} />
          </div>
          <div className="si-editor-form">
            <label className="ac-label">Template style</label>
            <select className="input" value={templateId} onChange={(e) => setTemplateId(e.target.value as TemplateCategory)}>
              {IMPERIAL_TEMPLATES.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
            </select>

            <label className="ac-label">Platform</label>
            <select className="input" value={platform} onChange={(e) => setPlatform(e.target.value)}>
              {[...new Set(accounts.map((a) => a.platform))].map((p) => <option key={p} value={p}>{p}</option>)}
              {!accounts.length && <option value="LinkedIn">LinkedIn</option>}
            </select>

            <label className="ac-label">Caption & copy</label>
            <textarea className="input si-editor-textarea" rows={10} value={content} onChange={(e) => setContent(e.target.value)} />

            <label className="ac-label">Media URL</label>
            <input className="input" value={mediaUrl} onChange={(e) => setMediaUrl(e.target.value)} placeholder="Image or video URL" />

            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
              <button type="button" className="btn" onClick={regenerate} disabled={loading}>Regenerate Copy</button>
              <button type="button" className="btn" onClick={generateImage} disabled={loading}>AI Image</button>
              <button type="button" className="btn" onClick={stockPhoto} disabled={loading}>Stock Photo</button>
            </div>

            {msg && <p style={{ fontSize: '0.8rem', color: '#94a3b8', marginTop: 8 }}>{msg}</p>}
          </div>
        </div>

        <div className="si-editor-footer">
          <button type="button" className="btn" onClick={onClose}>Cancel</button>
          <button type="button" className="btn" onClick={() => save(false)}>Save Draft</button>
          <button type="button" className="btn primary" onClick={() => save(true)}>Approve</button>
        </div>
      </div>
    </div>
  );
}