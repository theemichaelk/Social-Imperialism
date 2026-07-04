/**
 * THEE_MICHAEL notification ledger — suppress repeats, document actions, resume flows.
 */

import type { LiveSupportAction } from '@/lib/liveSupportActions';
import type { OverlordIntervention } from '@/lib/theeMichaelOverlord';

export const SI_NOTIFICATION_CHANGED = 'si-thee-michael-notification-changed';

const LEDGER_KEY = 'si_thee_michael_notification_ledger';
const DISMISS_KEY = 'si_overlord_dismissed';
const MAX_ENTRIES = 80;


export type NotificationResolution = 'acted' | 'dismissed' | 'approved' | 'denied' | 'routed' | 'auto_resolved';

export type NotificationLedgerEntry = {
  id: string;
  source: 'intervention' | 'approval';
  dismissKey: string;
  title: string;
  body?: string;
  kind?: string;
  status: NotificationResolution;
  actionLabel?: string;
  resumeHref?: string;
  resumeAction?: LiveSupportAction;
  resolutionNote?: string;
  createdAt: string;
  resolvedAt: string;
  snoozeUntil?: string;
  canResume: boolean;
};

function readLedger(): NotificationLedgerEntry[] {
  if (typeof window === 'undefined') return [];
  try {
    return JSON.parse(localStorage.getItem(LEDGER_KEY) || '[]') as NotificationLedgerEntry[];
  } catch {
    return [];
  }
}

function writeLedger(entries: NotificationLedgerEntry[]) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(LEDGER_KEY, JSON.stringify(entries.slice(0, MAX_ENTRIES)));
  } catch { /* ignore */ }
}

function readDismissKeys(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    return JSON.parse(localStorage.getItem(DISMISS_KEY) || '[]') as string[];
  } catch {
    return [];
  }
}

function writeDismissKeys(keys: string[]) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(DISMISS_KEY, JSON.stringify(keys));
  } catch { /* ignore */ }
}

export function emitNotificationChanged() {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(SI_NOTIFICATION_CHANGED));
}

export function suppressNotificationKey(dismissKey: string) {
  if (!dismissKey) return;
  const keys = readDismissKeys();
  if (!keys.includes(dismissKey)) {
    keys.push(dismissKey);
    writeDismissKeys(keys);
    emitNotificationChanged();
  }
}

export function interventionDismissKey(int: Pick<OverlordIntervention, 'dismissKey' | 'id'>): string {
  return int.dismissKey || int.id;
}

export function isNotificationSuppressed(dismissKey: string): boolean {
  if (!dismissKey) return false;
  if (readDismissKeys().includes(dismissKey)) return true;
  const entry = readLedger().find((e) => e.dismissKey === dismissKey);
  if (!entry) return false;
  return entry.status === 'acted' || entry.status === 'dismissed' || entry.status === 'approved'
    || entry.status === 'denied' || entry.status === 'auto_resolved';
}

export function recordInterventionResolution(
  int: OverlordIntervention,
  status: NotificationResolution,
  note?: string,
): NotificationLedgerEntry {
  const dismissKey = interventionDismissKey(int);
  const keys = readDismissKeys();
  if (!keys.includes(dismissKey)) {
    keys.push(dismissKey);
    writeDismissKeys(keys);
  }

  const resumeHref = int.action?.href || int.href;
  const entry: NotificationLedgerEntry = {
    id: `nle_${Date.now()}_${dismissKey}`,
    source: 'intervention',
    dismissKey,
    title: int.title,
    body: int.body,
    kind: int.kind,
    status,
    actionLabel: int.actionLabel,
    resumeHref,
    resumeAction: int.action,
    resolutionNote: note,
    createdAt: int.createdAt || new Date().toISOString(),
    resolvedAt: new Date().toISOString(),
    canResume: status === 'acted' && !!(resumeHref || int.action),
  };

  const ledger = readLedger().filter((e) => e.dismissKey !== dismissKey || e.status !== status);
  ledger.unshift(entry);
  writeLedger(ledger);
  emitNotificationChanged();
  return entry;
}

export function recordApprovalResolution(
  dismissKey: string,
  title: string,
  status: NotificationResolution,
  meta?: { body?: string; resumeHref?: string; note?: string },
): NotificationLedgerEntry {
  const keys = readDismissKeys();
  if (!keys.includes(dismissKey)) {
    keys.push(dismissKey);
    writeDismissKeys(keys);
  }

  const entry: NotificationLedgerEntry = {
    id: `nle_apr_${Date.now()}`,
    source: 'approval',
    dismissKey,
    title,
    body: meta?.body,
    status,
    resumeHref: meta?.resumeHref,
    resolutionNote: meta?.note,
    createdAt: new Date().toISOString(),
    resolvedAt: new Date().toISOString(),
    canResume: status === 'routed' && !!meta?.resumeHref,
  };

  const ledger = readLedger();
  ledger.unshift(entry);
  writeLedger(ledger);
  emitNotificationChanged();
  return entry;
}

export function resolveInterventionsForHref(href: string) {
  const path = href.split('?')[0];
  const tab = new URLSearchParams(href.split('?')[1] || '').get('tab');
  const ledger = readLedger();
  let changed = false;

  const next = ledger.map((entry) => {
    if (!entry.canResume || !entry.resumeHref) return entry;
    const entryPath = entry.resumeHref.split('?')[0];
    const entryTab = new URLSearchParams(entry.resumeHref.split('?')[1] || '').get('tab');
    if (entryPath !== path) return entry;
    if (entryTab && tab && entryTab !== tab) return entry;
    changed = true;
    return {
      ...entry,
      canResume: false,
      status: 'auto_resolved' as NotificationResolution,
      resolutionNote: `${entry.resolutionNote || ''} · Visited ${href}`.trim(),
      resolvedAt: new Date().toISOString(),
    };
  });

  if (changed) {
    writeLedger(next);
    emitNotificationChanged();
  }
}

export function getNotificationHistory(limit = 20): NotificationLedgerEntry[] {
  return readLedger().slice(0, limit);
}

export function getResumableNotifications(): NotificationLedgerEntry[] {
  return readLedger().filter((e) => e.canResume && e.resumeHref);
}

export function markNotificationResumed(entryId: string) {
  const ledger = readLedger();
  const idx = ledger.findIndex((e) => e.id === entryId);
  if (idx < 0) return;
  ledger[idx] = { ...ledger[idx], canResume: false, resolutionNote: `${ledger[idx].resolutionNote || ''} · Resumed`.trim() };
  writeLedger(ledger);
  emitNotificationChanged();
}

export function clearDismissedInterventionKey(dismissKey: string) {
  writeDismissKeys(readDismissKeys().filter((k) => k !== dismissKey));
  emitNotificationChanged();
}