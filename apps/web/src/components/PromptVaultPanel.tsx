'use client';

import { useCallback, useEffect, useState } from 'react';
import { invoke } from '@/lib/api';
import { DataPanel, SparkRow } from '@/components/DashboardViz';
import { PROMPT_VAULT_FEATURES, featureLabel } from '@/lib/promptVaultFeatures';
import type { VaultPrompt } from '@/components/PromptVaultPicker';

type Props = {
  defaultFeature?: string;
  onLoad?: (text: string, prompt?: VaultPrompt) => void;
};

export function PromptVaultPanel({ defaultFeature = 'general', onLoad }: Props) {
  const [prompts, setPrompts] = useState<VaultPrompt[]>([]);
  const [total, setTotal] = useState(0);
  const [query, setQuery] = useState('');
  const [filterFeature, setFilterFeature] = useState(defaultFeature);
  const [selectedId, setSelectedId] = useState('');
  const [edit, setEdit] = useState<Partial<VaultPrompt>>({ feature: defaultFeature });
  const [msg, setMsg] = useState('');
  const [saving, setSaving] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const res = await invoke<{ prompts?: VaultPrompt[]; total?: number; success?: boolean; error?: string }>('get-prompt-vault', {
        query,
        keyword: query,
        feature: filterFeature === 'all' ? undefined : filterFeature,
      });
      if (res && typeof res === 'object' && 'success' in res && res.success === false) {
        throw new Error(res.error || 'Failed to load vault');
      }
      setPrompts(res.prompts || []);
      setTotal(res.total || res.prompts?.length || 0);
    } catch (e) {
      setMsg((e as Error).message);
    }
  }, [query, filterFeature]);

  useEffect(() => { refresh().catch(console.error); }, [refresh]);

  const selected = prompts.find((p) => p.id === selectedId) || prompts[0];

  useEffect(() => {
    if (selected && !edit.id) {
      setSelectedId(selected.id);
      setEdit(selected);
    }
  }, [selected, edit.id]);

  function selectPrompt(p: VaultPrompt) {
    setSelectedId(p.id);
    setEdit({ ...p });
  }

  function newPrompt() {
    setSelectedId('');
    setEdit({
      title: '',
      body: '',
      keywords: [],
      feature: filterFeature === 'all' ? 'general' : filterFeature,
      platform: '',
      tags: [],
    });
  }

  async function save() {
    setSaving(true);
    setMsg('');
    try {
      const res = await invoke<{ success?: boolean; error?: string; prompt?: VaultPrompt }>(
        'save-prompt-vault-item',
        {
          ...edit,
          keywords: Array.isArray(edit.keywords)
            ? edit.keywords
            : String(edit.keywords || '').split(/[,;\n]+/).map((k) => k.trim()).filter(Boolean),
        },
      );
      if (!res.success) throw new Error(res.error || 'Save failed');
      setMsg('Prompt saved');
      if (res.prompt) {
        setSelectedId(res.prompt.id);
        setEdit(res.prompt);
      }
      await refresh();
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function createFromKeyword() {
    const kw = query.trim() || window.prompt('Enter keyword to generate a prompt template:');
    if (!kw?.trim()) return;
    setMsg('Generating from keyword…');
    const res = await invoke<{ success?: boolean; prompt?: VaultPrompt; error?: string }>(
      'create-prompt-vault-from-keyword',
      { keyword: kw.trim(), feature: filterFeature === 'all' ? 'general' : filterFeature },
    );
    if (!res.success || !res.prompt) {
      setMsg(res.error || 'Create failed');
      return;
    }
    selectPrompt(res.prompt);
    setMsg(`Created: ${res.prompt.title}`);
    await refresh();
  }

  async function loadSelected() {
    if (!edit.id) return;
    const res = await invoke<{ success?: boolean; text?: string; prompt?: VaultPrompt; error?: string }>(
      'load-prompt-vault-item',
      { id: edit.id },
    );
    if (!res.success || !res.text) {
      setMsg(res.error || 'Load failed');
      return;
    }
    setEdit((prev) => ({ ...prev, body: res.text }));
    onLoad?.(res.text, res.prompt);
    setMsg('Loaded with brand context — ready to apply in feature');
    await refresh();
  }

  async function deleteSelected() {
    if (!edit.id) return;
    if (!window.confirm(`Delete "${edit.title}"?`)) return;
    try {
      const res = await invoke<{ success?: boolean; error?: string }>('delete-prompt-vault-item', { id: edit.id });
      if (res && typeof res === 'object' && 'success' in res && res.success === false) {
        throw new Error(res.error || 'Delete failed');
      }
      setMsg('Deleted');
      newPrompt();
      await refresh();
    } catch (e) {
      setMsg((e as Error).message);
    }
  }

  function useInCreate() {
    const text = (edit.body || '').trim();
    if (!text) {
      setMsg('Add prompt body first');
      return;
    }
    try {
      sessionStorage.setItem('si_omni_handoff', JSON.stringify({ type: 'content', content: text }));
    } catch { /* ignore */ }
    window.location.assign('/content-hub?tab=studio');
  }

  async function exportVault() {
    const res = await invoke<{ prompts?: VaultPrompt[]; exportedAt?: string; brandName?: string }>(
      'export-prompt-vault',
      { query, feature: filterFeature === 'all' ? undefined : filterFeature },
    );
    const blob = new Blob([JSON.stringify(res, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `prompt-vault-${res.exportedAt?.slice(0, 10) || 'export'}.json`;
    a.click();
    setMsg(`Exported ${res.prompts?.length || 0} prompts`);
  }

  return (
    <div className="pv-page">
      <div className="dash-hero" style={{ marginBottom: '1rem' }}>
        <SparkRow items={[
          { label: 'Total', value: total },
          { label: 'Showing', value: prompts.length },
          { label: 'Feature', value: filterFeature === 'all' ? 'All' : featureLabel(filterFeature) },
        ]} />
      </div>

      <div className="pv-toolbar">
        <input
          className="input"
          placeholder="Search keyword, title, tag…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && refresh()}
        />
        <select className="input" value={filterFeature} onChange={(e) => setFilterFeature(e.target.value)}>
          <option value="all">All features</option>
          {PROMPT_VAULT_FEATURES.map((f) => (
            <option key={f.id} value={f.id}>{f.icon} {f.label}</option>
          ))}
        </select>
        <button type="button" className="btn" onClick={() => refresh()}>Search</button>
        <button type="button" className="btn primary" onClick={createFromKeyword}>Create (keyword)</button>
        <button type="button" className="btn" onClick={newPrompt}>New blank</button>
        <button type="button" className="btn" onClick={exportVault}>Export JSON</button>
      </div>

      {msg && (
        <div className="card" style={{ marginBottom: 12, borderColor: /failed|error|required|delete/i.test(msg) ? '#f59e0b' : '#10b981' }}>
          <p style={{ margin: 0, fontSize: '0.9rem' }}>{msg}</p>
        </div>
      )}

      <div className="grid grid-2 pv-grid">
        <DataPanel title={`Templates (${prompts.length})`} live>
          <div className="pv-list">
            {prompts.map((p) => (
              <button
                key={p.id}
                type="button"
                className={`pv-list-item ${p.id === selectedId ? 'active' : ''}`}
                onClick={() => selectPrompt(p)}
              >
                <strong>{p.title}</strong>
                <span className="post-meta">
                  {featureLabel(p.feature || 'general')}
                  {(p.keywords || []).length ? ` · ${(p.keywords || []).slice(0, 3).join(', ')}` : ''}
                  {p.usageCount ? ` · ${p.usageCount}×` : ''}
                </span>
              </button>
            ))}
            {!prompts.length && <p className="settings-panel-desc">No prompts — create from a keyword or add blank.</p>}
          </div>
        </DataPanel>

        <DataPanel title={edit.id ? 'Edit template' : 'New template'} live>
          <div className="form-group">
            <label>Title</label>
            <input className="input" value={edit.title || ''} onChange={(e) => setEdit({ ...edit, title: e.target.value })} />
          </div>
          <div className="grid grid-2">
            <div className="form-group">
              <label>Feature / brain route</label>
              <select className="input" value={edit.feature || 'general'} onChange={(e) => setEdit({ ...edit, feature: e.target.value })}>
                {PROMPT_VAULT_FEATURES.map((f) => (
                  <option key={f.id} value={f.id}>{f.label}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label>Platform (optional)</label>
              <input className="input" value={edit.platform || ''} onChange={(e) => setEdit({ ...edit, platform: e.target.value })} placeholder="LinkedIn, Reddit…" />
            </div>
          </div>
          <div className="form-group">
            <label>Keywords (comma-separated — used for search)</label>
            <input
              className="input"
              value={Array.isArray(edit.keywords) ? edit.keywords.join(', ') : ''}
              onChange={(e) => setEdit({ ...edit, keywords: e.target.value.split(/[,;\n]+/).map((k) => k.trim()).filter(Boolean) })}
            />
          </div>
          <div className="form-group">
            <label>Prompt body</label>
            <textarea
              className="input"
              rows={10}
              value={edit.body || ''}
              onChange={(e) => setEdit({ ...edit, body: e.target.value })}
              placeholder="Use {{keyword}}, {{brandName}}, {{domain}}, {{tone}} placeholders…"
            />
          </div>
          <p className="settings-panel-desc">
            Placeholders resolve on <strong>Load</strong> from your active campaign. Brain routes templates to the matching feature.
          </p>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button type="button" className="btn primary" onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
            <button type="button" className="btn" onClick={loadSelected} disabled={!edit.id || saving}>Load (apply context)</button>
            <button type="button" className="btn" onClick={useInCreate} disabled={!edit.body?.trim()}>Use in Create →</button>
            {onLoad && edit.body && (
              <button type="button" className="btn" onClick={() => onLoad(edit.body || '', edit as VaultPrompt)}>Apply to editor</button>
            )}
            {edit.id && (
              <button type="button" className="btn" onClick={deleteSelected}>Delete</button>
            )}
          </div>
        </DataPanel>
      </div>
    </div>
  );
}