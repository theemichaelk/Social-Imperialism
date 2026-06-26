'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { invoke } from '@/lib/api';
import { featureLabel, type PromptVaultFeatureId } from '@/lib/promptVaultFeatures';

export type VaultPrompt = {
  id: string;
  title: string;
  body: string;
  keywords?: string[];
  feature?: string;
  platform?: string;
  tags?: string[];
  usageCount?: number;
};

type Props = {
  feature?: PromptVaultFeatureId | string;
  onLoad: (text: string, prompt?: VaultPrompt) => void;
  compact?: boolean;
};

export function PromptVaultPicker({ feature = 'general', onLoad, compact }: Props) {
  const [query, setQuery] = useState('');
  const [prompts, setPrompts] = useState<VaultPrompt[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState('');

  const refresh = useCallback(async (q?: string) => {
    setLoading(true);
    try {
      const res = await invoke<{ prompts?: VaultPrompt[] }>('search-prompt-vault', {
        query: q ?? query,
        keyword: q ?? query,
        feature,
      });
      setPrompts(res.prompts || []);
    } finally {
      setLoading(false);
    }
  }, [query, feature]);

  useEffect(() => {
    if (open) refresh('').catch(console.error);
  }, [open, refresh]);

  async function loadPrompt(id: string) {
    setMsg('Loading…');
    const res = await invoke<{ success?: boolean; text?: string; prompt?: VaultPrompt; error?: string }>(
      'load-prompt-vault-item',
      { id },
    );
    if (!res.success || !res.text) {
      setMsg(res.error || 'Load failed');
      return;
    }
    onLoad(res.text, res.prompt);
    setMsg(`Loaded: ${res.prompt?.title || 'prompt'}`);
    setOpen(false);
  }

  async function createFromKeyword() {
    const kw = query.trim() || window.prompt('Keyword for new prompt template:');
    if (!kw?.trim()) return;
    setMsg('Creating from keyword…');
    const res = await invoke<{ success?: boolean; prompt?: VaultPrompt; error?: string }>(
      'create-prompt-vault-from-keyword',
      { keyword: kw.trim(), feature },
    );
    if (!res.success || !res.prompt) {
      setMsg(res.error || 'Create failed');
      return;
    }
    await refresh(kw);
    setMsg(`Created: ${res.prompt.title}`);
  }

  return (
    <div className={`pv-picker ${compact ? 'pv-picker-compact' : ''}`}>
      <div className="pv-picker-row">
        <button type="button" className="btn" onClick={() => setOpen((o) => !o)}>
          {open ? '▾' : '▸'} Prompt Vault
        </button>
        {!compact && (
          <Link href="/prompt-vault" className="btn">Open Vault →</Link>
        )}
      </div>
      {open && (
        <div className="pv-picker-panel card">
          <div className="pv-picker-search">
            <input
              className="input"
              placeholder="Search by keyword, title, feature…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && refresh()}
            />
            <button type="button" className="btn" onClick={() => refresh()} disabled={loading}>Search</button>
            <button type="button" className="btn primary" onClick={createFromKeyword}>+ Create</button>
          </div>
          <p className="settings-panel-desc" style={{ margin: '8px 0 0' }}>
            Feature: <strong>{featureLabel(feature)}</strong> — templates apply brand + campaign context on load.
          </p>
          <div className="pv-picker-list">
            {prompts.slice(0, 8).map((p) => (
              <div key={p.id} className="pv-picker-item">
                <div>
                  <strong>{p.title}</strong>
                  <div className="post-meta">
                    {(p.keywords || []).slice(0, 4).join(', ')}
                    {p.usageCount ? ` · used ${p.usageCount}×` : ''}
                  </div>
                </div>
                <button type="button" className="btn primary" onClick={() => loadPrompt(p.id)}>Load</button>
              </div>
            ))}
            {!prompts.length && !loading && (
              <p className="settings-panel-desc">No matches — try another keyword or create one.</p>
            )}
          </div>
          {msg && <p className="page-msg" style={{ marginTop: 8, marginBottom: 0 }}>{msg}</p>}
        </div>
      )}
    </div>
  );
}