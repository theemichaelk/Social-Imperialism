'use client';

import Link from 'next/link';
import { IntelligenceProfilePanel } from '@/components/IntelligenceProfilePanel';
import { IntelligenceRecommendations } from '@/components/IntelligenceRecommendations';
import { DataPanel, SparkRow } from '@/components/DashboardViz';
import { useIntelligence } from '@/hooks/useIntelligence';
import { INTELLIGENCE_SURFACES, normalizeProfile } from '@/lib/intelligenceProfile';

export function IntelligenceSettingsPanel() {
  const {
    settings,
    accounts,
    loading,
    saveSettings,
    refreshAllProfiles,
    refreshAccountProfile,
  } = useIntelligence();

  const withProfile = accounts.filter((a) => normalizeProfile(a.profile));

  async function toggleEnabled() {
    await saveSettings({ enabled: !settings.enabled });
  }

  async function toggleSurface(id: string) {
    const surfaces = settings.surfaces.includes(id)
      ? settings.surfaces.filter((s) => s !== id)
      : [...settings.surfaces, id];
    await saveSettings({ surfaces });
  }

  return (
    <div className="grid grid-2">
      <DataPanel title="Account Intelligence" live>
        <p className="settings-panel-desc">
          Live per-account signals — followers, engagement, best posting windows, trending niches, and suggested communities.
          These recommendations appear across the app when enabled.
        </p>
        <label className="ip-toggle">
          <input type="checkbox" checked={settings.enabled} onChange={toggleEnabled} />
          Use intelligence recommendations throughout the app
        </label>
        <div className="ip-toggle-grid">
          <label className="ip-toggle"><input type="checkbox" checked={settings.autoSuggestScheduling} onChange={() => saveSettings({ autoSuggestScheduling: !settings.autoSuggestScheduling })} /> Suggest best posting times</label>
          <label className="ip-toggle"><input type="checkbox" checked={settings.autoSuggestNiches} onChange={() => saveSettings({ autoSuggestNiches: !settings.autoSuggestNiches })} /> Suggest trending niches</label>
          <label className="ip-toggle"><input type="checkbox" checked={settings.autoSuggestCommunities} onChange={() => saveSettings({ autoSuggestCommunities: !settings.autoSuggestCommunities })} /> Suggest communities / groups</label>
        </div>
        <SparkRow items={[
          { label: 'Linked', value: accounts.length },
          { label: 'With profile', value: withProfile.length, status: withProfile.length ? 'ok' : 'warn' },
          { label: 'Surfaces', value: settings.surfaces.length },
        ]} />
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
          <button className="btn primary" disabled={loading} onClick={() => refreshAllProfiles()}>Refresh All Profiles</button>
          <Link href="/account-hub" className="btn">Account Hub →</Link>
        </div>
      </DataPanel>

      <DataPanel title="Surfaces (where recommendations appear)" live>
        <div className="ip-surface-grid">
          {INTELLIGENCE_SURFACES.map((s) => (
            <label key={s.id} className={`ip-surface-chip ${settings.surfaces.includes(s.id) ? 'on' : ''}`}>
              <input
                type="checkbox"
                checked={settings.surfaces.includes(s.id)}
                onChange={() => toggleSurface(s.id)}
                disabled={!settings.enabled}
              />
              {s.label}
            </label>
          ))}
        </div>
      </DataPanel>

      {accounts.map((acc) => {
        const profile = normalizeProfile(acc.profile);
        return (
          <DataPanel key={acc.id} title={`${acc.platform}${acc.type ? ` · ${acc.type}` : ''}`} live>
            {profile ? (
              <>
                <IntelligenceProfilePanel account={acc} profile={profile} refreshedAt={acc.profileRefreshedAt} showHeader />
                <IntelligenceRecommendations account={acc} profile={profile} settings={settings} maxItems={5} />
              </>
            ) : (
              <p className="settings-panel-desc">No intelligence profile — refresh to pull live metrics from {acc.platform}.</p>
            )}
            <button className="btn" style={{ marginTop: 8 }} disabled={loading} onClick={() => refreshAccountProfile(acc.id)}>
              Refresh {acc.handle || acc.platform}
            </button>
          </DataPanel>
        );
      })}

      {!accounts.length && (
        <DataPanel title="No linked accounts" live className="grid-span-2">
          <p className="settings-panel-desc">Connect accounts in Account Hub to enable intelligence profiles and cross-app recommendations.</p>
          <Link href="/account-hub" className="btn primary">Open Account Hub</Link>
        </DataPanel>
      )}
    </div>
  );
}