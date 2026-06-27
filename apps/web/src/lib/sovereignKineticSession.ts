/** Shared kinetic 2FA session between Sovereign and Guardian panels (15m window). */
const KINETIC_KEY = 'si_sovereign_kinetic_session';

export function saveKineticSession(token: string) {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.setItem(KINETIC_KEY, JSON.stringify({ token, savedAt: Date.now() }));
  } catch { /* ignore */ }
}

export function loadKineticSession(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(KINETIC_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { token?: string; savedAt?: number };
    if (!parsed.token || !parsed.savedAt) return null;
    if (Date.now() - parsed.savedAt > 15 * 60 * 1000) {
      sessionStorage.removeItem(KINETIC_KEY);
      return null;
    }
    return parsed.token;
  } catch {
    return null;
  }
}

export function clearKineticSession() {
  if (typeof window === 'undefined') return;
  try { sessionStorage.removeItem(KINETIC_KEY); } catch { /* ignore */ }
}