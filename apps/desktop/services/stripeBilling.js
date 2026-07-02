const axios = require('axios');
const qs = require('querystring');

const STRIPE_API = 'https://api.stripe.com/v1';

async function stripeRequest(secretKey, method, path, data = {}) {
  const res = await axios({
    method,
    url: `${STRIPE_API}${path}`,
    headers: {
      Authorization: `Bearer ${secretKey}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    data: method === 'GET' ? undefined : qs.stringify(data),
    params: method === 'GET' ? data : undefined,
    timeout: 30000,
  });
  return res.data;
}

async function testStripeConnection(secretKey) {
  if (!secretKey) return { ok: false, error: 'Stripe secret key not configured' };
  try {
    await stripeRequest(secretKey, 'GET', '/balance');
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e.response?.data?.error?.message || e.message };
  }
}

async function createSubscriptionCheckout({ secretKey, plan, billingEmail, successUrl, cancelUrl, metadata = {} }) {
  if (!secretKey) throw new Error('Stripe secret key not configured');
  if (!plan?.price) throw new Error('Plan has no price');

  const session = await stripeRequest(secretKey, 'POST', '/checkout/sessions', {
    mode: 'subscription',
    'line_items[0][price_data][currency]': 'usd',
    'line_items[0][price_data][product_data][name]': `Social Imperialism — ${plan.name}`,
    'line_items[0][price_data][product_data][description]': (plan.features || []).slice(0, 2).join(' · ') || plan.name,
    'line_items[0][price_data][recurring][interval]': 'month',
    'line_items[0][price_data][unit_amount]': String(Math.round(plan.price * 100)),
    'line_items[0][quantity]': '1',
    success_url: successUrl,
    cancel_url: cancelUrl,
    ...(billingEmail ? { customer_email: billingEmail } : {}),
    'metadata[plan_id]': plan.id,
    'metadata[app]': 'social-imperialism',
    ...Object.fromEntries(Object.entries(metadata).map(([k, v]) => [`metadata[${k}]`, String(v)])),
  });

  return {
    sessionId: session.id,
    checkoutUrl: session.url,
    provider: 'stripe',
  };
}

async function verifyCheckoutSession(secretKey, sessionId) {
  if (!secretKey) throw new Error('Stripe secret key not configured');
  if (!sessionId) throw new Error('Missing session ID');

  const session = await stripeRequest(secretKey, 'GET', `/checkout/sessions/${sessionId}`, {
    expand: ['subscription', 'customer'],
  });

  const paid = session.payment_status === 'paid' || session.status === 'complete';
  return {
    paid,
    planId: session.metadata?.plan_id || null,
    customerEmail: session.customer_details?.email || session.customer_email || '',
    subscriptionId: typeof session.subscription === 'object' ? session.subscription?.id : session.subscription,
    amountTotal: session.amount_total,
    currency: session.currency,
    rawStatus: session.payment_status || session.status,
  };
}

function parseStripeSignature(header) {
  const out = {};
  String(header || '').split(',').forEach((part) => {
    const idx = part.indexOf('=');
    if (idx < 0) return;
    out[part.slice(0, idx).trim()] = part.slice(idx + 1);
  });
  return out;
}

/** Verify Stripe-Signature header and return parsed event (no stripe npm dep). */
function constructWebhookEvent(rawBody, signatureHeader, secret, toleranceSec = 300) {
  if (!secret) throw new Error('Stripe webhook secret not configured');
  const crypto = require('crypto');
  const payload = Buffer.isBuffer(rawBody) ? rawBody.toString('utf8') : String(rawBody || '');
  const parts = parseStripeSignature(signatureHeader);
  const timestamp = parts.t;
  const v1 = parts.v1;
  if (!timestamp || !v1) throw new Error('Invalid Stripe-Signature header');

  const signed = `${timestamp}.${payload}`;
  const expected = crypto.createHmac('sha256', secret).update(signed, 'utf8').digest('hex');
  const sigBuf = Buffer.from(v1, 'utf8');
  const expBuf = Buffer.from(expected, 'utf8');
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
    throw new Error('Webhook signature verification failed');
  }

  const age = Math.floor(Date.now() / 1000) - Number(timestamp);
  if (Number.isFinite(age) && age > toleranceSec) {
    throw new Error('Webhook timestamp outside tolerance');
  }

  return JSON.parse(payload);
}

module.exports = {
  testStripeConnection,
  createSubscriptionCheckout,
  verifyCheckoutSession,
  constructWebhookEvent,
};