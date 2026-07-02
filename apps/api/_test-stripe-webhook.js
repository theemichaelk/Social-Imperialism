/**
 * Stripe webhook event processor — unit smoke test (no DB required).
 */
const assert = require('assert');
const { processStripeEvent } = require('./src/routes/stripeWebhook');

(async () => {
  const ignored = await processStripeEvent({ id: 'evt_ignored', type: 'checkout.session.completed', data: { object: {} } });
  assert.strictEqual(ignored.handled, false);
  assert.strictEqual(ignored.ignored, true);

  const skipped = await processStripeEvent({
    id: 'evt_paid_create',
    type: 'invoice.paid',
    data: { object: { id: 'in_1', billing_reason: 'subscription_create', subscription: 'sub_x' } },
  });
  assert.strictEqual(skipped.handled, true);
  assert.strictEqual(skipped.skipped, 'initial_checkout');

  console.log('stripe webhook processor smoke OK');
})().catch((e) => {
  console.error(e);
  process.exit(1);
});