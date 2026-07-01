/**
 * Public lead capture — 5-second modal signups → drip enrollment + welcome email job.
 */
const path = require('path');
const { prisma } = require('@si/db');

const JOB_TYPE = 'marketing_lead';
const WELCOME_JOB_TYPE = 'lead_welcome_email';

async function captureLead({ email, name, source, discountCode }) {
  const normalized = String(email || '').trim().toLowerCase();
  if (!normalized || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
    throw new Error('Valid email required');
  }

  const existing = await prisma.job.findFirst({
    where: { type: JOB_TYPE, payload: { contains: normalized } },
  });
  if (existing) {
    return { success: true, email: normalized, enrolled: true, duplicate: true };
  }

  const payload = {
    email: normalized,
    name: String(name || '').trim() || null,
    source: source || 'landing-modal',
    discountCode: discountCode || 'AETHELGARD15',
    capturedAt: new Date().toISOString(),
    opens: 0,
    lastOpenAt: null,
    status: 'active',
    dripPath: 'welcome-onboarding',
  };

  await prisma.job.create({
    data: {
      type: JOB_TYPE,
      status: 'captured',
      payload: JSON.stringify(payload),
      runAt: new Date(),
    },
  });

  await prisma.job.create({
    data: {
      type: WELCOME_JOB_TYPE,
      status: 'pending',
      payload: JSON.stringify({ email: normalized, name: payload.name, discountCode: payload.discountCode }),
      runAt: new Date(),
    },
  });

  return { success: true, email: normalized, enrolled: true };
}

async function processLeadWelcomeEmails() {
  const due = await prisma.job.findMany({
    where: { type: WELCOME_JOB_TYPE, status: 'pending', runAt: { lte: new Date() } },
    take: 20,
  });
  if (!due.length) return { sent: 0 };

  const emailService = require(path.join(__dirname, '../../../desktop/services/emailService'));
  const { resolveKeys } = require(path.join(__dirname, '../../../desktop/services/keys'));
  const keys = resolveKeys({});
  const webUrl = (process.env.WEB_URL || 'https://www.socialimperialism.com').replace(/\/$/, '');
  let sent = 0;

  for (const job of due) {
    let payload = {};
    try { payload = JSON.parse(job.payload || '{}'); } catch (e) { continue; }
    const discount = payload.discountCode || 'AETHELGARD15';
    const name = payload.name || 'there';
    try {
      await emailService.sendEmail(keys, {
        to: payload.email,
        subject: `Your ${discount} discount — Social Imperialism`,
        html: `<div style="font-family:Segoe UI,sans-serif;max-width:560px;line-height:1.6;color:#0f172a;">
<h2 style="color:#0284c7;">Welcome, ${name}</h2>
<p>Thanks for joining Social Imperialism. Use code <strong>${discount}</strong> at checkout.</p>
<p><a href="${webUrl}/subscribe" style="display:inline-block;background:#0284c7;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:600;">Start your plan →</a></p>
<p style="color:#64748b;font-size:0.85rem;">— Social Imperialism Growth Team</p>
</div>`,
        text: `Welcome! Use code ${discount} at ${webUrl}/subscribe`,
      });
      await prisma.job.update({ where: { id: job.id }, data: { status: 'sent', result: 'ok' } });
      sent += 1;
    } catch (e) {
      await prisma.job.update({
        where: { id: job.id },
        data: { status: 'failed', result: e.message, runAt: new Date(Date.now() + 3600000) },
      });
    }
  }
  return { sent };
}

async function processColdContactRules() {
  const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
  const leads = await prisma.job.findMany({
    where: { type: JOB_TYPE, status: { in: ['captured', 'active'] } },
    take: 500,
  });

  let rerouted = 0;
  for (const job of leads) {
    let payload = {};
    try { payload = JSON.parse(job.payload || '{}'); } catch (e) { continue; }
    const lastOpen = payload.lastOpenAt ? new Date(payload.lastOpenAt).getTime() : 0;
    const captured = payload.capturedAt ? new Date(payload.capturedAt).getTime() : job.createdAt.getTime();
    const reference = lastOpen || captured;
    if (reference > cutoff) continue;
    if (payload.status === 'cold') continue;

    payload.status = 'cold';
    payload.reroutedAt = new Date().toISOString();
    payload.dripPath = 'win-back-reengagement';
    await prisma.job.update({
      where: { id: job.id },
      data: { status: 'cold', payload: JSON.stringify(payload) },
    });
    rerouted += 1;
  }
  return { rerouted };
}

module.exports = {
  captureLead,
  processColdContactRules,
  processLeadWelcomeEmails,
  JOB_TYPE,
  WELCOME_JOB_TYPE,
};