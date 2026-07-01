const nativeBrowser = require('./nativeBrowserLauncher');

function registerNativeBrowserHandlers({ ipcMain, store, userDataPath }) {
  const channels = [
    'get-native-browsers',
    'get-browser-settings',
    'save-browser-settings',
    'get-native-browser-status',
    'native-browser-open-url',
    'native-browser-launch-debug',
    'native-browser-close-sessions',
  ];

  channels.forEach((ch) => {
    try { ipcMain.removeHandler(ch); } catch (e) { /* not registered */ }
  });

  ipcMain.handle('get-native-browsers', async () => {
    await nativeBrowser.getBrowserStatus(store, userDataPath);
    return nativeBrowser.detectInstalledBrowsers();
  });

  ipcMain.handle('get-browser-settings', () => nativeBrowser.getBrowserSettings(store));

  ipcMain.handle('save-browser-settings', (event, partial) => {
    const saved = nativeBrowser.saveBrowserSettings(store, partial || {});
    return { success: true, settings: saved };
  });

  ipcMain.handle('get-native-browser-status', async () => nativeBrowser.getBrowserStatus(store, userDataPath));

  ipcMain.handle('native-browser-open-url', async (event, payload) => {
    try {
      const url = typeof payload === 'string' ? payload : payload?.url;
      if (!url) return { success: false, error: 'URL required' };
      return await nativeBrowser.openUrlInNativeBrowser(store, userDataPath, url, {
        profileKey: payload?.profileKey || 'default',
        newTab: payload?.newTab !== false,
      });
    } catch (e) {
      return { success: false, error: e.message };
    }
  });

  ipcMain.handle('native-browser-launch-debug', (event, payload) => {
    try {
      const settings = nativeBrowser.getBrowserSettings(store);
      const browserId = payload?.browserId || settings.browserId;
      const port = payload?.port || settings.debugPort || 9222;
      return nativeBrowser.launchBrowserWithDebugging(browserId, port);
    } catch (e) {
      return { success: false, error: e.message };
    }
  });

  ipcMain.handle('native-browser-close-sessions', async (event, profileKey) => {
    await nativeBrowser.closeBrowserSession(profileKey || null);
    return { success: true };
  });

  console.log('[nativeBrowserIpc] Registered native browser handlers (Chrome, Edge, Opera, Firefox)');
}

module.exports = { registerNativeBrowserHandlers };