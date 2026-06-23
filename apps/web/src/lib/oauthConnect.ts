import { invoke } from '@/lib/api';

export function openOAuthPopup(url: string) {
  if (typeof window === 'undefined') return null;
  return window.open(url, 'si_oauth', 'noopener,noreferrer,width=520,height=720');
}

export async function pollOAuthUntilComplete(state: string, maxMs = 120000) {
  const start = Date.now();
  while (Date.now() - start < maxMs) {
    const res = await invoke<{ status: string; error?: string }>('poll-platform-oauth', state);
    if (res.status === 'complete') return { ok: true as const };
    if (res.status === 'error') return { ok: false as const, error: res.error || 'OAuth failed' };
    await new Promise((r) => setTimeout(r, 2000));
  }
  return { ok: false as const, error: 'OAuth timed out — try again' };
}