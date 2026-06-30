const EMAIL_REGEX = /^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/i;

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function validateEmail(email) {
  const normalized = normalizeEmail(email);
  if (!normalized) {
    return { ok: false, error: 'Email is required.', email: '' };
  }
  if (normalized.length > 254) {
    return { ok: false, error: 'Email is too long.', email: normalized };
  }
  if (!EMAIL_REGEX.test(normalized)) {
    return { ok: false, error: 'Enter a valid email address.', email: normalized };
  }
  return { ok: true, email: normalized };
}

function validatePassword(password, { requireConfirm, confirm } = {}) {
  const value = String(password || '');
  if (!value) {
    return { ok: false, error: 'Password is required.' };
  }
  if (value.length < 8) {
    return { ok: false, error: 'Password must be at least 8 characters.' };
  }
  if (value.length > 128) {
    return { ok: false, error: 'Password must be 128 characters or fewer.' };
  }
  if (!/[a-zA-Z]/.test(value)) {
    return { ok: false, error: 'Password must include at least one letter.' };
  }
  if (!/[0-9]/.test(value)) {
    return { ok: false, error: 'Password must include at least one number.' };
  }
  if (requireConfirm && value !== String(confirm || '')) {
    return { ok: false, error: 'Passwords do not match.' };
  }
  return { ok: true };
}

function validateLoginBody(body) {
  const emailResult = validateEmail(body?.email);
  if (!emailResult.ok) return emailResult;
  const passwordResult = validatePassword(body?.password);
  if (!passwordResult.ok) return passwordResult;
  return { ok: true, email: emailResult.email, password: String(body.password) };
}

function validateSetupPasswordBody(body) {
  const emailResult = validateEmail(body?.email);
  if (!emailResult.ok) return emailResult;
  const passwordResult = validatePassword(body?.password);
  if (!passwordResult.ok) return passwordResult;
  return { ok: true, email: emailResult.email, password: String(body.password) };
}

module.exports = {
  EMAIL_REGEX,
  normalizeEmail,
  validateEmail,
  validatePassword,
  validateLoginBody,
  validateSetupPasswordBody,
};