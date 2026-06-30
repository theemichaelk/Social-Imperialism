const EMAIL_REGEX = /^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/i;

export function normalizeEmail(email: string): string {
  return String(email || '').trim().toLowerCase();
}

export function validateEmail(email: string): { ok: true; email: string } | { ok: false; error: string } {
  const normalized = normalizeEmail(email);
  if (!normalized) return { ok: false, error: 'Email is required.' };
  if (normalized.length > 254) return { ok: false, error: 'Email is too long.' };
  if (!EMAIL_REGEX.test(normalized)) return { ok: false, error: 'Enter a valid email address.' };
  return { ok: true, email: normalized };
}

export function validatePassword(password: string): { ok: true } | { ok: false; error: string } {
  const value = String(password || '');
  if (!value) return { ok: false, error: 'Password is required.' };
  if (value.length < 8) return { ok: false, error: 'Password must be at least 8 characters.' };
  if (value.length > 128) return { ok: false, error: 'Password must be 128 characters or fewer.' };
  if (!/[a-zA-Z]/.test(value)) return { ok: false, error: 'Password must include at least one letter.' };
  if (!/[0-9]/.test(value)) return { ok: false, error: 'Password must include at least one number.' };
  return { ok: true };
}

export function passwordsMatch(password: string, confirm: string): boolean {
  return String(password) === String(confirm);
}