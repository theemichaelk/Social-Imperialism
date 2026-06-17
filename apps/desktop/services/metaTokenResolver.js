const { parseTokens } = require('./intelligenceProfile');

function decodeBase64Credential(value) {
  if (!value) return null;
  try {
    return Buffer.from(value, 'base64').toString('utf8');
  } catch (e) {
    return null;
  }
}

function looksLikeMetaToken(value) {
  if (!value || typeof value !== 'string') return false;
  const v = value.trim();
  return (v.startsWith('EAA') || v.startsWith('EAAG')) && v.length >= 20;
}

/**
 * Resolve Meta/Facebook access token from linked account record + global keys.
 */
function resolveMetaAccessToken(account, keys = {}, allAccounts = []) {
  if (!account) return keys.metaAccess || null;

  if (account.accessToken && looksLikeMetaToken(account.accessToken)) {
    return account.accessToken;
  }

  const tokens = parseTokens(account);
  if (tokens?.access_token) return tokens.access_token;

  const fromPassword = decodeBase64Credential(account.encryptedPassword);
  if (looksLikeMetaToken(fromPassword)) return fromPassword;

  if (account.parentAccountId && Array.isArray(allAccounts)) {
    const parent = allAccounts.find((a) => a.id === account.parentAccountId);
    const parentToken = resolveMetaAccessToken(parent, keys, allAccounts);
    if (parentToken) return parentToken;
  }

  if (account.connectionId && Array.isArray(allAccounts)) {
    const sibling = allAccounts.find(
      (a) => a.connectionId === account.connectionId
        && a.id !== account.id
        && (a.type === 'Profile' || a.platform === 'Facebook'),
    );
    const sibToken = resolveMetaAccessToken(sibling, keys, allAccounts);
    if (sibToken) return sibToken;
  }

  return keys.metaAccess || null;
}

module.exports = { resolveMetaAccessToken, looksLikeMetaToken, decodeBase64Credential };