import { invoke } from '@/lib/api';

/**
 * Open a full browser tab (not a narrow popup) so the user signs in
 * in their normal browser window / default tab UI.
 */
export function openBrowserTab(url: string) {
  if (typeof window === 'undefined' || !url) return null;
  // Full tab — matches "open my browser" UX better than a 520×720 popup
  const win = window.open(url, '_blank', 'noopener,noreferrer');
  if (!win) {
    // Popup blocked — navigate top-level as last resort
    window.location.href = url;
    return null;
  }
  try {
    win.focus();
  } catch {
    /* ignore */
  }
  return win;
}

/** @deprecated use openBrowserTab — kept for call-site compatibility */
export function openOAuthPopup(url: string) {
  return openBrowserTab(url);
}

export async function pollOAuthUntilComplete(state: string, maxMs = 180000) {
  const start = Date.now();
  while (Date.now() - start < maxMs) {
    const res = await invoke<{ status: string; error?: string }>('poll-platform-oauth', state);
    if (res.status === 'complete') return { ok: true as const };
    if (res.status === 'error') return { ok: false as const, error: res.error || 'Browser authorization failed' };
    await new Promise((r) => setTimeout(r, 2000));
  }
  return { ok: false as const, error: 'Timed out waiting for browser login — finish signing in, then try again' };
}

export type BrowserConnectStart = {
  success?: boolean;
  error?: string;
  mode?: string;
  needsBrowser?: boolean;
  openUrl?: string;
  oauthUrl?: string;
  state?: string;
  platform?: string;
  message?: string;
  useBrowserConnect?: true;
  fullTab?: boolean;
};

/**
 * Start browser-first connect and open the authorize/login URL in a full tab.
 */
export async function startBrowserConnect(payload: {
  platform: string;
  email?: string;
  username?: string;
  password?: string;
  useProxy?: boolean;
  proxyId?: string | null;
}): Promise<BrowserConnectStart & { opened?: boolean }> {
  const begin = await invoke<BrowserConnectStart>('begin-browser-platform-connect', payload);
  if (!begin.success) return begin;

  const url = begin.openUrl || begin.oauthUrl;
  if (begin.needsBrowser && url) {
    openBrowserTab(url);
    return { ...begin, opened: true };
  }
  return { ...begin, opened: false };
}
