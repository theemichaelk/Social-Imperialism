/**
 * One-shot: save Edge as Grok browser and open grok.com in real Microsoft Edge.
 * Usage: node scripts/launch-grok-edge.js
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

if (!fs.existsSync(storagePath)) {
  fs.mkdirSync(storagePath, { recursive: true });
}

const store = new LocalStorage(storagePath);
const nativeBrowser = require('../services/nativeBrowserLauncher');

const edgeSettings = {
  browserId: 'edge',
  launchMode: 'app_profile',
  profileDirectory: 'Default',
  debugPort: 9222,
  persistCookies: true,
};
nativeBrowser.saveBrowserSettings(store, edgeSettings);

console.log('Saved browser settings:', nativeBrowser.getBrowserSettings(store));
console.log('Edge executable:', nativeBrowser.detectInstalledBrowsers().find((b) => b.id === 'edge')?.executablePath);

(async () => {
  try {
    const result = await nativeBrowser.openUrlInNativeBrowser(store, userDataPath, 'https://grok.com/', {
      profileKey: 'grok',
      newTab: false,
    });
    console.log('Launched Grok in Edge:', result);
    console.log('Browser window should be open — log in once; cookies persist in:');
    console.log(nativeBrowser.getProfileDir(userDataPath, edgeSettings, 'grok'));
    console.log('\nLeave this terminal open 30s while Edge loads, then close sessions…');
    await new Promise((r) => setTimeout(r, 30000));
    await nativeBrowser.closeBrowserSession('grok');
    console.log('Done.');
    process.exit(0);
  } catch (e) {
    console.error('Failed:', e.message);
    process.exit(1);
  }
})();