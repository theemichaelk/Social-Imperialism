/**
 * Platform administrator identity (THEE_MICHAEL authorized emails).
 * Single source of truth for admin bypass across API, sovereign shield, and IPC.
 */
const DEFAULT_ADMIN_EMAILS = 'theesaintmichael@gmail.com,michaelk@tsbrenterprises.com';

function getPlatformAdminEmails() {
  const raw = process.env.ADMIN_EMAILS || process.env.SEED_EMAIL || DEFAULT_ADMIN_EMAILS;
  const fromList = raw.split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
  const singles = [
    process.env.ADMIN_EMAIL,
    process.env.SOVEREIGN_ADMIN_EMAIL,
  ].filter(Boolean).map((e) => e.trim().toLowerCase());
  return [...new Set([...fromList, ...singles])];
}

function isPlatformAdminEmail(email) {
  return getPlatformAdminEmails().includes(String(email || '').trim().toLowerCase());
}

/** @deprecated use isPlatformAdminEmail */
function isAuthorizedAdmin(email) {
  return isPlatformAdminEmail(email);
}

module.exports = {
  DEFAULT_ADMIN_EMAILS,
  getPlatformAdminEmails,
  isPlatformAdminEmail,
  isAuthorizedAdmin,
};