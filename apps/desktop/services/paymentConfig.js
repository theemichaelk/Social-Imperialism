/**
 * Payment merchant credentials — loaded from .env (primary) with optional store overrides.
 * Secrets never leave the main process; renderer receives masked status only.
 */

function maskSecret(value, visible = 4) {
  if (!value || typeof value !== 'string') return '';
  if (value.length <= visible * 2) return '••••••••';
  return value.slice(0, visible) + '••••' + value.slice(-visible);
}

function loadPaymentSettings(store) {
  const defaults = { mode: 'live', defaultProvider: 'stripe' };
  try {
    return { ...defaults, ...JSON.parse(store.getItem('paymentSettings') || '{}') };
  } catch (e) {
    return defaults;
  }
}

function loadMerchantKeys(store) {
  let overrides = {};
  try {
    overrides = JSON.parse(store.getItem('paymentMerchantKeys') || '{}');
  } catch (e) {}

  const mode = loadPaymentSettings(store).mode || process.env.PAYMENT_MODE || 'live';
  const isTest = mode === 'test' || mode === 'sandbox';

  return {
    mode: isTest ? 'test' : 'live',
    paypalEmail: overrides.paypalEmail || process.env.PAYPAL_MERCHANT_EMAIL || 'michaelk@tsbrenterprises.com',
    paypalClientId: overrides.paypalClientId || process.env.PAYPAL_CLIENT_ID || '',
    paypalClientSecret: overrides.paypalClientSecret || process.env.PAYPAL_CLIENT_SECRET || '',
    paypalApiUser: overrides.paypalApiUser || process.env.PAYPAL_API_USERNAME || '',
    paypalApiPassword: overrides.paypalApiPassword || process.env.PAYPAL_API_PASSWORD || '',
    paypalApiSignature: overrides.paypalApiSignature || process.env.PAYPAL_API_SIGNATURE || '',
    paypalIpnUrl: overrides.paypalIpnUrl || process.env.PAYPAL_IPN_URL || '',
    stripePublishableKey: isTest
      ? (overrides.stripePublishableTestKey || process.env.STRIPE_PUBLISHABLE_TEST_KEY || process.env.STRIPE_PUBLISHABLE_KEY || '')
      : (overrides.stripePublishableLiveKey || process.env.STRIPE_PUBLISHABLE_LIVE_KEY || process.env.STRIPE_PUBLISHABLE_KEY || ''),
    stripeSecretKey: isTest
      ? (overrides.stripeSecretTestKey || process.env.STRIPE_SECRET_TEST_KEY || process.env.STRIPE_SECRET_KEY || '')
      : (overrides.stripeSecretLiveKey || process.env.STRIPE_SECRET_LIVE_KEY || process.env.STRIPE_SECRET_KEY || ''),
    stripeWebhookSecret: overrides.stripeWebhookSecret || process.env.STRIPE_WEBHOOK_SECRET || '',
  };
}

function getPayPalApiBase(mode) {
  return mode === 'test' ? 'https://api-m.sandbox.paypal.com' : 'https://api-m.paypal.com';
}

function getPaymentStatus(store) {
  const settings = loadPaymentSettings(store);
  const keys = loadMerchantKeys(store);
  const stripeReady = !!(keys.stripeSecretKey && keys.stripePublishableKey);
  const paypalReady = !!(keys.paypalClientId && keys.paypalClientSecret);
  const paypalLegacyReady = !!(keys.paypalApiUser && keys.paypalApiPassword && keys.paypalApiSignature);

  return {
    mode: settings.mode,
    defaultProvider: settings.defaultProvider,
    stripe: {
      configured: stripeReady,
      publishableKey: maskSecret(keys.stripePublishableKey, 8),
      secretKey: maskSecret(keys.stripeSecretKey, 6),
    },
    paypal: {
      configured: paypalReady,
      legacyConfigured: paypalLegacyReady,
      email: keys.paypalEmail,
      clientId: maskSecret(keys.paypalClientId, 6),
      apiUser: keys.paypalApiUser ? maskSecret(keys.paypalApiUser, 8) : '',
      ipnUrl: keys.paypalIpnUrl || '',
      apiBase: getPayPalApiBase(settings.mode === 'test' ? 'test' : 'live'),
    },
    ready: stripeReady || paypalReady,
  };
}

module.exports = {
  loadPaymentSettings,
  loadMerchantKeys,
  getPaymentStatus,
  getPayPalApiBase,
  maskSecret,
};