const twitter = require('./platforms/twitter');
const linkedin = require('./platforms/linkedin');
const meta = require('./platforms/meta');
const quora = require('./platforms/quora');
const reddit = require('./platforms/reddit');
const { parseTokens } = require('./intelligenceProfile');
const { pickEngagementAccount } = require('./accountAutomation');
const { waitBeforeAction } = require('./humanBehavior');

function resolveEngagementAccount(linkedAccounts, payload, rules, store) {
  if (payload.accountId) {
    return linkedAccounts.find((a) => a.id === payload.accountId) || null;
  }
  return pickEngagementAccount(linkedAccounts, payload.platform, rules, store);
}

async function engagePost(payload, keys, linkedAccounts, rules = null, store = null) {
  const account = resolveEngagementAccount(linkedAccounts, payload, rules, store);
  const tokens = account ? parseTokens(account) : null;
  const accessToken = tokens?.access_token;

  if (account?.settings?.automationEnabled !== false && store) {
    await waitBeforeAction(account.settings);
  }

  const platform = payload.platform || account?.platform;

  switch (platform) {
    case 'Twitter':
    case 'X':
    case 'Twitter / X':
      return twitter.engage(payload, keys, accessToken);

    case 'LinkedIn':
      return linkedin.engage({
        ...payload,
        action: payload.action === 'reply' ? 'comment' : payload.action,
        accessToken: accessToken || keys.linkedinAccessToken,
      }, accessToken || keys.linkedinAccessToken);

    case 'Facebook':
    case 'Facebook Group':
    case 'Facebook Page':
      return meta.engage(payload, accessToken || keys.metaAccess);

    case 'Reddit':
      return reddit.engage(payload, keys, accessToken);

    case 'Quora':
      return quora.engage(payload, keys, tokens, account);

    default:
      throw new Error(`Engagement not supported for ${platform}. Link an account in Account Hub.`);
  }
}

module.exports = { engagePost, resolveEngagementAccount };