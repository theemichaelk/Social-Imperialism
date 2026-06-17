/**
 * Quora browser session automation — login, post answers, upvote, follow.
 * Uses Puppeteer with a persistent profile per connection.
 */
const path = require('path');
const fs = require('fs');

let puppeteer;
try {
  puppeteer = require('puppeteer');
} catch (e) {
  puppeteer = null;
}

let userDataBasePath = null;

function setUserDataPath(basePath) {
  userDataBasePath = basePath;
}

function getSessionDir(connectionId) {
  if (!userDataBasePath || !connectionId) {
    throw new Error('Quora session path not configured.');
  }
  const dir = path.join(userDataBasePath, 'quora-sessions', String(connectionId).replace(/[^a-zA-Z0-9_-]/g, '_'));
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function sessionExists(connectionId) {
  try {
    const dir = getSessionDir(connectionId);
    return fs.existsSync(dir) && fs.readdirSync(dir).length > 0;
  } catch (e) {
    return false;
  }
}

async function launchBrowser(connectionId, { headless = true } = {}) {
  if (!puppeteer) {
    throw new Error('Puppeteer is not installed. Run: npm install puppeteer');
  }
  const userDataDir = getSessionDir(connectionId);
  const browser = await puppeteer.launch({
    headless: headless ? 'new' : false,
    userDataDir,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-blink-features=AutomationControlled',
      '--window-size=1280,900',
    ],
    defaultViewport: { width: 1280, height: 900 },
  });
  const pages = await browser.pages();
  const page = pages[0] || await browser.newPage();
  await page.setUserAgent(
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  );
  return { browser, page };
}

async function isLoggedIn(page) {
  try {
    await page.goto('https://www.quora.com/', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await delay(2000);
    const url = page.url();
    if (url.includes('/login')) return false;
    return await page.evaluate(() => {
      const hasAsk = !!document.querySelector('[href*="/answer"], [data-testid="ask_question"], .qu-bg--blue');
      const hasProfile = !!document.querySelector('[href*="/profile/"], .q-box img[alt*="profile"], a[href*="/user/"]');
      const noLoginBtn = !document.querySelector('a[href*="login"], button[class*="login"]');
      return hasAsk || hasProfile || (noLoginBtn && !window.location.pathname.includes('login'));
    });
  } catch (e) {
    return false;
  }
}

async function tryFill(page, selectors, value) {
  if (!value) return false;
  for (const sel of selectors) {
    try {
      const el = await page.$(sel);
      if (el) {
        await el.click({ clickCount: 3 });
        await el.type(String(value), { delay: 35 });
        return true;
      }
    } catch (e) { /* next */ }
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
    } catch (e) { /* next */ }
  }
  return false;
}

function delay(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function scrapeProfileHandle(page) {
  try {
    return await page.evaluate(() => {
      const link = document.querySelector('a[href*="/profile/"]')
        || document.querySelector('a[href*="/user/"]');
      if (link) {
        const href = link.getAttribute('href') || '';
        const m = href.match(/\/(profile|user)\/([^/?#]+)/);
        if (m) return `@${m[2]}`;
      }
      const nameEl = document.querySelector('[class*="UserName"], [class*="profile_name"]');
      if (nameEl?.textContent) return nameEl.textContent.trim();
      return null;
    });
  } catch (e) {
    return null;
  }
}

async function login({ connectionId, email, password, headless = false }) {
  if (!connectionId || !email || !password) {
    return { success: false, error: 'Quora login requires connectionId, email, and password.' };
  }

  let browser;
  let page;
  try {
    ({ browser, page } = await launchBrowser(connectionId, { headless }));
    const pageRef = page;

    if (await isLoggedIn(pageRef)) {
      const handle = await scrapeProfileHandle(pageRef);
      await browser.close();
      return { success: true, sessionValid: true, handle, message: 'Quora session already active.' };
    }

    await pageRef.goto('https://www.quora.com/login', { waitUntil: 'domcontentloaded', timeout: 90000 });
    await delay(2500);

    await tryFill(pageRef, [
      'input[type="email"]',
      'input[name="email"]',
      'input[placeholder*="email" i]',
      'input[autocomplete="email"]',
    ], email);

    await tryFill(pageRef, [
      'input[type="password"]',
      'input[name="password"]',
      'input[autocomplete="current-password"]',
    ], password);

    const clicked = await tryClick(pageRef, [
      'button[type="submit"]',
      'button.login_submit_button',
      'div[role="button"][class*="login"]',
      'button[class*="Login"]',
    ]);
    if (!clicked) {
      await pageRef.keyboard.press('Enter');
    }

    await delay(5000);
    await pageRef.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 45000 }).catch(() => {});

    const loggedIn = await isLoggedIn(pageRef);
    if (!loggedIn) {
      await browser.close();
      return {
        success: false,
        error: 'Quora login failed. Complete any captcha or 2FA in the browser window, then try connecting again.',
      };
    }

    const handle = await scrapeProfileHandle(pageRef);
    await browser.close();
    return {
      success: true,
      sessionValid: true,
      handle: handle || `@${email.split('@')[0]}`,
      message: 'Quora session saved for automation.',
    };
  } catch (e) {
    if (browser) try { await browser.close(); } catch (err) { /* ignore */ }
    return { success: false, error: e.message };
  }
}

async function postAnswer({ connectionId, questionUrl, content }) {
  if (!connectionId) throw new Error('Quora account not linked with browser session.');
  if (!questionUrl?.trim()) throw new Error('Question URL is required.');
  if (!content?.trim()) throw new Error('Answer content is required.');

  let browser;
  let page;
  try {
    ({ browser, page } = await launchBrowser(connectionId, { headless: true }));
    const pageRef = page;

    if (!(await isLoggedIn(pageRef))) {
      throw new Error('Quora session expired. Re-link the account in Linked Accounts.');
    }

    await pageRef.goto(questionUrl.trim(), { waitUntil: 'domcontentloaded', timeout: 90000 });
    await delay(3000);

    await tryClick(pageRef, [
      'button[class*="answer"]',
      'div[role="button"][class*="Answer"]',
      'a[href*="answer"]',
    ]);
    await pageRef.evaluate(() => {
      const clickByText = (text) => {
        const nodes = [...document.querySelectorAll('button, a, div[role="button"]')];
        const el = nodes.find((n) => (n.innerText || '').trim().toLowerCase() === text.toLowerCase());
        if (el) el.click();
        return !!el;
      };
      clickByText('Answer');
    });

    await delay(1500);

    const plainText = content.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    const filled = await pageRef.evaluate((text) => {
      const selectors = [
        'div[contenteditable="true"][data-testid]',
        'div.q-box.qu-font--regular[contenteditable="true"]',
        '[contenteditable="true"]',
        'div.q-text textarea',
        'textarea',
      ];
      let editable = null;
      for (const sel of selectors) {
        editable = document.querySelector(sel);
        if (editable) break;
      }
      if (!editable) return false;
      editable.focus();
      if (editable.tagName === 'TEXTAREA') {
        editable.value = text;
        editable.dispatchEvent(new Event('input', { bubbles: true }));
      } else {
        editable.textContent = text;
        editable.dispatchEvent(new Event('input', { bubbles: true }));
      }
      return true;
    }, plainText);

    if (!filled) {
      const typed = await tryFill(pageRef, [
        'div[contenteditable="true"][data-testid]',
        'div.q-box[contenteditable="true"]',
        'textarea',
        '[contenteditable="true"]',
      ], plainText);
      if (!typed) throw new Error('Could not find Quora answer editor on this question page.');
    }

    await delay(1000);
    let posted = await tryClick(pageRef, [
      'button[class*="Submit"]',
      'button[class*="submit"]',
      'div[role="button"][class*="Post"]',
      'button[type="submit"]',
      '[data-testid="submit_button"]',
    ]);
    if (!posted) {
      posted = await pageRef.evaluate(() => {
        const nodes = [...document.querySelectorAll('button, div[role="button"]')];
        const el = nodes.find((n) => /^(post|submit)$/i.test((n.innerText || '').trim()));
        if (el) { el.click(); return true; }
        return false;
      });
    }

    if (!posted) throw new Error('Could not submit Quora answer — post button not found.');

    await delay(3000);
    await browser.close();
    return { success: true, platform: 'Quora', livePosted: true, questionUrl, message: 'Answer posted to Quora.' };
  } catch (e) {
    if (browser) try { await browser.close(); } catch (err) { /* ignore */ }
    throw e;
  }
}

async function performEngage({ connectionId, action, url }) {
  if (!connectionId || !url) {
    return { success: false, note: 'Quora engage requires linked browser session and target URL.' };
  }

  let browser;
  let page;
  try {
    ({ browser, page } = await launchBrowser(connectionId, { headless: true }));
    if (!(await isLoggedIn(page))) {
      throw new Error('Quora session expired.');
    }
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await delay(2000);

    if (action === 'like' || action === 'upvote') {
      await tryClick(page, [
        'button[aria-label*="Upvote"]',
        'button[class*="Upvote"]',
        'div[role="button"][class*="vote"]',
      ]);
    } else if (action === 'follow') {
      await tryClick(page, [
        'button[class*="Follow"]',
        'div[role="button"][class*="Follow"]',
      ]);
    }

    await delay(1500);
    await browser.close();
    return { success: true, platform: 'Quora', action, url };
  } catch (e) {
    if (browser) try { await browser.close(); } catch (err) { /* ignore */ }
    return { success: false, error: e.message, platform: 'Quora', action };
  }
}

async function getSessionProfile(connectionId) {
  if (!sessionExists(connectionId)) {
    return { sessionValid: false, handle: null };
  }
  let browser;
  let page;
  try {
    ({ browser, page } = await launchBrowser(connectionId, { headless: true }));
    const valid = await isLoggedIn(page);
    const handle = valid ? await scrapeProfileHandle(page) : null;
    await browser.close();
    return { sessionValid: valid, handle };
  } catch (e) {
    if (browser) try { await browser.close(); } catch (err) { /* ignore */ }
    return { sessionValid: false, handle: null, error: e.message };
  }
}

function resolveConnectionId(account, tokens) {
  return tokens?.connection_id
    || account?.connectionId
    || (account?.id && String(account.id).startsWith('quora_') ? String(account.id).replace(/^quora_/, '') : null);
}

module.exports = {
  setUserDataPath,
  getSessionDir,
  sessionExists,
  login,
  postAnswer,
  performEngage,
  getSessionProfile,
  resolveConnectionId,
};