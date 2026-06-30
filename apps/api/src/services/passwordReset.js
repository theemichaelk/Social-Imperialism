/**
 * Forgot-password and reset-password with secure tokens and email delivery.
 */
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const path = require('path');
const { prisma } = require('@si/db');
const emailService = require(path.join(__dirname, '../../../desktop/services/emailService'));
const { resolveKeys } = require(path.join(__dirname, '../../../desktop/services/keys'));
const { validateEmail, validatePassword } = require('../lib/authValidation');
const { hashToken } = require('../middleware/auth');
const { userHasActiveSubscription, isAdminEmail } = require('../subscriptionAccess');

const RESET_TTL_HOURS = parseInt(process.env.PASSWORD_RESET_TTL_HOURS || '2', 10);

function webBase() {
  return (process.env.WEB_URL || 'https://www.socialimperialism.com').replace(/\/$/, '');
}

function generateRawToken() {
  return crypto.randomBytes(32).toString('hex');
}

function resetEmailHtml({ userName, resetUrl }) {
  return `<div style="font-family:Segoe UI,sans-serif;color:#0f172a;max-width:600px;line-height:1.6;">
<h1 style="color:#0284c7;margin-bottom:0.5rem;">Reset your password</h1>
<p>Hi ${userName},</p>
<p>We received a request to reset your Social Imperialism password. This link expires in ${RESET_TTL_HOURS} hours.</p>
<p><a href="${resetUrl}" style="display:inline-block;background:#0284c7;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;">Choose a new password →</a></p>
<p style="color:#64748b;font-size:0.9rem;">If you did not request this, you can ignore this email. Your password will not change.</p>
<p style="color:#64748b;font-size:0.85rem;">— Social Imperialism Security</p>
</div>`;
}

async function requestPasswordReset(email) {
  const emailResult = validateEmail(email);
  if (!emailResult.ok) {
    return { ok: true, message: genericSuccessMessage() };
  }

  const user = await prisma.user.findUnique({ where: { email: emailResult.email } });
  if (!user) {
    return { ok: true, message: genericSuccessMessage() };
  }

  const access = await userHasActiveSubscription(user.id, user.email);
  if (!access.ok && !isAdminEmail(user.email)) {
    return { ok: true, message: genericSuccessMessage() };
  }

  await prisma.passwordResetToken.updateMany({
    where: { userId: user.id, usedAt: null },
    data: { usedAt: new Date() },
  });

  const rawToken = generateRawToken();
  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + RESET_TTL_HOURS);

  await prisma.passwordResetToken.create({
    data: {
      userId: user.id,
      tokenHash: hashToken(rawToken),
      expiresAt,
    },
  });

  const resetUrl = `${webBase()}/reset-password?token=${encodeURIComponent(rawToken)}`;
  const keys = resolveKeys({});

  try {
    await emailService.sendEmail(keys, {
      to: user.email,
      subject: 'Reset your Social Imperialism password',
      html: resetEmailHtml({
        userName: user.name || user.email.split('@')[0],
        resetUrl,
      }),
      shortenLinks: false,
    });
  } catch (e) {
    console.error('[passwordReset] email send failed:', e.message);
    return { ok: false, error: 'Could not send reset email. Try again in a few minutes.' };
  }

  return { ok: true, message: genericSuccessMessage() };
}

function genericSuccessMessage() {
  return 'If an account exists for that email, we sent password reset instructions.';
}

async function completePasswordReset(rawToken, password) {
  const passwordResult = validatePassword(password);
  if (!passwordResult.ok) {
    throw new Error(passwordResult.error);
  }
  if (!rawToken || String(rawToken).length < 20) {
    throw new Error('Invalid or expired reset link.');
  }

  const tokenHash = hashToken(String(rawToken));
  const row = await prisma.passwordResetToken.findUnique({
    where: { tokenHash },
    include: { user: true },
  });

  if (!row || row.usedAt || row.expiresAt < new Date()) {
    throw new Error('Invalid or expired reset link. Request a new one.');
  }

  const access = await userHasActiveSubscription(row.user.id, row.user.email);
  if (!access.ok && !isAdminEmail(row.user.email)) {
    throw new Error('No active subscription on this account.');
  }

  const passwordHash = await bcrypt.hash(password, 10);
  await prisma.$transaction([
    prisma.user.update({
      where: { id: row.userId },
      data: { passwordHash },
    }),
    prisma.passwordResetToken.update({
      where: { id: row.id },
      data: { usedAt: new Date() },
    }),
    prisma.passwordResetToken.updateMany({
      where: { userId: row.userId, usedAt: null },
      data: { usedAt: new Date() },
    }),
    prisma.session.deleteMany({ where: { userId: row.userId } }),
  ]);

  return { success: true, email: row.user.email };
}

module.exports = {
  requestPasswordReset,
  completePasswordReset,
  RESET_TTL_HOURS,
};