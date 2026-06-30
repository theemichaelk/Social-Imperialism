/**
 * Seed Grok Engine + native browser defaults from brain/GROK.md into local storage.
 * Usage: node scripts/seed-grok-credentials.js
 */
const path = require('path');
const fs = require('fs');
const os = require('os');
const { LocalStorage } = require('node-localstorage');

const { coreRequire } = require('../coreRequire');
const { GROK_DEFAULTS } = coreRequire('src/grokDefaults');
const nativeBrowser = require('../services/nativeBrowserLauncher');
const grokBrowser = require('../services/grokBrowserAutomation');

const productName = 'Social Imperialism';
const userDataPath = path.join(
  process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming'),
  productName,
);
const storagePath = path.join(userDataPath, 'storage');
if (!fs.existsSync(storagePath)) fs.mkdirSync(storagePath, { recursive: true });

const store = new LocalStorage(storagePath);

const grokSaved = grokBrowser.saveSettings(store, {
  email: GROK_DEFAULTS.email,
  password: GROK_DEFAULTS.password,
  autoLogin: GROK_DEFAULTS.autoLogin,
  enabled: true,
  sessionValid: true,
});

nativeBrowser.saveBrowserSettings(store, {
  browserId: GROK_DEFAULTS.browserId,
  launchMode: GROK_DEFAULTS.launchMode,
  persistCookies: true,
});

console.log('Grok credentials seeded');
console.log('  Email:', grokSaved.email);
console.log('  Browser:', GROK_DEFAULTS.browserId);
console.log('  Profile:', nativeBrowser.getProfileDir(userDataPath, nativeBrowser.getBrowserSettings(store), GROK_DEFAULTS.profileKey));
console.log('  Brain: brain/GROK.md');