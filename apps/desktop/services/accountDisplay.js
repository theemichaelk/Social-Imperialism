/**
 * Enrich linked accounts for Account Hub UI — counts, health, and detail lines.
 */
const { getAutomationTargets, getChildAccounts } = require('./accountAutomation');

function formatTs(iso) {
  if (!iso) return null;
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

function profileHealth(profile) {
  if (!profile) return { status: 'unknown', label: 'Not refreshed' };
  if (profile.needsRelink || profile.authStatus) {
    return { status: 'relink', label: profile.authStatus || 'Re-link required' };
  }
  if (profile.apiNote || profile.discoveryNote) {
    return { status: 'warn', label: profile.apiNote || profile.discoveryNote };
  }
  const hasData = profile.followers && profile.followers !== '—';
  return hasData
    ? { status: 'ok', label: 'Live profile data' }
    : { status: 'partial', label: 'Limited metrics from platform API' };
}

function buildDetailLines(account, targets) {
  const lines = [];
  // One Login line only (never duplicate email/username as multiple “Login” rows)
  const login = account.loginEmail || account.username || null;
  if (login) lines.push({ key: 'Login', value: login });
  if (account.handle && account.handle !== login && !String(account.handle).includes('@')) {
    lines.push({ key: 'Handle', value: account.handle });
  }
  if (account.encryptedPassword || account.hasSavedLogin) {
    lines.push({ key: 'Password', value: 'Saved for automations' });
  }
  if (account.authMethod) lines.push({ key: 'Auth method', value: String(account.authMethod) });
  if (account.connectionId) lines.push({ key: 'Connection', value: account.connectionId });
  if (account.orgUrn) lines.push({ key: 'Org URN', value: account.orgUrn });
  if (account.subreddit) lines.push({ key: 'Subreddit', value: `r/${account.subreddit}` });
  if (account.linkedAt) lines.push({ key: 'Linked', value: formatTs(account.linkedAt) });
  if (account.profileRefreshedAt) lines.push({ key: 'Profile refreshed', value: formatTs(account.profileRefreshedAt) });
  if (account.subAccountsRefreshedAt) lines.push({ key: 'Sub-accounts scanned', value: formatTs(account.subAccountsRefreshedAt) });
  if (account.status) lines.push({ key: 'Status', value: account.status });
  if (account.useProxy && account.proxyId) lines.push({ key: 'Proxy', value: account.proxyId });
  if (account.settings?.lastActionAt) {
    lines.push({ key: 'Last action', value: formatTs(account.settings.lastActionAt) });
  }
  if (account.settings?.actionCount != null) {
    lines.push({ key: 'Actions run', value: String(account.settings.actionCount) });
  }
  if (account.settings?.frequency) lines.push({ key: 'Frequency', value: account.settings.frequency });
  if (targets?.length) lines.push({ key: 'Automation targets', value: String(targets.length) });
  if (account.discoveryWarnings?.length) {
    lines.push({ key: 'Discovery notes', value: account.discoveryWarnings.slice(0, 2).join(' · ') });
  }
  if (account.lastApiNote) {
    lines.push({ key: 'API note', value: account.lastApiNote });
  }
  if (account.profile?.apiNote && account.profile.apiNote !== account.lastApiNote) {
    lines.push({ key: 'Profile API', value: account.profile.apiNote });
  }
  // Dedupe by key so UI never shows 3× “Login”
  const seen = new Set();
  return lines.filter((line) => {
    const k = String(line.key).toLowerCase();
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

function enrichLinkedAccount(account, allAccounts = []) {
  if (!account) return null;
  const targets = getAutomationTargets(account, allAccounts);
  const children = getChildAccounts(allAccounts, account.id);
  const groups = account.groups || [];
  const health = profileHealth(account.profile);
  const groupTargets = targets.filter((t) => t.source === 'group');
  const accountTargets = targets.filter((t) => t.source !== 'group');

  return {
    ...account,
    displayName: account.handle || account.username || account.id,
    hasSavedLogin: !!(account.encryptedPassword || account.hasSavedLogin),
    health,
    counts: {
      automationTargets: targets.length,
      accountTargets: accountTargets.length,
      groupTargets: groupTargets.length,
      storedGroups: groups.length,
      childAccounts: children.length,
      enabledTargets: targets.filter((t) => t.automationEnabled !== false).length,
    },
    detailLines: buildDetailLines(account, targets),
    targetsPreview: targets.slice(0, 12).map((t) => ({
      id: t.id,
      name: t.name,
      type: t.type,
      platform: t.platform,
      source: t.source,
      subreddit: t.subreddit || null,
      privacy: t.privacy || null,
      linked: t.linked !== false,
      automationEnabled: t.automationEnabled !== false,
    })),
    childrenPreview: children.slice(0, 8).map((c) => ({
      id: c.id,
      platform: c.platform,
      handle: c.handle,
      type: c.type,
    })),
    groupsPreview: groups.slice(0, 12).map((g) => ({
      id: g.id,
      name: g.name || g.handle,
      type: g.type,
      platform: g.platform,
      memberCount: g.memberCount || null,
      privacy: g.privacy || null,
    })),
  };
}

function enrichLinkedAccounts(accounts) {
  const list = Array.isArray(accounts) ? accounts : [];
  return list.map((acc) => enrichLinkedAccount(acc, list));
}

/** Strip secrets before SaaS/web responses (desktop Electron keeps full store). */
function stripAccountSecrets(account) {
  if (!account || typeof account !== 'object') return account;
  const { encryptedTokens, encryptedPassword, ...safe } = account;
  return {
    ...safe,
    hasSavedLogin: !!(encryptedPassword || account.hasSavedLogin),
    hasApiToken: !!encryptedTokens,
  };
}

function enrichLinkedAccountsPublic(accounts) {
  return enrichLinkedAccounts(accounts).map(stripAccountSecrets);
}

module.exports = {
  enrichLinkedAccount,
  enrichLinkedAccounts,
  enrichLinkedAccountsPublic,
  stripAccountSecrets,
  profileHealth,
  buildDetailLines,
};