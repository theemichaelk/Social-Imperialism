const express = require('express');
const path = require('path');
const { prisma } = require('@si/db');
const { resolveKeys } = require(path.join(__dirname, '../../../desktop/services/keys'));
const stripeBilling = require(path.join(__dirname, '../../../desktop/services/stripeBilling'));
const {
  PLAN_CATALOG,
  provisionSubscriber,
} = require('../subscriptionAccess');

const router = express.Router();

function webBase() {
  return (process.env.WEB_URL || 'http://localhost:3000').replace(/\/$/, '');
}

function merchantKeys() {
  const keys = resolveKeys({});
  return {
    stripeSecretKey: keys.stripeSecretKey || process.env.STRIPE_SECRET_KEY || '',
  };
}

router.post('/checkout', async (req, res) => {
  try {
    const planId = req.body?.planId || req.body?.plan || 'starter';
    const billingEmail = String(req.body?.billingEmail || req.body?.email || '').trim().toLowerCase();
    const plan = PLAN_CATALOG[planId];

    if (!billingEmail || !billingEmail.includes('@')) {
      return res.status(400).json({ error: 'Valid billing email required' });
    }
    if (!plan || !plan.price) {
      return res.status(400).json({ error: 'Invalid plan' });
    }

    const { stripeSecretKey } = merchantKeys();
    if (!stripeSecretKey) {
      return res.status(503).json({ error: 'Payment provider not configured' });
    }

    const checkout = await stripeBilling.createSubscriptionCheckout({
      secretKey: stripeSecretKey,
      plan,
      billingEmail,
      successUrl: `${webBase()}/billing/success?provider=stripe&plan=${planId}&session_id={CHECKOUT_SESSION_ID}`,
      cancelUrl: `${webBase()}/billing/cancel?provider=stripe&plan=${planId}`,
      metadata: { billing_email: billingEmail },
    });

    res.json({ success: true, checkoutUrl: checkout.checkoutUrl, sessionId: checkout.sessionId });
  } catch (e) {
    console.error('billing/checkout:', e.message);
    res.status(500).json({ error: e.message });
  }
});

router.post('/verify', async (req, res) => {
  try {
    const provider = req.body?.provider || 'stripe';
    const planId = req.body?.planId || req.body?.plan || 'starter';
    const sessionId = req.body?.sessionId;

    if (provider !== 'stripe') {
      return res.status(400).json({ error: 'Only Stripe verification supported on public endpoint' });
    }

    const { stripeSecretKey } = merchantKeys();
    const result = await stripeBilling.verifyCheckoutSession(stripeSecretKey, sessionId);
    if (!result.paid) {
      return res.status(402).json({ success: false, paid: false, error: `Payment not completed (${result.rawStatus})` });
    }

    const email = String(result.customerEmail || '').trim().toLowerCase();
    const resolvedPlan = planId || result.planId || 'starter';
    const provisioned = await provisionSubscriber({
      email,
      planId: resolvedPlan,
      provider: 'stripe',
      externalId: result.subscriptionId || sessionId,
    });

    res.json({
      success: true,
      paid: true,
      email,
      needsPasswordSetup: provisioned.needsPasswordSetup,
      billing: provisioned.billing,
    });
  } catch (e) {
    console.error('billing/verify:', e.message);
    res.status(500).json({ error: e.message });
  }
});

router.get('/status', async (req, res) => {
  const email = String(req.query.email || '').trim().toLowerCase();
  if (!email) return res.status(400).json({ error: 'Email required' });

  const user = await prisma.user.findUnique({ where: { email } }).catch(() => null);
  if (!user) {
    return res.json({ registered: false, canSetupPassword: false, hasActiveSubscription: false });
  }

  const { userHasActiveSubscription } = require('../subscriptionAccess');
  const access = await userHasActiveSubscription(user.id, email);
  const billing = access.ok ? access.billing : null;

  res.json({
    registered: true,
    hasActiveSubscription: access.ok,
    canSetupPassword: !!billing?.pendingPasswordSetup,
    plan: billing?.planName || billing?.plan || null,
  });
});

module.exports = router;