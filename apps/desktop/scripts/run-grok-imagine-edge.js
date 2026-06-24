/**
 * Generate an image via Grok Imagine using Microsoft Edge + saved session.
 * Usage: node scripts/run-grok-imagine-edge.js ["optional prompt"]
 */
const path = require('path');
const fs = require('fs');
const os = require('os');
const { LocalStorage } = require('node-localstorage');

const productName = 'Social Imperialism';
const userDataPath = path.join(
  process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming'),
  productName,
);
const storagePath = path.join(userDataPath, 'storage');
if (!fs.existsSync(storagePath)) fs.mkdirSync(storagePath, { recursive: true });

const store = new LocalStorage(storagePath);
const nativeBrowser = require('../services/nativeBrowserLauncher');
const grokBrowser = require('../services/grokBrowserAutomation');

nativeBrowser.saveBrowserSettings(store, {
  browserId: 'edge',
  launchMode: 'app_profile',
  persistCookies: true,
});

grokBrowser.saveSettings(store, { sessionValid: true, enabled: true });

const prompt = process.argv.slice(2).join(' ').trim()
  || 'Futuristic social media command center dashboard, neon cyan and purple holographic UI, rich live data graphs, dark sleek interface, cinematic lighting, ultra detailed 4K digital art';

console.log('Browser: Microsoft Edge');
console.log('Profile:', nativeBrowser.getProfileDir(userDataPath, nativeBrowser.getBrowserSettings(store), 'grok'));
console.log('Prompt:', prompt.slice(0, 120) + (prompt.length > 120 ? '…' : ''));
console.log('\nOpening Grok Imagine in Edge — watch the browser window…\n');

(async () => {
  try {
    const result = await grokBrowser.generateGrokImagine(store, userDataPath, prompt);
    if (!result.success) {
      console.error('FAILED:', result.error);
      if (result.browserOpen) console.log('Complete generation manually in the Edge window if needed.');
      process.exit(1);
    }
    const asset = result.primaryAsset;
    console.log('SUCCESS — image generated');
    console.log('Path:', asset.path);
    console.log('URL:', asset.url);
    console.log('Type:', asset.type);
    console.log('All assets:', result.assets?.map((a) => a.path).join('\n  '));
    await grokBrowser.closeGrokBrowser();
    process.exit(0);
  } catch (e) {
    console.error('Error:', e.message);
    try { await grokBrowser.closeGrokBrowser(); } catch (_) {}
    process.exit(1);
  }
})();