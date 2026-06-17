const axios = require('axios');
const { getPayPalApiBase } = require('./paymentConfig');

async function getAccessToken(keys, mode) {
  const apiBase = getPayPalApiBase(mode);
  const auth = Buffer.from(`${keys.paypalClientId}:${keys.paypalClientSecret}`).toString('base64');
  const res = await axios.post(
    `${apiBase}/v1/oauth2/token`,
    'grant_type=client_credentials',
    {
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      timeout: 20000,
    }
  );
  return { token: res.data.access_token, apiBase };
}

async function testPayPalConnection(keys, mode) {
  if (!keys.paypalClientId || !keys.paypalClientSecret) {
    return { ok: false, error: 'PayPal Client ID and Secret not configured' };
  }
  try {
    await getAccessToken(keys, mode);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e.response?.data?.error_description || e.message };
  }
}

async function ensureBillingPlan({ store, keys, mode, plan }) {
  const cacheKey = `paypalBillingPlan_${mode}_${plan.id}`;
  const cached = store.getItem(cacheKey);
  if (cached) return cached;

  const { token, apiBase } = await getAccessToken(keys, mode);
  const headers = {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
    Prefer: 'return=representation',
  };

  const productRes = await axios.post(
    `${apiBase}/v1/catalogs/products`,
    {
      name: `Social Imperialism ${plan.name}`,
      description: (plan.features || []).join(', ') || plan.name,
      type: 'SERVICE',
      category: 'SOFTWARE',
    },
    { headers, timeout: 25000 }
  );

  const planRes = await axios.post(
    `${apiBase}/v1/billing/plans`,
    {
      product_id: productRes.data.id,
      name: `${plan.name} Monthly`,
      description: `Social Imperialism ${plan.name} subscription`,
      billing_cycles: [
        {
          frequency: { interval_unit: 'MONTH', interval_count: 1 },
          tenure_type: 'REGULAR',
          sequence: 1,
          total_cycles: 0,
          pricing_scheme: {
            fixed_price: { value: String(plan.price), currency_code: 'USD' },
          },
        },
      ],
      payment_preferences: {
        auto_bill_outstanding: true,
        setup_fee_failure_action: 'CONTINUE',
        payment_failure_threshold: 3,
      },
    },
    { headers, timeout: 25000 }
  );

  const billingPlanId = planRes.data.id;
  store.setItem(cacheKey, billingPlanId);
  return billingPlanId;
}

async function createSubscriptionCheckout({ store, keys, mode, plan, billingEmail, returnUrl, cancelUrl }) {
  if (!keys.paypalClientId || !keys.paypalClientSecret) {
    throw new Error('PayPal Client ID and Secret not configured');
  }

  const billingPlanId = await ensureBillingPlan({ store, keys, mode, plan });
  const { token, apiBase } = await getAccessToken(keys, mode);

  const subRes = await axios.post(
    `${apiBase}/v1/billing/subscriptions`,
    {
      plan_id: billingPlanId,
      subscriber: billingEmail ? { email_address: billingEmail } : undefined,
      application_context: {
        brand_name: 'Social Imperialism',
        locale: 'en-US',
        shipping_preference: 'NO_SHIPPING',
        user_action: 'SUBSCRIBE_NOW',
        payment_method: { payer_selected: 'PAYPAL', payee_preferred: 'IMMEDIATE_PAYMENT_REQUIRED' },
        return_url: returnUrl,
        cancel_url: cancelUrl,
      },
    },
    {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        Prefer: 'return=representation',
      },
      timeout: 30000,
    }
  );

  const approveLink = (subRes.data.links || []).find((l) => l.rel === 'approve');
  return {
    subscriptionId: subRes.data.id,
    checkoutUrl: approveLink?.href,
    provider: 'paypal',
    status: subRes.data.status,
  };
}

async function verifySubscription(keys, mode, subscriptionId) {
  if (!subscriptionId) throw new Error('Missing PayPal subscription ID');
  const { token, apiBase } = await getAccessToken(keys, mode);
  const res = await axios.get(`${apiBase}/v1/billing/subscriptions/${subscriptionId}`, {
    headers: { Authorization: `Bearer ${token}` },
    timeout: 20000,
  });

  const status = res.data.status;
  const active = status === 'ACTIVE' || status === 'APPROVED';
  return {
    paid: active,
    subscriptionId: res.data.id,
    status,
    customerEmail: res.data.subscriber?.email_address || '',
    planId: res.data.plan_id,
    raw: res.data,
  };
}

module.exports = {
  testPayPalConnection,
  createSubscriptionCheckout,
  verifySubscription,
};