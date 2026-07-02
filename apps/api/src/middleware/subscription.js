const { userHasActiveSubscription, isAdminEmail } = require('../subscriptionAccess');

/** IPC channels allowed without an active subscription (billing recovery). */
const SUBSCRIPTION_EXEMPT_CHANNELS = new Set([
  'create-subscription-checkout',
  'get-billing-plan',
  'save-billing-email',
  'test-payment-connections',
  'get-payment-settings',
]);

async function requireActiveSubscription(req, res, next) {
  try {
    const email = req.user?.email;
    if (isAdminEmail(email)) return next();

    const access = await userHasActiveSubscription(req.user.userId, email);
    if (!access.ok) {
      const billing = access.billing || {};
      if (billing.pendingPasswordSetup) {
        return res.status(403).json({
          error: 'Complete account setup with your subscription email.',
          code: 'PASSWORD_SETUP_REQUIRED',
          setupUrl: `/setup-account?email=${encodeURIComponent(email || '')}`,
        });
      }
      return res.status(403).json({
        error: access.error || 'Active subscription required.',
        code: 'SUBSCRIPTION_REQUIRED',
        subscribeUrl: '/subscribe',
      });
    }
    req.subscription = access;
    return next();
  } catch (e) {
    return res.status(500).json({ error: e.message || 'Subscription check failed' });
  }
}

function requireActiveSubscriptionForInvoke(req, res, next) {
  const channel = req.params.channel;
  if (SUBSCRIPTION_EXEMPT_CHANNELS.has(channel)) return next();
  return requireActiveSubscription(req, res, next);
}

module.exports = {
  requireActiveSubscription,
  requireActiveSubscriptionForInvoke,
  SUBSCRIPTION_EXEMPT_CHANNELS,
};