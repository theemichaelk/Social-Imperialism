/**
 * THEE_MICHAEL — client-side guide action executor.
 * Runs structured actions from /api/guide/actions/plan or admin remote poll.
 */

import { apiFetch } from '@/lib/api';
import {
  dispatchBrainToast,
  dispatchHighlightNav,
  executeLiveSupportAction,
  type LiveSupportAction,
} from '@/lib/liveSupportActions';
import {
  dispatchScreenFlash,
  pushTrace,
  completeTrace,
  failTrace,
} from '@/lib/theeMichaelOverlord';
import {
  defaultLayout,
  loadTabLayout,
  saveTabLayout,
  type TabCatalogItem,
} from '@/lib/manageableTabs';

export const SI_GUIDE_SELECT_TAB = 'si-guide-select-tab';
export const SI_GUIDE_RESTORE_TABS = 'si-guide-restore-tabs';
export const SI_GUIDE_EXPAND_GROUPS = 'si-guide-expand-groups';
export const SI_GUIDE_EXPAND_SIDEBAR = 'si-guide-expand-sidebar';
export const SI_SIMPLE_MODE_KEY = 'si_simple_mode';

export type GuideAction =
  | { type: 'navigate'; href: string; label?: string; navId?: string; sectionId?: string; tab?: string }
  | { type: 'open_url'; url: string; target?: '_blank' | '_self' }
  | { type: 'disable_simple_mode' }
  | { type: 'enable_simple_mode' }
  | { type: 'expand_advanced_rail'; pageId?: string | null }
  | { type: 'restore_hidden_tabs'; pageId: string; tabIds?: string[] }
  | { type: 'select_tab'; pageId: string; tabId: string }
  | { type: 'highlight'; selector?: string; navId?: string; sectionId?: string; ms?: number }
  | { type: 'expand_sidebar_section'; sectionId: string }
  | { type: 'flash_screen' }
  | { type: 'message'; text: string }
  | { type: 'wait'; ms: number };

export function isSimpleMode(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return localStorage.getItem(SI_SIMPLE_MODE_KEY) !== '0';
  } catch {
    return true;
  }
}

export function setSimpleMode(enabled: boolean) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(SI_SIMPLE_MODE_KEY, enabled ? '1' : '0');
    window.dispatchEvent(new CustomEvent('si-simple-mode-changed', { detail: { enabled } }));
  } catch { /* ignore */ }
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function highlightSelector(selector?: string, ms = 3500) {
  if (!selector) return;
  const el = document.querySelector(selector);
  if (!el) return;
  el.classList.add('overlord-ui-highlight');
  setTimeout(() => el.classList.remove('overlord-ui-highlight'), ms);
}

function restoreHiddenTabs(pageId: string, tabIds?: string[]) {
  window.dispatchEvent(new CustomEvent(SI_GUIDE_RESTORE_TABS, { detail: { pageId, tabIds } }));
}

function expandAdvancedRail(pageId?: string | null) {
  window.dispatchEvent(new CustomEvent(SI_GUIDE_EXPAND_GROUPS, { detail: { pageId, expandAll: !pageId } }));
}

async function runAction(action: GuideAction): Promise<void> {
  switch (action.type) {
    case 'message':
      dispatchBrainToast(action.text);
      pushTrace(action.text);
      break;
    case 'wait':
      await sleep(action.ms);
      break;
    case 'disable_simple_mode':
      setSimpleMode(false);
      expandAdvancedRail(null);
      window.dispatchEvent(new CustomEvent(SI_GUIDE_EXPAND_SIDEBAR, { detail: { expandAll: true } }));
      pushTrace('Simple mode disabled — advanced rail expanded');
      break;
    case 'enable_simple_mode':
      setSimpleMode(true);
      pushTrace('Simple mode enabled');
      break;
    case 'expand_advanced_rail':
      expandAdvancedRail(action.pageId);
      break;
    case 'restore_hidden_tabs':
      restoreHiddenTabs(action.pageId, action.tabIds);
      break;
    case 'select_tab': {
      const PAGE_PATHS: Record<string, string> = {
        'content-hub': '/content-hub',
        integrations: '/integrations',
        settings: '/settings',
        history: '/history',
        'browse-posts': '/browse-posts',
        dashboard: '/dashboard',
      };
      const path = PAGE_PATHS[action.pageId];
      if (path) {
        executeLiveSupportAction({
          type: 'navigate',
          label: action.tabId,
          href: `${path}?tab=${encodeURIComponent(action.tabId)}`,
          tab: action.tabId,
          autoExecute: true,
        });
      }
      window.dispatchEvent(new CustomEvent(SI_GUIDE_SELECT_TAB, { detail: { pageId: action.pageId, tabId: action.tabId } }));
      break;
    }
    case 'expand_sidebar_section':
      window.dispatchEvent(new CustomEvent(SI_GUIDE_EXPAND_SIDEBAR, { detail: { sectionId: action.sectionId } }));
      break;
    case 'navigate': {
      const live: LiveSupportAction = {
        type: 'navigate',
        label: action.label || action.href,
        href: action.href,
        tab: action.tab,
        navId: action.navId,
        sectionId: action.sectionId,
        autoExecute: true,
        message: action.label ? `Taking you to ${action.label}…` : undefined,
      };
      executeLiveSupportAction(live);
      break;
    }
    case 'open_url':
      if (action.target === '_self') window.location.assign(action.url);
      else window.open(action.url, '_blank', 'noopener,noreferrer');
      dispatchBrainToast(`Opened ${action.url}`);
      break;
    case 'highlight':
      if (action.navId) dispatchHighlightNav(action.navId, action.sectionId, action.ms);
      if (action.selector) highlightSelector(action.selector, action.ms);
      break;
    case 'flash_screen':
      dispatchScreenFlash();
      break;
    default:
      break;
  }
}

export async function executeGuideActions(actions: GuideAction[]): Promise<void> {
  const traceId = pushTrace(`Executing ${actions.length} live action(s)`);
  try {
    for (const action of actions) {
      await runAction(action);
      if (action.type !== 'wait') await sleep(80);
    }
    completeTrace(traceId);
  } catch (e) {
    failTrace(traceId, (e as Error).message);
    throw e;
  }
}

export async function planGuideActions(query: string, pathname?: string): Promise<{ actions: GuideAction[]; reply: string }> {
  const res = await apiFetch('/api/guide/actions/plan', {
    method: 'POST',
    body: JSON.stringify({ query, pathname }),
  }) as { actions?: GuideAction[]; reply?: string };
  return {
    actions: res.actions || [],
    reply: res.reply || '',
  };
}

export async function pollRemoteGuideActions(): Promise<{ pending: boolean; actions: GuideAction[]; reply: string | null }> {
  const res = await apiFetch('/api/guide/remote/poll') as {
    pending?: boolean;
    actions?: GuideAction[];
    reply?: string | null;
  };
  return {
    pending: !!res.pending,
    actions: res.actions || [],
    reply: res.reply ?? null,
  };
}

/** Utility for ManageableTabNav — restore tabs from local layout storage */
export function applyGuideTabRestore(pageId: string, catalog: TabCatalogItem[], tabIds?: string[]) {
  const layout = loadTabLayout(pageId, catalog);
  const idsToRestore = tabIds?.length
    ? tabIds
    : catalog.filter((t) => layout.hidden.includes(t.id)).map((t) => t.id);
  if (!idsToRestore.length && !tabIds?.length) {
    const next = defaultLayout(catalog);
    saveTabLayout(pageId, next);
    return next;
  }
  const next = {
    ...layout,
    hidden: layout.hidden.filter((id) => !idsToRestore.includes(id)),
    collapsedGroups: layout.collapsedGroups.filter((g) => g !== 'Advanced' && g !== 'Pipeline' && g !== 'Partner'),
    order: [...layout.order],
  };
  for (const id of idsToRestore) {
    if (!next.order.includes(id)) next.order.push(id);
  }
  saveTabLayout(pageId, next);
  return next;
}