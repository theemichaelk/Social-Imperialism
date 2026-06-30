const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { prisma } = require('@si/db');
const { ensureDefaultProject } = require('./projectEnsure');

const { PLAN_CATALOG } = require('../../desktop/services/settingsIpc');

function adminEmails() {
  return (process.env.ADMIN_EMAILS || '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

function isAdminEmail(email) {
  return adminEmails().includes(String(email || '').trim().toLowerCase());
}

function parseBilling(raw) {
  try {
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

async function getOrgBilling(orgId) {
  const row = await prisma.orgSetting.findUnique({
    where: { organizationId_key: { organizationId: orgId, key: 'billingPlan' } },
  });
  return parseBilling(row?.value);
}

function buildBillingPayload(planId, billingEmail, provider, externalId) {
  const catalog = PLAN_CATALOG[planId] || PLAN_CATALOG.starter;
  const now = new Date().toISOString();
  const nextMonth = new Date();
  nextMonth.setMonth(nextMonth.getMonth() + 1);
  return {
    plan: planId,
    planName: catalog.name,
    price: catalog.price,
    priceLabel: catalog.priceLabel,
    status: 'active',
    paymentProvider: provider || 'stripe',
    externalSubscriptionId: externalId || null,
    updatedAt: now,
    startedAt: now,
    nextBillingDate: nextMonth.toISOString(),
    billingEmail,
    pendingPasswordSetup: false,
    limits: {
      accounts: catalog.accounts,
      aiGenerations: catalog.aiGenerations,
      crisisMonitoring: catalog.crisisMonitoring,
    },
    history: [{
      id: `bill_${Date.now()}`,
      date: now,
      action: 'payment_completed',
      plan: planId,
      planName: catalog.name,
      amount: catalog.price,
      priceLabel: catalog.priceLabel,
      provider: provider || 'stripe',
      externalId,
      note: `Subscription activated for ${billingEmail}`,
    }],
  };
}

async function upsertOrgBilling(orgId, billing) {
  await prisma.orgSetting.upsert({
    where: { organizationId_key: { organizationId: orgId, key: 'billingPlan' } },
    update: { value: JSON.stringify(billing) },
    create: { organizationId: orgId, key: 'billingPlan', value: JSON.stringify(billing) },
  });
  await prisma.organization.update({
    where: { id: orgId },
    data: { plan: billing.plan || 'starter' },
  });
}

async function provisionSubscriber({ email, planId, provider, externalId }) {
  const normalized = String(email || '').trim().toLowerCase();
  if (!normalized) throw new Error('Billing email required');

  let user = await prisma.user.findUnique({ where: { email: normalized } });
  let org;
  let created = false;

  if (user) {
    const membership = await prisma.organizationMember.findFirst({
      where: { userId: user.id },
      include: { organization: true },
    });
    org = membership?.organization;
    if (!org) {
      org = await prisma.organization.create({
        data: {
          name: `${user.name || normalized}'s Workspace`,
          slug: `${normalized.split('@')[0]}-${Date.now().toString(36)}`.slice(0, 48),
          plan: planId || 'starter',
        },
      });
      await prisma.organizationMember.create({
        data: { organizationId: org.id, userId: user.id, role: 'owner' },
      });
    }
  } else {
    const tempHash = await bcrypt.hash(crypto.randomBytes(32).toString('hex'), 10);
    user = await prisma.user.create({
      data: {
        email: normalized,
        passwordHash: tempHash,
        name: normalized.split('@')[0],
      },
    });
    org = await prisma.organization.create({
      data: {
        name: `${user.name}'s Workspace`,
        slug: `${normalized.split('@')[0]}-${Date.now().toString(36)}`.slice(0, 48),
        plan: planId || 'starter',
      },
    });
    await prisma.organizationMember.create({
      data: { organizationId: org.id, userId: user.id, role: 'owner' },
    });
    created = true;
  }

  const billing = buildBillingPayload(planId || 'starter', normalized, provider, externalId);
  billing.pendingPasswordSetup = created;
  await upsertOrgBilling(org.id, billing);
  await ensureDefaultProject(org.id);

  try {
    const { enrollOnCheckout } = require('./services/onboardingEmailSequences');
    await enrollOnCheckout({
      userId: user.id,
      organizationId: org.id,
      email: normalized,
      planName: billing.planName || billing.plan || 'Social Imperialism',
    });
  } catch (enrollErr) {
    console.warn('[subscription] onboarding email enroll:', enrollErr.message);
  }

  return { user, org, billing, needsPasswordSetup: created };
}

async function userHasActiveSubscription(userId, email) {
  if (isAdminEmail(email)) return { ok: true };

  const membership = await prisma.organizationMember.findFirst({
    where: { userId },
    include: { organization: true },
  });
  if (!membership) return { ok: false, error: 'No organization membership' };

  const billing = await getOrgBilling(membership.organizationId);
  if (billing.status !== 'active') {
    return { ok: false, error: 'No active subscription. Subscribe to get access.' };
  }

  const billingEmail = String(billing.billingEmail || '').trim().toLowerCase();
  const userEmail = String(email || '').trim().toLowerCase();
  if (billingEmail && billingEmail !== userEmail) {
    return { ok: false, error: 'Email does not match subscription billing email.' };
  }

  return { ok: true, orgId: membership.organizationId, billing };
}

async function setupSubscriberPassword(email, password) {
  const { validateEmail, validatePassword } = require('./lib/authValidation');
  const emailResult = validateEmail(email);
  if (!emailResult.ok) throw new Error(emailResult.error);
  const passwordResult = validatePassword(password);
  if (!passwordResult.ok) throw new Error(passwordResult.error);
  const normalized = emailResult.email;

  const user = await prisma.user.findUnique({ where: { email: normalized } });
  if (!user) throw new Error('No subscription found for this email. Complete checkout first.');

  const membership = await prisma.organizationMember.findFirst({ where: { userId: user.id } });
  if (!membership) throw new Error('Account not provisioned');

  const billing = await getOrgBilling(membership.organizationId);
  if (billing.status !== 'active') throw new Error('Subscription is not active');
  if (String(billing.billingEmail || '').toLowerCase() !== normalized) {
    throw new Error('Email does not match subscription');
  }

  const hash = await bcrypt.hash(password, 10);
  await prisma.user.update({ where: { id: user.id }, data: { passwordHash: hash } });

  billing.pendingPasswordSetup = false;
  billing.updatedAt = new Date().toISOString();
  await upsertOrgBilling(membership.organizationId, billing);

  const project = await ensureDefaultProject(membership.organizationId);
  return { user, orgId: membership.organizationId, project };
}

module.exports = {
  adminEmails,
  isAdminEmail,
  getOrgBilling,
  buildBillingPayload,
  upsertOrgBilling,
  provisionSubscriber,
  userHasActiveSubscription,
  setupSubscriberPassword,
  PLAN_CATALOG,
};