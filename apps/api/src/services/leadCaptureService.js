/**
 * Public lead capture — 5-second modal signups → drip enrollment.
 */
const path = require('path');
const { prisma } = require('@si/db');

const JOB_TYPE = 'marketing_lead';

async function captureLead({ email, name, source, discountCode }) {
  const normalized = String(email || '').trim().toLowerCase();
  if (!normalized || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
    throw new Error('Valid email required');
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
  };

  await prisma.job.create({
    data: {
      type: JOB_TYPE,
      status: 'captured',
      payload: JSON.stringify(payload),
      runAt: new Date(),
    },
  });

  return { success: true, email: normalized, enrolled: true };
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

module.exports = { captureLead, processColdContactRules, JOB_TYPE };