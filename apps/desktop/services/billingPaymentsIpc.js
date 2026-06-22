const { PLAN_CATALOG, buildBillingResponse, loadBillingState } = require('./settingsIpc');
const { loadPaymentSettings, loadMerchantKeys, getPaymentStatus } = require('./paymentConfig');
const stripeBilling = require('./stripeBilling');
const paypalBilling = require('./paypalBilling');

function webBillingBase() {
  return (process.env.WEB_URL || '').replace(/\/$/, '');
}
function billingSuccessUrl(planId, provider) {
  const base = webBillingBase();
  if (base) return `${base}/billing/success?provider=${provider}&plan=${planId}`;
  return `social-imperialism://payment-success?provider=${provider}&plan=${planId}`;
}
function billingCancelUrl(planId, provider) {
  const base = webBillingBase();
  if (base) return `${base}/billing/cancel?provider=${provider}&plan=${planId}`;
  return `social-imperialism://payment-cancel?provider=${provider}&plan=${planId}`;
}

function activatePlanAfterPayment(store, { planId, billingEmail, provider, externalId, note }) {
  const catalog = PLAN_CATALOG[planId] || PLAN_CATALOG.starter;
  const existing = loadBillingState(store);
  const now = new Date().toISOString();
  const nextMonth = new Date();
  nextMonth.setMonth(nextMonth.getMonth() + 1);

  const payload = {
    ...existing,
    plan: planId,
    planName: catalog.name,
    price: catalog.price,
    priceLabel: catalog.priceLabel,
    status: 'active',
    paymentProvider: provider,
    externalSubscriptionId: externalId || existing.externalSubscriptionId || null,
    updatedAt: now,
    startedAt: existing.startedAt || now,
    nextBillingDate: nextMonth.toISOString(),
    billingEmail: billingEmail || existing.billingEmail,
    limits: {
      accounts: catalog.accounts,
      aiGenerations: catalog.aiGenerations,
      crisisMonitoring: catalog.crisisMonitoring,
    },
    history: Array.isArray(existing.history) ? [...existing.history] : [],
  };

  payload.history.unshift({
    id: 'bill_' + Date.now(),
    date: now,
    action: 'payment_completed',
    plan: planId,
    planName: catalog.name,
    amount: catalog.price,
    priceLabel: catalog.priceLabel,
    provider,
    externalId,
    note: note || `Paid via ${provider} — ${catalog.name}`,
  });
  payload.history = payload.history.slice(0, 25);
  store.setItem('billingPlan', JSON.stringify(payload));
  return buildBillingResponse(payload);
}

function registerBillingPaymentHandlers({ ipcMain, store, shell, onPaymentComplete }) {
  ipcMain.handle('get-payment-status', () => getPaymentStatus(store));

  ipcMain.handle('get-payment-settings', () => loadPaymentSettings(store));

  ipcMain.handle('save-payment-settings', (event, settings) => {
    const merged = { ...loadPaymentSettings(store), ...settings };
    store.setItem('paymentSettings', JSON.stringify(merged));
    return { success: true, ...getPaymentStatus(store) };
  });

  ipcMain.handle('test-payment-connections', async () => {
    const settings = loadPaymentSettings(store);
    const keys = loadMerchantKeys(store);
    const mode = settings.mode === 'test' ? 'test' : 'live';
    const [stripe, paypal] = await Promise.all([
      stripeBilling.testStripeConnection(keys.stripeSecretKey),
      paypalBilling.testPayPalConnection(keys, mode),
    ]);
    return { success: true, mode, stripe, paypal };
  });

  ipcMain.handle('create-subscription-checkout', async (event, input) => {
    const planId = input?.planId || input?.plan;
    const provider = input?.provider || loadPaymentSettings(store).defaultProvider || 'stripe';
    const billingEmail = String(input?.billingEmail || '').trim();
    const plan = PLAN_CATALOG[planId];

    if (!plan) return { success: false, error: 'Unknown plan' };
    if (planId === 'enterprise') return { success: false, error: 'Enterprise requires sales contact' };
    if (!plan.price) return { success: false, error: 'Plan has no recurring price' };

    const settings = loadPaymentSettings(store);
    const keys = loadMerchantKeys(store);
    const mode = settings.mode === 'test' ? 'test' : 'live';

    try {
      let checkout;
      if (provider === 'paypal') {
        checkout = await paypalBilling.createSubscriptionCheckout({
          store,
          keys,
          mode,
          plan,
          billingEmail,
          returnUrl: billingSuccessUrl(planId, 'paypal'),
          cancelUrl: billingCancelUrl(planId, 'paypal'),
        });
      } else {
        checkout = await stripeBilling.createSubscriptionCheckout({
          secretKey: keys.stripeSecretKey,
          plan,
          billingEmail,
          successUrl: `${billingSuccessUrl(planId, 'stripe')}&session_id={CHECKOUT_SESSION_ID}`,
          cancelUrl: billingCancelUrl(planId, 'stripe'),
        });
      }

      if (!checkout.checkoutUrl) {
        return { success: false, error: 'Payment provider did not return a checkout URL' };
      }

      const pending = {
        planId,
        provider,
        createdAt: new Date().toISOString(),
        sessionId: checkout.sessionId || null,
        subscriptionId: checkout.subscriptionId || null,
      };
      store.setItem('pendingPaymentCheckout', JSON.stringify(pending));

      return {
        success: true,
        provider,
        checkoutUrl: checkout.checkoutUrl,
        sessionId: checkout.sessionId,
        subscriptionId: checkout.subscriptionId,
      };
    } catch (e) {
      console.error('create-subscription-checkout error:', e.response?.data || e.message);
      return {
        success: false,
        error: e.response?.data?.message || e.response?.data?.error_description || e.message,
      };
    }
  });

  ipcMain.handle('verify-subscription-payment', async (event, input) => {
    const provider = input?.provider;
    const planId = input?.planId || input?.plan;
    const settings = loadPaymentSettings(store);
    const keys = loadMerchantKeys(store);
    const mode = settings.mode === 'test' ? 'test' : 'live';

    try {
      let result;
      if (provider === 'stripe') {
        const sessionId = input?.sessionId;
        result = await stripeBilling.verifyCheckoutSession(keys.stripeSecretKey, sessionId);
        if (!result.paid) {
          return { success: false, paid: false, error: `Payment not completed (status: ${result.rawStatus})` };
        }
        const resolvedPlan = planId || result.planId || 'starter';
        const billing = activatePlanAfterPayment(store, {
          planId: resolvedPlan,
          billingEmail: result.customerEmail,
          provider: 'stripe',
          externalId: result.subscriptionId || sessionId,
          note: `Stripe subscription active`,
        });
        store.removeItem('pendingPaymentCheckout');
        return { success: true, paid: true, billing };
      }

      if (provider === 'paypal') {
        const subscriptionId = input?.subscriptionId;
        result = await paypalBilling.verifySubscription(keys, mode, subscriptionId);
        if (!result.paid) {
          return { success: false, paid: false, error: `PayPal subscription not active (status: ${result.status})` };
        }
        const resolvedPlan = planId || 'starter';
        const billing = activatePlanAfterPayment(store, {
          planId: resolvedPlan,
          billingEmail: result.customerEmail,
          provider: 'paypal',
          externalId: result.subscriptionId,
          note: `PayPal subscription ${result.status}`,
        });
        store.removeItem('pendingPaymentCheckout');
        return { success: true, paid: true, billing };
      }

      return { success: false, error: 'Unknown payment provider' };
    } catch (e) {
      console.error('verify-subscription-payment error:', e.response?.data || e.message);
      return { success: false, error: e.response?.data?.message || e.message };
    }
  });

  async function handlePaymentProtocolUrl(url) {
    try {
      if (!url || !url.startsWith('social-imperialism://')) return null;
      const rest = url.slice('social-imperialism://'.length);
      const [pathPart, queryPart] = rest.split('?');
      const path = (pathPart || '').split('/')[0];
      if (path === 'payment-cancel') return { cancelled: true };
      if (path !== 'payment-success') return null;

      const params = new URLSearchParams(queryPart || '');
      const provider = params.get('provider');
      const planId = params.get('plan');
      const sessionId = params.get('session_id');
      const subscriptionId = params.get('subscription_id') || params.get('ba_token') || params.get('token');

      let pending = {};
      try { pending = JSON.parse(store.getItem('pendingPaymentCheckout') || '{}'); } catch (e) {}

      const verifyInput = {
        provider: provider || pending.provider,
        planId: planId || pending.planId,
        sessionId: sessionId || pending.sessionId,
        subscriptionId: subscriptionId || pending.subscriptionId,
      };

      if (verifyInput.provider === 'paypal' && !verifyInput.subscriptionId) {
        return { success: false, error: 'Missing PayPal subscription ID — click Verify Payment in Settings after approving in PayPal.' };
      }

      const settings = loadPaymentSettings(store);
      const keys = loadMerchantKeys(store);
      const mode = settings.mode === 'test' ? 'test' : 'live';

      let billing;
      if (verifyInput.provider === 'stripe' && verifyInput.sessionId) {
        const result = await stripeBilling.verifyCheckoutSession(keys.stripeSecretKey, verifyInput.sessionId);
        if (!result.paid) return { success: false, paid: false, status: result.rawStatus };
        billing = activatePlanAfterPayment(store, {
          planId: verifyInput.planId || result.planId || 'starter',
          billingEmail: result.customerEmail,
          provider: 'stripe',
          externalId: result.subscriptionId || verifyInput.sessionId,
        });
      } else if (verifyInput.provider === 'paypal' && verifyInput.subscriptionId) {
        const result = await paypalBilling.verifySubscription(keys, mode, verifyInput.subscriptionId);
        if (!result.paid) return { success: false, paid: false, status: result.status };
        billing = activatePlanAfterPayment(store, {
          planId: verifyInput.planId || 'starter',
          billingEmail: result.customerEmail,
          provider: 'paypal',
          externalId: result.subscriptionId,
        });
      } else {
        return null;
      }

      store.removeItem('pendingPaymentCheckout');
      if (typeof onPaymentComplete === 'function') onPaymentComplete(billing);
      return { success: true, paid: true, billing };
    } catch (e) {
      console.error('handlePaymentProtocolUrl error:', e.message);
      return { success: false, error: e.message };
    }
  }

  console.log('[billingPaymentsIpc] Registered payment handlers (Stripe + PayPal)');
  return { handlePaymentProtocolUrl, activatePlanAfterPayment };
}

module.exports = { registerBillingPaymentHandlers, PROTOCOL_SUCCESS, PROTOCOL_CANCEL };