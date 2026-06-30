const EMAIL_REGEX = /^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/i;

export function normalizeEmail(email: string): string {
  return String(email || '').trim().toLowerCase();
}

export type EmailValidation =
  | { ok: true; email: string }
  | { ok: false; error: string };

export type PasswordValidation =
  | { ok: true }
  | { ok: false; error: string };

export function validateEmail(email: string): EmailValidation {
  const normalized = normalizeEmail(email);
  if (!normalized) return { ok: false as const, error: 'Email is required.' };
  if (normalized.length > 254) return { ok: false as const, error: 'Email is too long.' };
  if (!EMAIL_REGEX.test(normalized)) return { ok: false as const, error: 'Enter a valid email address.' };
  return { ok: true as const, email: normalized };
}

export function validatePassword(password: string): PasswordValidation {
  const value = String(password || '');
  if (!value) return { ok: false as const, error: 'Password is required.' };
  if (value.length < 8) return { ok: false as const, error: 'Password must be at least 8 characters.' };
  if (value.length > 128) return { ok: false as const, error: 'Password must be 128 characters or fewer.' };
  if (!/[a-zA-Z]/.test(value)) return { ok: false as const, error: 'Password must include at least one letter.' };
  if (!/[0-9]/.test(value)) return { ok: false as const, error: 'Password must include at least one number.' };
  return { ok: true as const };
}

export function passwordsMatch(password: string, confirm: string): boolean {
  return String(password) === String(confirm);
}

export function validationErrorMessage(result: { ok: boolean; error?: string }): string {
  if (result.ok) return '';
  return result.error || 'Validation failed.';
}