'use client';

import { useCallback, useEffect, useState } from 'react';
import { invoke } from '@/lib/api';
import {
  DEFAULT_INTELLIGENCE_SETTINGS,
  IntelligenceSettings,
  LinkedAccountIntel,
  normalizeProfile,
} from '@/lib/intelligenceProfile';

export function useIntelligence() {
  const [settings, setSettings] = useState<IntelligenceSettings>(DEFAULT_INTELLIGENCE_SETTINGS);
  const [accounts, setAccounts] = useState<LinkedAccountIntel[]>([]);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    const [s, a] = await Promise.all([
      invoke<IntelligenceSettings>('get-intelligence-settings').catch(() => DEFAULT_INTELLIGENCE_SETTINGS),
      invoke<LinkedAccountIntel[]>('get-linked-accounts'),
    ]);
    setSettings({
      ...DEFAULT_INTELLIGENCE_SETTINGS,
      ...(s && typeof s === 'object' ? s : {}),
      surfaces: Array.isArray(s?.surfaces) ? s.surfaces : DEFAULT_INTELLIGENCE_SETTINGS.surfaces,
    });
    setAccounts(Array.isArray(a) ? a : []);
  }, []);

  useEffect(() => { refresh().catch(console.error); }, [refresh]);

  const isSurfaceEnabled = useCallback((surface: string) => {
    return !!settings.enabled && Array.isArray(settings.surfaces) && settings.surfaces.includes(surface);
  }, [settings]);

  const getProfile = useCallback((accountId?: string | null) => {
    const acc = accountId ? accounts.find((a) => a.id === accountId) : accounts[0];
    return { account: acc, profile: normalizeProfile(acc?.profile) };
  }, [accounts]);

  const saveSettings = useCallback(async (next: Partial<IntelligenceSettings>) => {
    setLoading(true);
    try {
      const merged = { ...settings, ...next };
      await invoke('save-intelligence-settings', merged);
      setSettings(merged);
      return merged;
    } finally {
      setLoading(false);
    }
  }, [settings]);

  const refreshAccountProfile = useCallback(async (accountId: string) => {
    setLoading(true);
    try {
      await invoke('refresh-account-profile', accountId);
      await refresh();
    } finally {
      setLoading(false);
    }
  }, [refresh]);

  const refreshAllProfiles = useCallback(async () => {
    setLoading(true);
    try {
      for (const acc of accounts) {
        try { await invoke('refresh-account-profile', acc.id); } catch { /* continue */ }
      }
      await refresh();
    } finally {
      setLoading(false);
    }
  }, [accounts, refresh]);

  return {
    settings,
    accounts,
    loading,
    refresh,
    saveSettings,
    isSurfaceEnabled,
    getProfile,
    refreshAccountProfile,
    refreshAllProfiles,
  };
}