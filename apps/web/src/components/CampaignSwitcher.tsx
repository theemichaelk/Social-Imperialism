'use client';
import { useCallback, useEffect, useState } from 'react';
import { invoke } from '@/lib/api';

type Campaign = { id: string; brandName?: string; domain?: string; status?: string };

export function CampaignSwitcher({ onSwitch }: { onSwitch?: (id: string) => void }) {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [activeId, setActiveId] = useState('');
  const [switching, setSwitching] = useState(false);

  const load = useCallback(async () => {
    const [list, active] = await Promise.all([
      invoke<Campaign[]>('get-settings'),
      invoke<Campaign | null>('get-active-campaign'),
    ]);
    setCampaigns(Array.isArray(list) ? list : []);
    setActiveId(active?.id || list?.[0]?.id || '');
  }, []);

  useEffect(() => { load().catch(console.error); }, [load]);

  async function switchTo(id: string) {
    if (!id || id === activeId) return;
    setSwitching(true);
    try {
      await invoke('set-active-campaign', id);
      setActiveId(id);
      onSwitch?.(id);
    } finally {
      setSwitching(false);
    }
  }

  if (!campaigns.length) return null;

  return (
    <div className="campaign-switcher">
      <span className="campaign-switcher-label">Campaign</span>
      <select
        className="input campaign-switcher-select"
        value={activeId}
        disabled={switching}
        onChange={(e) => switchTo(e.target.value)}
      >
        {campaigns.map((c) => (
          <option key={c.id} value={c.id}>
            {c.brandName || c.domain || c.id}{c.domain ? ` · ${c.domain}` : ''}
          </option>
        ))}
      </select>
      {switching && <span className="live-pulse">Switching…</span>}
    </div>
  );
}