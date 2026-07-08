/**
 * Consolidated, focus-first tab catalogs with legacy URL redirects.
 */

import type { TabCatalogItem } from '@/lib/manageableTabs';

export function resolveLegacyTab<T extends string>(
  raw: string | null | undefined,
  catalog: readonly { id: string }[],
  legacyMap: Record<string, T>,
  fallback: T,
): T {
  const mapped = (raw && legacyMap[raw]) || raw;
  if (mapped && catalog.some((t) => t.id === mapped)) return mapped as T;
  return fallback;
}

/** Content Hub — 15 tabs → 6 intelligent groups */
export const CONTENT_HUB_TABS = [
  { id: 'studio', label: 'Generate', group: "Today's Focus", locked: true },
  { id: 'queue', label: 'Review Queue', group: "Today's Focus" },
  { id: 'compose', label: 'Compose & Publish', group: "Today's Focus" },
  { id: 'automation', label: 'Automation', group: 'Pipeline' },
  { id: 'media', label: 'Media & Visuals', group: 'Create' },
  { id: 'tools', label: 'More Tools', group: 'Advanced' },
  { id: 'insights', label: 'Analytics', group: 'Advanced' },
] as const;

export type ContentHubTabId = (typeof CONTENT_HUB_TABS)[number]['id'];

export const CONTENT_HUB_LEGACY_TAB_MAP: Record<string, ContentHubTabId> = {
  home: 'studio',
  standard: 'compose',
  wizard: 'compose',
  rss: 'automation',
  batch: 'automation',
  grok: 'media',
  thumbnails: 'media',
  repurpose: 'tools',
  qa: 'tools',
  comments: 'tools',
  utilities: 'tools',
  analytics: 'insights',
};

export const CONTENT_HUB_FOCUS_TABS = ['studio', 'queue', 'compose'];
export const CONTENT_HUB_COLLAPSE_GROUPS = ['Advanced', 'Pipeline'];

/** Settings — 13 tabs → 8 */
export const SETTINGS_TABS = [
  { id: 'overview', label: 'Overview', group: "Today's Focus", locked: true },
  { id: 'campaigns', label: 'Campaigns', group: "Today's Focus" },
  { id: 'api-keys', label: 'API Keys', group: "Today's Focus" },
  { id: 'guardian-api', label: 'Guardian & API', group: "Today's Focus" },
  { id: 'billing', label: 'Billing', group: 'Account' },
  { id: 'strategy', label: 'Strategy & Traffic', group: 'Advanced' },
  { id: 'connect', label: 'Probes & Browser', group: 'Advanced' },
  { id: 'system', label: 'System', group: 'Advanced' },
] as const;

export type SettingsTabId = (typeof SETTINGS_TABS)[number]['id'];

export const SETTINGS_LEGACY_TAB_MAP: Record<string, SettingsTabId> = {
  playbooks: 'strategy',
  'site-health': 'strategy',
  'account-intelligence': 'strategy',
  'live-probes': 'connect',
  grok: 'connect',
  tutorials: 'system',
  health: 'system',
};

export const SETTINGS_FOCUS_TABS = ['overview', 'campaigns', 'api-keys', 'guardian-api'];
export const SETTINGS_COLLAPSE_GROUPS = ['Advanced'];

/** Integrations — 6 tabs → 4 */
export const INTEGRATIONS_TABS = [
  { id: 'connections', label: 'Connections', group: "Today's Focus", locked: true },
  { id: 'probes', label: 'Live Probes', group: "Today's Focus" },
  { id: 'email-campaigns', label: 'Email Campaigns', group: 'Outreach' },
  { id: 'partner', label: 'Partner & Webhooks', group: 'Advanced' },
] as const;

export type IntegrationsTabId = (typeof INTEGRATIONS_TABS)[number]['id'];

export const INTEGRATIONS_LEGACY_TAB_MAP: Record<string, IntegrationsTabId> = {
  'partner-api': 'partner',
  webhooks: 'partner',
  connectors: 'partner',
};

export const INTEGRATIONS_FOCUS_TABS = ['connections', 'probes', 'email-campaigns'];
export const INTEGRATIONS_COLLAPSE_GROUPS = ['Advanced'];

/** Dashboard — merge Q&A into Growth */
export const DASHBOARD_TABS = [
  { id: 'overview', label: 'Overview', group: "Today's Focus", locked: true },
  { id: 'feed', label: 'Live Feed', group: "Today's Focus" },
  { id: 'growth', label: 'Growth & Q&A', group: "Today's Focus" },
  { id: 'worker', label: 'Worker', group: 'Advanced' },
  { id: 'analytics', label: 'Analytics', group: 'Advanced' },
] as const;

export const DASHBOARD_LEGACY_TAB_MAP: Record<string, string> = {
  qa: 'growth',
  users: 'users',
  admin: 'admin',
};
export const DASHBOARD_FOCUS_TABS = ['overview', 'feed', 'growth'];
export const DASHBOARD_COLLAPSE_GROUPS = ['Advanced'];

/** Tabs that live on dedicated routes — not rendered inside /dashboard */
export const DASHBOARD_SILOED_TAB_ROUTES: Record<string, string> = {
  users: '/dashboard/users',
  admin: '/dashboard/admin',
};

/** Browse Posts — drop redundant Intelligence tab (lives in Discover) */
export const BROWSE_VIEW_TABS = [
  { id: 'discover', label: 'Discover', group: "Today's Focus", locked: true },
  { id: 'engage', label: 'Draft & Engage', group: "Today's Focus" },
  { id: 'monitors', label: 'Monitors', group: 'Watch' },
] as const;

export const BROWSE_LEGACY_TAB_MAP: Record<string, string> = { intelligence: 'discover' };

/** AI Replies — drop Insights (charts always visible) */
export const HISTORY_VIEW_TABS = [
  { id: 'pending', label: 'Pending Review', group: "Today's Focus", locked: true },
  { id: 'published', label: 'Published', group: "Today's Focus" },
  { id: 'archive', label: 'All Replies', group: 'Browse' },
] as const;

export const HISTORY_LEGACY_TAB_MAP: Record<string, string> = {
  all: 'archive',
  insights: 'archive',
};

/** Content Library — dynamic: only show tabs that matter */
export function buildContentLibraryTabs(counts: {
  total: number;
  studied: number;
  copy: number;
}): TabCatalogItem[] {
  const tabs: TabCatalogItem[] = [
    { id: 'all', label: `All (${counts.total})`, locked: true },
  ];
  if (counts.studied > 0) {
    tabs.push({ id: 'format-intel', label: `Studied (${counts.studied})` });
  }
  if (counts.copy > 0) {
    tabs.push({ id: 'copy', label: `Copy (${counts.copy})` });
  }
  return tabs;
}

export type LibraryAssetCounts = { total: number; studied: number; copy: number };

export function libraryAssetCounts(assets: Array<{
  type?: string;
  imageAnalysis?: unknown;
  formatTemplateId?: string;
}>): LibraryAssetCounts {
  return {
    total: assets.length,
    studied: assets.filter((a) => !!(a.imageAnalysis || a.formatTemplateId)).length,
    copy: assets.filter((a) => a.type === 'copy' || a.type === 'text').length,
  };
}