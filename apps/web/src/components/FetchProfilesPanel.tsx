'use client';
import { useCallback, useEffect, useState } from 'react';
import { invoke } from '@/lib/api';
import {
  FetchProfile,
  FetchProfileFilters,
  PRESET_FETCH_PROFILES,
} from '@/lib/fetchProfiles';

type Props = {
  currentFilters: FetchProfileFilters;
  onApply: (filters: FetchProfileFilters) => void;
};

export function FetchProfilesPanel({ currentFilters, onApply }: Props) {
  const [saved, setSaved] = useState<FetchProfile[]>([]);
  const [selected, setSelected] = useState('');
  const [msg, setMsg] = useState('');

  const refresh = useCallback(async () => {
    const list = await invoke<FetchProfile[]>('get-fetch-profiles');
    setSaved(Array.isArray(list) ? list : []);
  }, []);

  useEffect(() => { refresh().catch(console.error); }, [refresh]);

  async function saveProfile() {
    const name = window.prompt('Name this filter profile:');
    if (!name?.trim()) return;
    await invoke('save-fetch-profile', {
      name: name.trim(),
      filters: { ...currentFilters },
    });
    setMsg(`Saved "${name.trim()}"`);
    refresh();
  }

  async function deleteProfile(id: string) {
    await invoke('delete-fetch-profile', id);
    setSelected('');
    refresh();
  }

  function loadSelection(value: string) {
    setSelected(value);
    if (!value) return;
    if (value.startsWith('preset:')) {
      const preset = PRESET_FETCH_PROFILES.find((p) => `preset:${p.name}` === value);
      if (preset) onApply(preset.filters);
      return;
    }
    const profile = saved.find((p) => p.id === value || p.name === value);
    if (profile) onApply(profile.filters);
  }

  return (
    <div className="fetch-profiles-panel">
      <select
        className="input"
        value={selected}
        onChange={(e) => loadSelection(e.target.value)}
        style={{ maxWidth: 200, margin: 0 }}
      >
        <option value="">Fetch Profiles…</option>
        <optgroup label="Presets">
          {PRESET_FETCH_PROFILES.map((p) => (
            <option key={p.name} value={`preset:${p.name}`}>{p.name}</option>
          ))}
        </optgroup>
        {saved.length > 0 && (
          <optgroup label="Saved">
            {saved.map((p) => (
              <option key={p.id || p.name} value={p.id || p.name}>{p.name}</option>
            ))}
          </optgroup>
        )}
      </select>
      <button className="btn" type="button" onClick={saveProfile}>Save Profile</button>
      {selected && !selected.startsWith('preset:') && (
        <button
          className="btn"
          type="button"
          onClick={() => {
            const p = saved.find((x) => x.id === selected || x.name === selected);
            if (p?.id) deleteProfile(p.id);
          }}
        >
          Delete
        </button>
      )}
      {msg && <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>{msg}</span>}
    </div>
  );
}