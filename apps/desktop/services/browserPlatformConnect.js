/**
 * Browser-first platform connect — open the user's browser (full tab),
 * prefill login where possible, complete OAuth/session, then pull full account details.
 */
const oauth = require('./oauth');
const oauthFlowStore = require('./oauthFlowStore');
const { resolveKeys, hasStoredConnectToken } = require('./keys');
const { looksLikeLoginPassword, looksLikeAccessToken, encryptCredential } = require('./credentialAuth');
const { discoverAccounts } = require('./accountDiscovery');
const { linkAllDiscoveredAccounts } = require('./accountAutomation');
const { platformOAuthReady } = require('./accountHub');

/** Login pages + selectors for native browser autofill (desktop / local automation). */
const LOGIN_FLOWS = {
  LinkedIn: {
    loginUrl: 'https://www.linkedin.com/login',
    email: ['#username', 'input[name="session_key"]', 'input[type="email"]'],
    password: ['#password', 'input[name="session_password"]', 'input[type="password"]'],
    submit: ['button[type="submit"]', 'button[data-litms-control-urn="login-submit"]'],
  },
  Facebook: {
    loginUrl: 'https://www.facebook.com/login',
    email: ['#email', 'input[name="email"]'],
    password: ['#pass', 'input[name="pass"]'],
    submit: ['button[name="login"]', 'button[type="submit"]'],
  },
  Instagram: {
    loginUrl: 'https://www.instagram.com/accounts/login/',
    email: ['input[name="username"]', 'input[type="text"]'],
    password: ['input[name="password"]', 'input[type="password"]'],
    submit: ['button[type="submit"]'],
  },
  Twitter: {
    loginUrl: 'https://x.com/i/flow/login',
    email: ['input[autocomplete="username"]', 'input[name="text"]', 'input[type="text"]'],
    password: ['input[name="password"]', 'input[type="password"]'],
    submit: ['button[type="button"]', 'button[data-testid="LoginForm_Login_Button"]'],
  },
  X: {
    loginUrl: 'https://x.com/i/flow/login',
    email: ['input[autocomplete="username"]', 'input[name="text"]'],
    password: ['input[name="password"]', 'input[type="password"]'],
    submit: ['button[type="button"]'],
  },
  Reddit: {
    loginUrl: 'https://www.reddit.com/login/',
    email: ['input[name="username"]', '#loginUsername', 'input[type="text"]'],
    password: ['input[name="password"]', '#loginPassword', 'input[type="password"]'],
    submit: ['button[type="submit"]'],
  },
  YouTube: {
    loginUrl: 'https://accounts.google.com/ServiceLogin?service=youtube',
    email: ['input[type="email"]', '#identifierId'],
    password: ['input[type="password"]', 'input[name="Passwd"]'],
    submit: ['button', '#identifierNext', '#passwordNext'],
  },
  Quora: {
    loginUrl: 'https://www.quora.com/',
    email: ['input[type="email"]', 'input[name="email"]'],
    password: ['input[type="password"]', 'input[name="password"]'],
    submit: ['button[type="submit"]', 'button.qu-bg--blue'],
  },
  Pinterest: {
    loginUrl: 'https://www.pinterest.com/login/',
    email: ['input[type="email"]', 'input[id="email"]'],
    password: ['input[type="password"]', 'input[id="password"]'],
    submit: ['button[type="submit"]'],
  },
  TikTok: {
    loginUrl: 'https://www.tiktok.com/login',
    email: ['input[type="text"]', 'input[name="username"]'],
    password: ['input[type="password"]'],
    submit: ['button[type="submit"]'],
  },
  Twitch: {
    loginUrl: 'https://www.twitch.tv/login',
    email: ['input[id="login-username"]', 'input[autocomplete="username"]'],
    password: ['input[id="password-input"]', 'input[type="password"]'],
    submit: ['button[data-a-target="passport-login-button"]', 'button[type="submit"]'],
  },
  Discord: {
    loginUrl: 'https://discord.com/login',
    email: ['input[name="email"]', 'input[type="email"]'],
    password: ['input[name="password"]', 'input[type="password"]'],
    submit: ['button[type="submit"]'],
  },
  Threads: {
    loginUrl: 'https://www.threads.net/login',
    email: ['input[type="text"]', 'input[name="username"]'],
    password: ['input[type="password"]'],
    submit: ['button[type="submit"]'],
  },
  Snapchat: {
    loginUrl: 'https://accounts.snapchat.com/accounts/v2/login',
    email: ['input[name="accountIdentifier"]', 'input[type="text"]', 'input[type="email"]'],
    password: ['input[type="password"]', 'input[name="password"]'],
    submit: ['button[type="submit"]'],
  },
  WhatsApp: {
    loginUrl: 'https://business.facebook.com/latest/whatsapp_manager',
    email: ['input[type="email"]', '#email'],
    password: ['input[type="password"]', '#pass'],
    submit: ['button[type="submit"]', 'button[name="login"]'],
  },
  Telegram: {
    loginUrl: 'https://web.telegram.org/',
    email: [],
    password: [],
    submit: [],
  },
};

function delay(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function isSaasMode() {
  // Desktop Electron must still be able to launch native browser fill
  return process.env.SAAS_MODE === '1' || process.env.SI_RUNTIME === 'saas';
}

async function tryFill(page, selectors, value) {
  if (!value) return false;
  for (const sel of selectors) {
    try {
      const el = await page.$(sel);
      if (el) {
        await el.click({ clickCount: 3 }).catch(() => {});
        await el.type(String(value), { delay: 28 });
        return true;
      }
    } catch {
      /* next */
    }
  }
  return false;
}

async function tryClick(page, selectors) {
  for (const sel of selectors) {
    try {
      const el = await page.$(sel);
      if (el) {
        await el.click();
        return true;
      }
    } catch {
      /* next */
    }
  }
  return false;
}

/**
 * Open system browser and autofill login on OAuth authorize or platform login page (desktop).
 * On SaaS / headless hosts this is skipped — client opens the URL instead.
 */
async function autofillInNativeBrowser({
  store,
  userDataPath,
  openUrl,
  platform,
  email,
  password,
  openExternal,
}) {
  if (!store || !userDataPath) {
    if (typeof openExternal === 'function' && openUrl) {
      await openExternal(openUrl);
      return { mode: 'external', filled: false };
    }
    return { mode: 'client', filled: false };
  }

  try {
    const nativeBrowser = require('./nativeBrowserLauncher');
    const session = await nativeBrowser.launchNativeBrowser({
      store,
      userDataPath,
      profileKey: `connect_${String(platform).toLowerCase().replace(/[^a-z0-9]+/g, '_')}`,
      headless: false,
      reuseActive: false,
    });
    const page = session.page;
    await page.goto(openUrl, { waitUntil: 'domcontentloaded', timeout: 90000 });
    await delay(1500);

    const flow = LOGIN_FLOWS[platform] || LOGIN_FLOWS[platform === 'X' ? 'Twitter' : platform];
    let filledEmail = false;
    let filledPassword = false;

    if (flow && email) {
      filledEmail = await tryFill(page, flow.email, email);
      // Some flows (X/Google) need Next after email
      if (filledEmail && (platform === 'Twitter' || platform === 'X' || platform === 'YouTube')) {
        await tryClick(page, flow.submit);
        await delay(1200);
      }
    }
    if (flow && password && looksLikeLoginPassword(password)) {
      filledPassword = await tryFill(page, flow.password, password);
      if (filledPassword) {
        await delay(400);
        await tryClick(page, flow.submit);
      }
    }

    return {
      mode: 'native',
      filled: filledEmail || filledPassword,
      filledEmail,
      filledPassword,
      note: filledPassword
        ? 'Browser opened and credentials filled — complete any CAPTCHA / 2FA in that window.'
        : filledEmail
          ? 'Browser opened with email filled — enter password / approve access in that window.'
          : 'Browser opened — sign in and approve access in that window.',
    };
  } catch (e) {
    if (typeof openExternal === 'function' && openUrl) {
      await openExternal(openUrl);
    }
    return { mode: 'external-fallback', filled: false, error: e.message };
  }
}

/**
 * Start browser-first connect for a platform.
 * Returns oauthUrl/state for client to open a full browser tab and poll.
 */
async function beginBrowserPlatformConnect({
  platform,
  email,
  username,
  password,
  keys: rawKeys,
  store,
  userDataPath,
  openExternal,
  useProxy,
  proxyId,
  preferNativeFill = true,
}) {
  if (!platform) return { success: false, error: 'Platform required' };

  const keys = resolveKeys(rawKeys || {});
  const oauthMap = platformOAuthReady(keys);
  const canOAuth = oauthMap[platform] === true;
  const loginEmail = (email || username || '').trim().toLowerCase() || null;
  const pw = (password || '').trim();

  // Token-only path (AQW… / EAA…) — no browser, direct discover
  if (pw && looksLikeAccessToken(pw) && !looksLikeLoginPassword(pw)) {
    return {
      success: true,
      mode: 'token',
      needsBrowser: false,
      platform,
      message: 'Access token detected — linking without browser…',
    };
  }

  // Bot / special token platforms without OAuth
  if (platform === 'Telegram' || platform === 'WhatsApp') {
    return {
      success: true,
      mode: 'token',
      needsBrowser: false,
      platform,
      message: `${platform} uses API tokens — linking directly…`,
    };
  }

  if (canOAuth) {
    const prepared = await oauth.prepareOAuthFlow(platform, keys, {
      loginHint: loginEmail || undefined,
    });
    const projectId = store.projectId || store.getItem('activeCampaignId');
    if (!projectId) return { success: false, error: 'No active project' };

    await oauthFlowStore.saveFlow(projectId, prepared.state, {
      platform: prepared.platform,
      pkceVerifier: prepared.pkce.verifier,
      redirectUri: prepared.redirectUri,
      loginEmail,
      proxyId: proxyId || null,
      useProxy: useProxy === true,
      browserConnect: true,
      hasPasswordForFill: !!(pw && looksLikeLoginPassword(pw)),
    });

    let fillResult = { mode: 'client', filled: false };
    // Desktop: open native browser and try to fill OAuth login form
    if (preferNativeFill && !isSaasMode() && userDataPath && store) {
      fillResult = await autofillInNativeBrowser({
        store,
        userDataPath,
        openUrl: prepared.authUrl,
        platform,
        email: loginEmail,
        password: pw,
        openExternal,
      });
    }

    return {
      success: true,
      mode: 'oauth',
      needsBrowser: true,
      openInBrowser: true,
      fullTab: true,
      oauthUrl: prepared.authUrl,
      openUrl: prepared.authUrl,
      state: prepared.state,
      platform,
      loginEmail,
      autofill: fillResult,
      message: fillResult.note
        || (loginEmail
          ? `Opening ${platform} in your browser — email will be prefilled when supported. Sign in and approve access.`
          : `Opening ${platform} in your browser — sign in and approve access to pull all account details.`),
    };
  }

  // OAuth app not configured — open platform login page so user can still use their browser
  const flow = LOGIN_FLOWS[platform];
  if (flow) {
    const projectId = store.projectId || store.getItem('activeCampaignId') || 'default';
    const state = `browser_${platform}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    await oauthFlowStore.saveFlow(projectId, state, {
      platform,
      loginEmail,
      encryptedPassword: pw ? encryptCredential(pw) : null,
      browserLoginOnly: true,
      status: 'awaiting_user_login',
      proxyId: proxyId || null,
      useProxy: useProxy === true,
    });

    let fillResult = { mode: 'client', filled: false };
    if (preferNativeFill && !isSaasMode() && userDataPath && store) {
      fillResult = await autofillInNativeBrowser({
        store,
        userDataPath,
        openUrl: flow.loginUrl,
        platform,
        email: loginEmail,
        password: pw,
        openExternal,
      });
    }

    // SaaS assist page: prefill email via redirect helper when possible
    const webBase = (process.env.WEB_URL || 'https://www.socialimperialism.com').replace(/\/$/, '');
    const assistUrl = `${webBase}/account-hub/browser-connect?platform=${encodeURIComponent(platform)}&state=${encodeURIComponent(state)}&loginUrl=${encodeURIComponent(flow.loginUrl)}${loginEmail ? `&email=${encodeURIComponent(loginEmail)}` : ''}`;

    return {
      success: true,
      mode: 'browser_login',
      needsBrowser: true,
      openInBrowser: true,
      fullTab: true,
      openUrl: isSaasMode() ? assistUrl : flow.loginUrl,
      loginUrl: flow.loginUrl,
      state,
      platform,
      loginEmail,
      autofill: fillResult,
      requiresOAuthApp: true,
      message:
        `${platform} OAuth app is not configured on the server yet. `
        + 'A browser tab will open so you can sign in. '
        + 'For full API access (publish/reply), add Client ID + Secret in Integrations, then use Connect again. '
        + (loginEmail ? `Email on file: ${loginEmail}.` : ''),
    };
  }

  if (hasStoredConnectToken(platform, keys) || (pw && looksLikeAccessToken(pw))) {
    return {
      success: true,
      mode: 'token',
      needsBrowser: false,
      platform,
      message: 'Using saved or pasted access token…',
    };
  }

  return {
    success: false,
    error:
      `Cannot open browser connect for ${platform}. `
      + 'Add Client ID + Secret in Integrations → Social OAuth (for OAuth browser login), '
      + 'or paste a valid access token as password.',
  };
}

/**
 * Save login credentials and create/update a linked account shell with intelligence profile.
 * Used when OAuth app is not configured yet, or as an immediate save before browser OAuth finishes.
 */
async function saveCredentialLinkedAccount({
  store,
  integrations,
  keys: rawKeys,
  platform,
  email,
  username,
  password,
  useProxy,
  proxyId,
  authMethod = 'credentials_saved',
  oauthTokens = null,
}) {
  if (!platform) return { success: false, error: 'Platform required' };
  const keys = resolveKeys(rawKeys || {});
  const loginEmail = (email || username || '').trim().toLowerCase();
  const handleRaw = (username || email || platform).trim();
  const handle = handleRaw.startsWith('@') ? handleRaw : (handleRaw.includes('@') ? handleRaw.split('@')[0] : handleRaw);
  if (!loginEmail && !username) {
    return { success: false, error: 'Email or username is required to save this account.' };
  }
  const pw = (password || '').trim();
  if (!pw && !oauthTokens) {
    return { success: false, error: 'Password or access token is required to save credentials.' };
  }

  const { makeConnectionId, encryptCredential, looksLikeAccessToken } = require('./credentialAuth');
  const connectionId = makeConnectionId(platform, loginEmail || handle || platform);
  const encryptedPassword = pw ? encryptCredential(pw) : null;
  const tokenPayload = oauthTokens
    ? Buffer.from(JSON.stringify(oauthTokens)).toString('base64')
    : (pw && looksLikeAccessToken(pw)
      ? Buffer.from(JSON.stringify({ access_token: pw })).toString('base64')
      : null);

  const stub = {
    id: `acc_${platform.toLowerCase().replace(/[^a-z0-9]+/g, '_')}_${Date.now().toString(36)}`,
    platform,
    handle: handle || loginEmail || platform,
    type: platform === 'Telegram' ? 'Bot' : platform === 'WhatsApp' ? 'Business' : 'Profile',
    loginEmail: loginEmail || null,
    username: username || null,
    connectionId,
    encryptedTokens: tokenPayload,
    encryptedPassword,
    authMethod,
    status: 'connected',
    linkedAt: new Date().toISOString(),
    useProxy: useProxy === true,
    proxyId: useProxy ? (proxyId || null) : null,
  };

  // Prefer full discovery when we have a token / bot credential
  let discovered = null;
  try {
    if (tokenPayload || (pw && looksLikeAccessToken(pw)) || platform === 'Telegram' || platform === 'WhatsApp') {
      discovered = await discoverAccounts({
        platform,
        email: loginEmail,
        username: username || handle,
        password: pw,
        useCredentials: true,
        connectionId,
        oauthTokens: oauthTokens || undefined,
      }, keys, () => {});
    }
  } catch (e) {
    /* fall through to stub save */
    discovered = null;
  }

  if (discovered?.length) {
    const linkRes = await linkAllDiscoveredAccounts({
      store,
      integrations,
      keys,
      discovered: discovered.map((a) => ({
        ...a,
        loginEmail: a.loginEmail || loginEmail,
        connectionId: a.connectionId || connectionId,
        proxyId: useProxy ? (proxyId || null) : null,
      })),
      meta: {
        loginEmail,
        connectionId,
        encryptedPassword,
        proxyId: useProxy ? proxyId : null,
        sharedTokens: discovered[0]?.encryptedTokens || tokenPayload,
      },
    });
    const linked = linkRes.linked || [];
    const enriched = [];
    for (const acc of linked) {
      try {
        if (integrations.refreshAccountProfile) {
          const refreshed = await integrations.refreshAccountProfile(store, acc.id, keys);
          enriched.push(refreshed?.account || acc);
        } else if (integrations.buildIntelligenceProfile) {
          const profile = await integrations.buildIntelligenceProfile(acc, keys);
          enriched.push({ ...acc, profile, profileRefreshedAt: new Date().toISOString() });
        } else {
          enriched.push(acc);
        }
      } catch {
        enriched.push(acc);
      }
    }
    return {
      success: true,
      linked: enriched.length,
      accounts: enriched,
      autoLinked: true,
      platform,
      savedCredentials: true,
      message: `Saved ${platform} credentials and linked ${enriched.length} account(s) with profile details for automations.`,
    };
  }

  // Credential shell — still useful for automations that use browser session / handle targeting
  let profile = null;
  try {
    if (integrations.buildIntelligenceProfile) {
      profile = await integrations.buildIntelligenceProfile(stub, keys);
    }
  } catch {
    profile = null;
  }
  if (!profile) {
    profile = {
      followers: '—',
      likes: '—',
      bestTime: 'Session-based',
      topTrendingNiche: platform,
      growthVelocity: 'Credentials saved',
      suggestedGroups: [],
      discoveryNote: 'Login saved — complete OAuth in Integrations for full API metrics, or use browser automation with this account.',
      authMethod,
      handle: stub.handle,
      loginEmail: stub.loginEmail,
    };
  }

  const entry = {
    ...stub,
    profile,
    profileRefreshedAt: new Date().toISOString(),
    settings: {
      frequency: 'auto',
      autoReply: false,
      automationEnabled: true,
      activeGroupIds: [],
    },
  };

  const { getLinkedAccounts, saveLinkedAccounts } = require('./accountAutomation');
  let accounts = getLinkedAccounts(store);
  // Upsert by platform + loginEmail/handle
  const existingIdx = accounts.findIndex((a) => (
    a.platform === platform
    && !a.parentAccountId
    && (
      (loginEmail && a.loginEmail === loginEmail)
      || (a.handle && a.handle === entry.handle)
    )
  ));
  if (existingIdx >= 0) {
    accounts[existingIdx] = {
      ...accounts[existingIdx],
      ...entry,
      id: accounts[existingIdx].id,
      encryptedTokens: entry.encryptedTokens || accounts[existingIdx].encryptedTokens,
      encryptedPassword: entry.encryptedPassword || accounts[existingIdx].encryptedPassword,
      groups: accounts[existingIdx].groups || [],
    };
    entry.id = accounts[existingIdx].id;
  } else {
    accounts.push(entry);
  }
  if (useProxy && proxyId) {
    try {
      const proxyManager = require('./proxyManager');
      proxyManager.assignProxyToAccount(store, proxyId, entry.id);
    } catch { /* optional */ }
  }
  saveLinkedAccounts(store, null, accounts);

  const { enrichLinkedAccount } = require('./accountDisplay');
  return {
    success: true,
    linked: 1,
    accounts: [enrichLinkedAccount(entry, accounts)],
    autoLinked: true,
    platform,
    savedCredentials: true,
    needsOAuthSetup: !tokenPayload,
    message: tokenPayload
      ? `Saved ${platform} account and pulled available profile details for automations.`
      : `Saved ${platform} login (${loginEmail || handle}) for automations. Add Client ID + Secret in Integrations, then OAuth Connect to unlock full API pages/groups — credentials stay on file.`,
  };
}

/**
 * After browser OAuth completes — link every discovered account and enrich profiles.
 */
async function finishBrowserPlatformConnect({
  state,
  platform: platformHint,
  email,
  username,
  password,
  keys: rawKeys,
  store,
  integrations,
  useProxy,
  proxyId,
  autoLinkAll = true,
}) {
  const flow = await oauthFlowStore.getFlow(state);
  if (!flow) {
    return { success: false, error: 'Browser session expired — start Connect again' };
  }

  if (flow.browserLoginOnly) {
    // Persist credentials + account shell so automations can use login/handle even without OAuth app yet
    let plainPassword = password || null;
    if (!plainPassword && flow.encryptedPassword) {
      try {
        plainPassword = Buffer.from(flow.encryptedPassword, 'base64').toString('utf8');
      } catch {
        plainPassword = null;
      }
    }
    const saved = await saveCredentialLinkedAccount({
      store,
      integrations,
      keys: rawKeys,
      platform: flow.platform || platformHint,
      email: flow.loginEmail || email,
      username,
      password: plainPassword,
      useProxy: useProxy === true || flow.useProxy,
      proxyId: proxyId || flow.proxyId,
      authMethod: 'browser_credentials',
    });
    await oauthFlowStore.removeFlow(state).catch(() => {});
    return {
      ...saved,
      browserConnect: true,
      needsOAuthSetup: saved.needsOAuthSetup !== false,
    };
  }

  if (flow.status !== 'complete' || !flow.tokens) {
    return { success: false, error: 'Authorization not complete yet — finish signing in in the browser tab' };
  }

  const keys = resolveKeys(rawKeys || {});
  const platform = flow.platform || platformHint;
  const loginEmail = (flow.loginEmail || email || username || `${String(platform).toLowerCase()}@oauth.local`).trim().toLowerCase();

  const discovered = await discoverAccounts({
    platform,
    email: loginEmail,
    username: username || loginEmail,
    useCredentials: false,
    oauthTokens: flow.tokens,
  }, keys, () => {});

  await oauthFlowStore.removeFlow(state);

  if (!discovered?.length) {
    return { success: false, error: `No accounts returned from ${platform} after browser login` };
  }

  const withProxy = discovered.map((a) => ({
    ...a,
    loginEmail: a.loginEmail || loginEmail,
    useProxy: useProxy === true || flow.useProxy,
    proxyId: (useProxy || flow.useProxy) ? (proxyId || flow.proxyId) : null,
  }));

  let encryptedPassword = null;
  if (flow.encryptedPassword) encryptedPassword = flow.encryptedPassword;
  else if (password) {
    const { encryptCredential } = require('./credentialAuth');
    encryptedPassword = encryptCredential(password);
  }

  // Always auto-link every discovered profile/page/channel
  if (autoLinkAll || withProxy.length === 1) {
    const linkRes = await linkAllDiscoveredAccounts({
      store,
      integrations,
      keys,
      discovered: withProxy,
      meta: {
        loginEmail,
        connectionId: withProxy[0].connectionId,
        encryptedPassword,
        proxyId: (useProxy || flow.useProxy) ? (proxyId || flow.proxyId) : null,
      },
    });

    const linked = linkRes.linked || withProxy;
    // Pull full intelligence profile for each linked account
    const enriched = [];
    for (const acc of linked) {
      try {
        if (integrations.refreshAccountProfile) {
          const refreshed = await integrations.refreshAccountProfile(store, acc.id, keys);
          enriched.push(refreshed?.account || acc);
        } else if (integrations.buildIntelligenceProfile) {
          const profile = await integrations.buildIntelligenceProfile(acc, keys);
          enriched.push({ ...acc, profile });
        } else {
          enriched.push(acc);
        }
      } catch {
        enriched.push(acc);
      }
    }

    return {
      success: true,
      linked: enriched.length,
      accounts: enriched,
      autoLinked: true,
      browserConnect: true,
      savedCredentials: !!encryptedPassword,
      platform,
      message: `Linked ${enriched.length} ${platform} account(s) and pulled profile details for automations.`,
    };
  }

  return { success: true, accounts: withProxy, needsSelection: true, platform };
}

module.exports = {
  LOGIN_FLOWS,
  beginBrowserPlatformConnect,
  finishBrowserPlatformConnect,
  saveCredentialLinkedAccount,
  autofillInNativeBrowser,
  isSaasMode,
};
