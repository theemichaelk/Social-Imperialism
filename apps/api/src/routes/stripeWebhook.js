const path = require('path');
const { resolveKeys } = require(path.join(__dirname, '../../../desktop/services/keys'));
const stripeBilling = require(path.join(__dirname, '../../../desktop/services/stripeBilling'));
const {
  findOrgByStripeSubscriptionId,
  findOrgByBillingEmail,
  setOrgSubscriptionStatus,
  applyStripeSubscriptionStatus,
} = require('../subscriptionAccess');

function webhookSecret() {
  const keys = resolveKeys({});
  return keys.stripeWebhookSecret || process.env.STRIPE_WEBHOOK_SECRET || '';
}

async function handleStripeWebhook(req, res) {
  const secret = webhookSecret();
  if (!secret) {
    return res.status(503).json({ error: 'Stripe webhook secret not configured' });
  }

  let event;
  try {
    event = stripeBilling.constructWebhookEvent(
      req.body,
      req.headers['stripe-signature'],
      secret,
    );
  } catch (e) {
    console.warn('[stripe-webhook] signature:', e.message);
    return res.status(400).json({ error: e.message });
  }

  try {
    const result = await processStripeEvent(event);
    return res.json({ received: true, ...result });
  } catch (e) {
    console.error('[stripe-webhook] process:', e.message);
    return res.status(500).json({ error: e.message });
  }
}

async function processStripeEvent(event) {
  const type = event.type;
  const obj = event.data?.object || {};
  const meta = { eventId: event.id, type };

  switch (type) {
    case 'invoice.payment_failed': {
      const subId = typeof obj.subscription === 'string' ? obj.subscription : obj.subscription?.id;
      const email = obj.customer_email || obj.billing_details?.email || '';
      let match = subId ? await findOrgByStripeSubscriptionId(subId) : null;
      if (!match && email) match = await findOrgByBillingEmail(email);
      if (!match) return { handled: false, type, reason: 'org_not_found' };

      const billing = await setOrgSubscriptionStatus(match.orgId, {
        status: 'past_due',
        reason: `Payment failed — invoice ${obj.id || ''}`.trim(),
        source: 'stripe_webhook',
        stripeEventId: event.id,
        stripeSubscriptionId: subId || undefined,
      });
      return { handled: true, type, orgId: match.orgId, status: billing.status };
    }

    case 'invoice.paid': {
      if (obj.billing_reason === 'subscription_create') {
        return { handled: true, type, skipped: 'initial_checkout' };
      }
      const subId = typeof obj.subscription === 'string' ? obj.subscription : obj.subscription?.id;
      if (!subId) return { handled: false, type, reason: 'no_subscription' };
      const applied = await applyStripeSubscriptionStatus(subId, 'active', {
        eventId: event.id,
        reason: `Renewal paid — invoice ${obj.id || ''}`.trim(),
      });
      return { handled: applied.applied, type, ...applied };
    }

    case 'customer.subscription.deleted': {
      const applied = await applyStripeSubscriptionStatus(obj.id, 'canceled', {
        eventId: event.id,
        reason: 'Stripe subscription deleted (cancelled or failed renewal)',
      });
      return { handled: applied.applied, type, ...applied };
    }

    case 'customer.subscription.updated': {
      const applied = await applyStripeSubscriptionStatus(obj.id, obj.status, {
        eventId: event.id,
        reason: `Stripe subscription updated → ${obj.status}`,
      });
      return { handled: applied.applied, type, ...applied };
    }

    default:
      return { handled: false, type, ignored: true };
  }
}

module.exports = { handleStripeWebhook, processStripeEvent };