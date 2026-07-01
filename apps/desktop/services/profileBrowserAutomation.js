/**
 * Stealth nodriver browser automation — apply profile kits during signup/edit with proxy support.
 */
const path = require('path');
const fs = require('fs');
const os = require('os');
const proxyManager = require('./proxyManager');
const { downloadImageToTemp } = require('./mediaHelpers');
const nativeBrowser = require('./nativeBrowserLauncher');
const nodriverBridge = require('./nodriverBridge');

const PLATFORM_FLOWS = {
  Twitter: {
    signupUrl: 'https://x.com/i/flow/signup',
    editUrl: 'https://x.com/settings/profile',
    nameSelectors: ['input[name="displayName"]', 'input[data-testid="displayName"]', 'input[placeholder*="Name"]'],
    bioSelectors: ['textarea[name="description"]', 'textarea[data-testid="bio"]', 'textarea'],
    avatarInput: 'input[type="file"][accept*="image"]',
    bannerInput: 'input[type="file"][accept*="image"]',
  },
  LinkedIn: {
    signupUrl: 'https://www.linkedin.com/signup',
    editUrl: 'https://www.linkedin.com/in/me/edit/forms/intro/new/',
    nameSelectors: ['input[name="first-name"]', 'input#first-name'],
    bioSelectors: ['textarea[name="summary"]', 'textarea#summary'],
    avatarInput: 'input[type="file"]',
  },
  Facebook: {
    signupUrl: 'https://www.facebook.com/r.php',
    editUrl: 'https://www.facebook.com/profile.php?sk=about_contact_and_basic_info',
    bioSelectors: ['textarea', 'div[contenteditable="true"]'],
    avatarInput: 'input[type="file"][accept*="image"]',
  },
  Instagram: {
    signupUrl: 'https://www.instagram.com/accounts/emailsignup/',
    editUrl: 'https://www.instagram.com/accounts/edit/',
    bioSelectors: ['textarea[name="biography"]', 'textarea'],
    avatarInput: 'input[type="file"]',
  },
  YouTube: {
    signupUrl: 'https://accounts.google.com/signup',
    editUrl: 'https://studio.youtube.com/',
    bioSelectors: ['textarea', 'div[contenteditable="true"]'],
  },
  TikTok: {
    signupUrl: 'https://www.tiktok.com/signup',
    editUrl: 'https://www.tiktok.com/profile/edit',
    bioSelectors: ['textarea', 'div[contenteditable="true"]'],
    avatarInput: 'input[type="file"]',
  },
  Pinterest: {
    signupUrl: 'https://www.pinterest.com/signup/',
    editUrl: 'https://www.pinterest.com/settings/profile',
    bioSelectors: ['textarea', 'input'],
    avatarInput: 'input[type="file"]',
  },
  Reddit: {
    signupUrl: 'https://www.reddit.com/register/',
    editUrl: 'https://www.reddit.com/settings/profile',
    bioSelectors: ['textarea'],
    avatarInput: 'input[type="file"]',
  },
  Quora: {
    signupUrl: 'https://www.quora.com/signup',
    editUrl: 'https://www.quora.com/settings',
    bioSelectors: ['textarea', 'div[contenteditable="true"]'],
    avatarInput: 'input[type="file"][accept*="image"]',
  },
};

async function launchBrowser(proxy, headless = false, { store, userDataPath, kitId } = {}) {
  if (store && userDataPath) {
    const session = await nativeBrowser.launchNativeBrowser({
      store,
      userDataPath,
      profileKey: `social_${kitId || 'kit'}`,
      headless,
      reuseActive: false,
    });
    return session.browser;
  }

  const args = [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-blink-features=AutomationControlled',
    '--window-size=1280,900',
  ];
  if (proxy?.host && proxy?.port) {
    const proto = proxy.protocol === 'socks5' ? 'socks5' : 'http';
    args.push(`--proxy-server=${proto}://${proxy.host}:${proxy.port}`);
  }

  const { browser } = await nodriverBridge.launch({
    headless,
    args,
    defaultViewport: { width: 1280, height: 900 },
  });
  return browser;
}

async function tryFill(page, selectors, value) {
  if (!value) return false;
  for (const sel of selectors) {
    try {
      const el = await page.$(sel);
      if (el) {
        await el.click({ clickCount: 3 });
        await el.type(String(value), { delay: 20 });
        return true;
      }
    } catch (e) { /* next */ }
  }
  return false;
}

async function tryUploadFile(page, selector, filePath) {
  if (!filePath || !fs.existsSync(filePath)) return false;
  try {
    const input = await page.$(selector);
    if (input) {
      await input.uploadFile(filePath);
      return true;
    }
  } catch (e) { /* ignore */ }
  return false;
}

async function applyPlatformProfile(page, platform, kit, mode = 'edit') {
  const flow = PLATFORM_FLOWS[platform];
  if (!flow) return { platform, success: false, error: 'No browser flow configured for this platform.' };

  const identity = kit.identity || {};
  const url = mode === 'signup' ? flow.signupUrl : flow.editUrl;
  const steps = [];

  await page.goto(url, { waitUntil: 'networkidle2', timeout: 120000 });
  await new Promise((r) => setTimeout(r, 2000));

  if (flow.nameSelectors && identity.displayName) {
    const filled = await tryFill(page, flow.nameSelectors, identity.displayName);
    if (filled) steps.push('name');
  }

  const bio = identity.bios?.[platform] || identity.tagline || identity.longDescription;
  if (flow.bioSelectors && bio) {
    const filled = await tryFill(page, flow.bioSelectors, bio.slice(0, platform === 'Twitter' ? 160 : 500));
    if (filled) steps.push('bio');
  }

  const tempFiles = [];
  try {
    if (flow.avatarInput && kit.assets?.profilePic?.url) {
      const localPath = await downloadImageToTemp(kit.assets.profilePic.url, `avatar_${platform}`);
      tempFiles.push(localPath);
      const uploaded = await tryUploadFile(page, flow.avatarInput, localPath);
      if (uploaded) steps.push('avatar');
    }

    if (flow.bannerInput) {
      const cover = kit.assets?.covers?.[platform]?.imageUrl || kit.assets?.banners?.[platform]?.imageUrl;
      if (cover) {
        const localPath = await downloadImageToTemp(cover, `banner_${platform}`);
        tempFiles.push(localPath);
        const uploaded = await tryUploadFile(page, flow.bannerInput, localPath);
        if (uploaded) steps.push('banner');
      }
    }
  } finally {
    tempFiles.forEach((f) => { try { fs.unlinkSync(f); } catch (e) { /* ignore */ } });
  }

  return {
    platform,
    success: steps.length > 0,
    steps,
    url: await page.url(),
    message: steps.length
      ? `Applied: ${steps.join(', ')}. Complete any CAPTCHA and save manually if needed.`
      : 'Opened profile page — complete signup/edit manually using kit data.',
  };
}

async function applyKitViaBrowser(store, kit, options = {}) {
  const platforms = options.platforms || kit.platforms || [];
  const mode = options.mode || 'edit';
  const headless = options.headless === true;
  const proxy = kit.proxyId ? proxyManager.findProxyById(store, kit.proxyId) : null;

  const browser = await launchBrowser(proxy, headless, {
    store,
    userDataPath: options.userDataPath,
    kitId: kit.id,
  });
  const pages = await browser.pages();
  const page = pages[0] || await browser.newPage();

  await page.setUserAgent(
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  );

  if (proxy?.username) {
    await page.authenticate({ username: proxy.username, password: proxy.password || '' });
  }

  const profileDir = path.join(os.tmpdir(), `si_browser_${kit.id}`);
  if (!fs.existsSync(profileDir)) fs.mkdirSync(profileDir, { recursive: true });

  const platformDelay = options.delayBetweenPlatformsMs || 1500;
  const results = [];
  try {
    for (const platform of platforms) {
      const result = await applyPlatformProfile(page, platform, kit, mode);
      results.push(result);
      await new Promise((r) => setTimeout(r, platformDelay));
    }
  } finally {
    if (!options.keepBrowserOpen) {
      await browser.close();
    }
  }

  kit.browserAppliedAt = new Date().toISOString();
  kit.browserResults = results;

  return { success: true, results, proxy: proxy ? `${proxy.host}:${proxy.port}` : null };
}

module.exports = {
  PLATFORM_FLOWS,
  launchBrowser,
  applyKitViaBrowser,
};