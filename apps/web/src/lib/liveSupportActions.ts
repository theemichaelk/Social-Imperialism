/**
 * Imperialism Brain — live browser actions (navigate, tab switch, audit, highlight).
 * Used by LiveSupportPanel, ImperialismBrainPromptBar, and BrainNavigatorHost.
 */

import { invoke } from '@/lib/api';
import { resolveInterventionsForHref } from '@/lib/theeMichaelNotificationLedger';
import { NAV_SECTIONS } from '@/lib/nav';
import { PAGE_FOCUS } from '@/lib/pageFocus';
import { SEARCH_ROUTES, type SearchRoute } from '@/lib/liveSupportAgent';
import { isMasteryRequest } from '@/lib/theeMichaelMasteryExpert';
import { runSelfHealAudit } from '@/lib/selfHealIntelligence';

function resolveSearchRoute(query: string): SearchRoute | null {
  const q = query.trim();
  if (!q) return null;
  for (const entry of SEARCH_ROUTES) {
    if (entry.patterns.some((p) => p.test(q))) return entry.route;
  }
  return null;
}

export const SI_BRAIN_NAVIGATE = 'si-brain-navigate';
export const SI_BRAIN_HIGHLIGHT_NAV = 'si-brain-highlight-nav';
export const SI_BRAIN_TOAST = 'si-brain-toast';

export type LiveSupportActionType = 'navigate' | 'refresh' | 'audit' | 'highlight';

export type LiveSupportAction = {
  type: LiveSupportActionType;
  label: string;
  href: string;
  tab?: string;
  navId?: string;
  sectionId?: string;
  autoExecute?: boolean;
  message?: string;
};

export type BrainNavigateDetail = {
  href: string;
  label: string;
  tab?: string;
  navId?: string;
  sectionId?: string;
  highlightMs?: number;
};

type NavEntry = {
  id: string;
  label: string;
  href: string;
  sectionId: string;
  sectionLabel: string;
  aliases: string[];
  tab?: string;
};

const NAVIGATION_VERBS =
  /(?:take\s+me\s+to|go\s+to|open(?:\s+up)?|show\s+me|navigate\s+to|bring\s+me\s+to|jump\s+to|switch\s+to|where\s+is|where'?s|can\s+you\s+(?:take|bring|show)|i\s+(?:can'?t|don'?t)\s+(?:find|see|locate)|left\s+(?:side(?:bar)?|nav(?:igation)?|menu|panel)|sidebar|tab\s+on\s+the\s+left|in\s+the\s+(?:left\s+)?(?:nav|menu|sidebar))/i;

const CANT_FIND_NAV_RE =
  /don'?t\s+see|can'?t\s+find|where\s+is|where'?s|left\s+(?:side|sidebar|nav|menu)|hidden\s+tab|focus\s+mode|collapsed/i;

/** Strip decorative trailing ellipsis from planner placeholders and chips. */
export function normalizeBrainQuery(query: string): string {
  return String(query || '')
    .trim()
    .replace(/[\u2026]+$/g, '')
    .replace(/\.{2,}$/g, '')
    .trim();
}

export function isCantFindNavigation(query: string): boolean {
  return CANT_FIND_NAV_RE.test(normalizeBrainQuery(query));
}

const ADMIN_ACTION_PATTERNS: Array<{ patterns: RegExp[]; action: LiveSupportAction }> = [
  {
    patterns: [/\brun\s+audit\b/i, /\baudit\s+(the\s+)?(app|site|issues)\b/i, /\bissue\s+control\b/i],
    action: { type: 'audit', label: 'Issue Control', href: '/dashboard/issues', navId: 'dashboard-issues', sectionId: 'system', autoExecute: true },
  },
  {
    patterns: [/\brefresh\s+probes?\b/i, /\brun\s+probes?\b/i, /\blive\s+probes?\b/i],
    action: { type: 'navigate', label: 'Live Probes', href: '/integrations?tab=probes', tab: 'probes', navId: 'integrations', sectionId: 'system', autoExecute: true },
  },
  {
    patterns: [/\bcheck\s+health\b/i, /\bpage\s+health\b/i, /\bsystem\s+health\b/i],
    action: { type: 'refresh', label: 'Mission Control', href: '/dashboard', navId: 'dashboard', sectionId: 'mission', autoExecute: true, message: 'Refreshing Mission Control health…' },
  },
  {
    patterns: [/\badmin\s+directory\b/i, /\ball\s+users\b/i, /\buser\s+directory\b/i],
    action: { type: 'navigate', label: 'Admin Directory', href: '/dashboard/admin', navId: 'dashboard-admin', sectionId: 'system', autoExecute: true },
  },
];

const TAB_ALIASES: Record<string, { path: string; tab: string; label: string }> = {
  billing: { path: '/settings', tab: 'billing', label: 'Billing' },
  'api keys': { path: '/settings', tab: 'api-keys', label: 'API Keys' },
  'api-keys': { path: '/settings', tab: 'api-keys', label: 'API Keys' },
  guardian: { path: '/settings', tab: 'guardian-api', label: 'Guardian & API' },
  'guardian-api': { path: '/settings', tab: 'guardian-api', label: 'Guardian & API' },
  connections: { path: '/integrations', tab: 'connections', label: 'Connections' },
  probes: { path: '/integrations', tab: 'probes', label: 'Live Probes' },
  studio: { path: '/content-hub', tab: 'studio', label: 'Generate' },
  queue: { path: '/content-hub', tab: 'queue', label: 'Review Queue' },
  compose: { path: '/content-hub', tab: 'compose', label: 'Compose & Publish' },
  pending: { path: '/history', tab: 'pending', label: 'Pending Review' },
  nodes: { path: '/campaign-manager', tab: 'nodes', label: 'Verified Nodes' },
  campaigns: { path: '/settings', tab: 'campaigns', label: 'Campaigns' },
  overview: { path: '/dashboard', tab: 'overview', label: 'Overview' },
  feed: { path: '/dashboard', tab: 'feed', label: 'Live Feed' },
  growth: { path: '/dashboard', tab: 'growth', label: 'Growth & Q&A' },
  leads: { path: '/dashboard', tab: 'growth', label: 'Leads' },
};

function buildNavCatalog(): NavEntry[] {
  const entries: NavEntry[] = [];

  for (const section of NAV_SECTIONS) {
    for (const item of section.items) {
      const focus = PAGE_FOCUS[item.href];
      const aliases = [
        item.label.toLowerCase(),
        item.id.replace(/-/g, ' '),
        section.label.toLowerCase(),
        focus?.title.toLowerCase() || '',
      ].filter(Boolean);

      entries.push({
        id: item.id,
        label: item.label,
        href: item.href,
        sectionId: section.id,
        sectionLabel: section.label,
        aliases,
      });

      if (focus?.actions) {
        for (const act of focus.actions) {
          if (act.tab && act.href?.startsWith(item.href)) {
            const key = act.tab.toLowerCase();
            if (!TAB_ALIASES[key]) {
              TAB_ALIASES[key] = { path: item.href, tab: act.tab, label: act.label };
            }
          }
        }
      }
    }
  }

  type ExtraAlias = { match: string[]; entry: Partial<NavEntry> & { href: string; label: string } };
  const extraAliases: ExtraAlias[] = [
    { match: ['mission control', 'live feed', 'home dashboard', 'open mission control'], entry: { id: 'dashboard', label: 'Mission Control', href: '/dashboard', sectionId: 'mission' } },
    { match: ['content hub', 'create content', 'create post', 'content studio'], entry: { id: 'content-hub', label: 'Create', href: '/content-hub', sectionId: 'create' } },
    { match: ['integrations hub', 'api connection', 'api keys'], entry: { id: 'integrations', label: 'Integrations', href: '/integrations', sectionId: 'system' } },
    { match: ['connect platform', 'connect a platform', 'oauth', 'link account', 'account hub'], entry: { id: 'account-hub', label: 'Account Hub', href: '/account-hub', sectionId: 'accounts' } },
    { match: ['ai replies', 'reply engine', 'engagement queue', 'pending replies'], entry: { id: 'history', label: 'AI Replies', href: '/history', sectionId: 'discovery' } },
    { match: ['setup wizard', 'onboarding', 'go live checklist', 'research my brand', 'auto-fill brand', 'intelligent setup'], entry: { id: 'onboarding', label: 'Setup Wizard', href: '/onboarding', sectionId: 'create' } },
    { match: ['growth lab', 'reddit lab', 'reddit ai', 'reddit growth strategist', 'reddit strategist'], entry: { id: 'reddit-ai', label: 'Growth Lab', href: '/reddit-ai', sectionId: 'labs' } },
    { match: ['auto rules', 'auto-rules', 'keyword triggers'], entry: { id: 'rules', label: 'Auto-Rules', href: '/rules', sectionId: 'automation' } },
    { match: ['campaign command', 'campaign manager', 'verified nodes'], entry: { id: 'campaign-manager', label: 'Campaign Manager', href: '/campaign-manager', sectionId: 'system' } },
    { match: ['imperialism brain', 'live support', 'help chat'], entry: { id: 'support', label: 'Imperialism Brain', href: '/support', sectionId: 'system' } },
    { match: ['download app', 'desktop app', 'windows installer'], entry: { id: 'download', label: 'Download Desktop App', href: '/download', sectionId: 'system' } },
    { match: ['my account', 'account settings', 'profile'], entry: { id: 'dashboard-users', label: 'My Account', href: '/dashboard/users', sectionId: 'system' } },
    { match: ['thee_michael', 'issue control', 'gitops'], entry: { id: 'dashboard-issues', label: 'Issue Control', href: '/dashboard/issues', sectionId: 'system' } },
  ];

  for (const extra of extraAliases) {
    const existing = entries.find((e) => e.href === extra.entry.href);
    if (existing) {
      existing.aliases.push(...extra.match);
    } else {
      entries.push({
        id: extra.entry.id || extra.entry.href.replace(/\//g, ''),
        label: extra.entry.label,
        href: extra.entry.href,
        sectionId: extra.entry.sectionId || 'system',
        sectionLabel: '',
        aliases: extra.match,
      });
    }
  }

  return entries;
}

const NAV_CATALOG = buildNavCatalog();

export function buildActionHref(path: string, tab?: string): string {
  const base = path.split('?')[0];
  if (!tab) return path;
  const params = new URLSearchParams(path.includes('?') ? path.split('?')[1] : '');
  params.set('tab', tab);
  return `${base}?${params.toString()}`;
}

export function isNavigationRequest(query: string): boolean {
  const q = normalizeBrainQuery(query);
  if (!q) return false;
  if (NAVIGATION_VERBS.test(q)) return true;
  if (/^(open|show|go)\s+\w/i.test(q)) return true;
  return false;
}

function scoreNavMatch(query: string, entry: NavEntry): number {
  const q = query.toLowerCase().replace(/[^\w\s/-]/g, ' ');
  let best = 0;

  for (const alias of entry.aliases) {
    if (!alias) continue;
    if (q.includes(alias)) best = Math.max(best, alias.length + 10);
    const words = alias.split(/\s+/).filter((w) => w.length > 2);
    const hits = words.filter((w) => q.includes(w)).length;
    if (hits > 0) best = Math.max(best, hits * 4);
  }

  if (q.includes(entry.label.toLowerCase())) best = Math.max(best, entry.label.length + 15);
  if (q.includes(entry.id.replace(/-/g, ' '))) best = Math.max(best, 12);

  return best;
}

function resolveTabIntent(query: string): { path: string; tab: string; label: string } | null {
  const q = query.toLowerCase();
  for (const [key, val] of Object.entries(TAB_ALIASES)) {
    if (q.includes(key)) return val;
  }
  const tabMatch = q.match(/\b([\w-]+)\s+tab\b/) || q.match(/\btab\s+([\w-]+)\b/);
  if (tabMatch) {
    const key = tabMatch[1].toLowerCase();
    if (TAB_ALIASES[key]) return TAB_ALIASES[key];
  }
  return null;
}

export function resolveNavigationIntent(
  query: string,
  context?: { pathname?: string; preferExecute?: boolean },
): LiveSupportAction | null {
  const q = normalizeBrainQuery(query);
  if (!q) return null;

  for (const entry of ADMIN_ACTION_PATTERNS) {
    if (entry.patterns.some((p) => p.test(q))) {
      return { ...entry.action, autoExecute: context?.preferExecute !== false };
    }
  }

  const legacyRoute = resolveSearchRoute(q);
  const wantsNav = isNavigationRequest(q) || context?.preferExecute;

  const tabIntent = resolveTabIntent(q);
  if (tabIntent && (wantsNav || legacyRoute)) {
    const navItem = NAV_CATALOG.find((e) => e.href === tabIntent.path);
    return {
      type: 'navigate',
      label: tabIntent.label,
      href: buildActionHref(tabIntent.path, tabIntent.tab),
      tab: tabIntent.tab,
      navId: navItem?.id,
      sectionId: navItem?.sectionId,
      autoExecute: wantsNav,
      message: `Opening ${tabIntent.label}…`,
    };
  }

  let best: { entry: NavEntry; score: number } | null = null;
  for (const entry of NAV_CATALOG) {
    const score = scoreNavMatch(q, entry);
    if (score > 0 && (!best || score > best.score)) best = { entry, score };
  }

  if (best && best.score >= 8) {
    const tab = entryTabFromQuery(q, best.entry.href);
    return {
      type: 'navigate',
      label: best.entry.label,
      href: buildActionHref(best.entry.href, tab),
      tab,
      navId: best.entry.id,
      sectionId: best.entry.sectionId,
      autoExecute: wantsNav,
      message: `Taking you to ${best.entry.label}…`,
    };
  }

  if (legacyRoute && wantsNav) {
    if (legacyRoute.action === 'campaign-mastery' || legacyRoute.action === 'research-brand' || isMasteryRequest(q)) {
      return null;
    }
    const path = legacyRoute.href.split('?')[0];
    const tab = new URLSearchParams(legacyRoute.href.split('?')[1] || '').get('tab') || undefined;
    const navItem = NAV_CATALOG.find((e) => e.href === path || legacyRoute.href.startsWith(e.href));
    return {
      type: 'navigate',
      label: legacyRoute.label,
      href: legacyRoute.href,
      tab: tab || undefined,
      navId: navItem?.id,
      sectionId: navItem?.sectionId,
      autoExecute: true,
      message: `Taking you to ${legacyRoute.label}…`,
    };
  }

  if (context?.pathname && /left|sidebar|tab|don'?t\s+see|can'?t\s+find/i.test(q)) {
    const focus = PAGE_FOCUS[context.pathname.replace(/\/+$/, '') || '/'];
    if (focus?.actions?.length) {
      const primary = focus.actions.find((a) => a.primary) || focus.actions[0];
      if (primary.href) {
        const tab = primary.tab || new URLSearchParams((primary.href.split('?')[1]) || '').get('tab') || undefined;
        const href = primary.tab && !primary.href.includes('tab=')
          ? buildActionHref(context.pathname, primary.tab)
          : primary.href;
        const navItem = NAV_CATALOG.find((e) => e.href === context.pathname);
        return {
          type: 'navigate',
          label: primary.label,
          href,
          tab,
          navId: navItem?.id,
          sectionId: navItem?.sectionId,
          autoExecute: true,
          message: `Opening ${primary.label} on this page…`,
        };
      }
      if (primary.tab) {
        const navItem = NAV_CATALOG.find((e) => e.href === context.pathname);
        return {
          type: 'navigate',
          label: primary.label,
          href: buildActionHref(context.pathname, primary.tab),
          tab: primary.tab,
          navId: navItem?.id,
          sectionId: navItem?.sectionId,
          autoExecute: true,
          message: `Switching to ${primary.label} tab…`,
        };
      }
    }
  }

  return null;
}

function entryTabFromQuery(query: string, href: string): string | undefined {
  const tabIntent = resolveTabIntent(query);
  if (tabIntent && tabIntent.path === href) return tabIntent.tab;
  const focus = PAGE_FOCUS[href];
  if (!focus?.actions) return undefined;
  const q = query.toLowerCase();
  for (const act of focus.actions) {
    if (act.tab && q.includes(act.label.toLowerCase())) return act.tab;
  }
  return undefined;
}

/** Agent may emit [[NAV:/path?tab=x|Label]] in replies for live redirect. */
export function parseAgentNavigateDirective(text: string): LiveSupportAction | null {
  const match = text.match(/\[\[NAV:([^|\]]+)(?:\|([^\]]+))?\]\]/i);
  if (!match) return null;
  const href = match[1].trim();
  const label = (match[2] || '').trim() || href;
  const path = href.split('?')[0];
  const tab = new URLSearchParams(href.split('?')[1] || '').get('tab') || undefined;
  const navItem = NAV_CATALOG.find((e) => e.href === path);
  return {
    type: 'navigate',
    label,
    href,
    tab,
    navId: navItem?.id,
    sectionId: navItem?.sectionId,
    autoExecute: true,
    message: `Taking you to ${label}…`,
  };
}

export function stripNavigateDirectives(text: string): string {
  return text.replace(/\[\[NAV:[^\]]+\]\]/gi, '').trim();
}

export function dispatchBrainNavigate(detail: BrainNavigateDetail) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(SI_BRAIN_NAVIGATE, { detail }));
}

export function dispatchBrainToast(message: string) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(SI_BRAIN_TOAST, { detail: { message } }));
}

export function dispatchHighlightNav(navId: string, sectionId?: string, ms = 3200) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(SI_BRAIN_HIGHLIGHT_NAV, { detail: { navId, sectionId, ms } }));
}

/** User-facing sidebar label (never "Live Support" — use Imperialism Brain). */
export function displayNavLabel(action: Pick<LiveSupportAction, 'label' | 'href' | 'navId'>): string {
  const path = action.href?.split('?')[0];
  if (path === '/support' || action.navId === 'support') return 'Imperialism Brain';
  if (/live\s+support/i.test(action.label)) return 'Imperialism Brain';
  return action.label;
}

async function runLivePlatformAudit(action: LiveSupportAction): Promise<void> {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent('si-brain-refresh-health'));
  try {
    await invoke('get-page-health');
    if (action.href?.includes('/dashboard/issues')) {
      await invoke('run-guardian-scan').catch(() => null);
    } else if (action.href?.includes('/integrations')) {
      await invoke('run-live-connection-audit').catch(() => invoke('test-all-connections'));
    }
    await runSelfHealAudit();
  } catch { /* ignore */ }
}

export function executeLiveSupportAction(action: LiveSupportAction): boolean {
  if (!action.autoExecute && action.type === 'navigate') return false;

  if (action.type === 'refresh') {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('si-brain-refresh-health'));
    }
  }

  if (action.type === 'audit') {
    void runLivePlatformAudit(action);
  }

  const detail: BrainNavigateDetail = {
    href: action.href,
    label: action.label,
    tab: action.tab,
    navId: action.navId,
    sectionId: action.sectionId,
  };

  if (action.message) dispatchBrainToast(action.message);
  dispatchBrainNavigate(detail);

  if (action.navId) dispatchHighlightNav(action.navId, action.sectionId);

  resolveInterventionsForHref(action.href);

  return true;
}

export function searchRouteToAction(route: SearchRoute, autoExecute = true): LiveSupportAction {
  const path = route.href.split('?')[0];
  const tab = new URLSearchParams(route.href.split('?')[1] || '').get('tab') || undefined;
  const navItem = NAV_CATALOG.find((e) => e.href === path);
  return {
    type: 'navigate',
    label: route.label,
    href: route.href,
    tab: tab || undefined,
    navId: navItem?.id,
    sectionId: navItem?.sectionId,
    autoExecute,
    message: `Taking you to ${route.label}…`,
  };
}