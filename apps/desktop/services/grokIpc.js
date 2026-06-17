const grokBrowser = require('./grokBrowserAutomation');
const infographicGenerator = require('./infographicGenerator');

function registerGrokHandlers({ ipcMain, store, userDataPath }) {
  const channels = [
    'grok-ping',
    'get-grok-settings',
    'save-grok-settings',
    'grok-connect',
    'grok-get-status',
    'grok-ask-text',
    'grok-imagine',
    'grok-generate-infographic',
    'grok-close-browser',
  ];

  channels.forEach((ch) => {
    try { ipcMain.removeHandler(ch); } catch (e) { /* not registered */ }
  });

  ipcMain.handle('grok-ping', () => ({ ok: true, ts: Date.now() }));

  ipcMain.handle('get-grok-settings', () => {
    const s = grokBrowser.getSettings(store);
    return { ...s, password: s.password ? '********' : '' };
  });

  ipcMain.handle('save-grok-settings', (event, partial) => {
    const current = grokBrowser.getSettings(store);
    const next = { ...partial };
    if (next.password === '********' || next.password === '') {
      next.password = current.password;
    }
    const saved = grokBrowser.saveSettings(store, next);
    return { success: true, settings: { ...saved, password: saved.password ? '********' : '' } };
  });

  ipcMain.handle('grok-connect', async () => {
    try {
      return await grokBrowser.loginToGrok(store, userDataPath, { visible: true, waitForManual: true });
    } catch (e) {
      return { success: false, error: e.message };
    }
  });

  ipcMain.handle('grok-get-status', async () => {
    try {
      return await grokBrowser.getStatus(store, userDataPath);
    } catch (e) {
      return {
        puppeteerReady: false,
        error: e.message,
        settings: { sessionValid: false, hasCredentials: false },
        session: { loggedIn: false, lastError: e.message },
      };
    }
  });

  ipcMain.handle('grok-ask-text', async (event, payload) => {
    try {
      const prompt = typeof payload === 'string' ? payload : payload?.prompt;
      const newChat = payload?.newChat !== false;
      return await grokBrowser.askGrokText(store, userDataPath, prompt, { newChat });
    } catch (e) {
      return { success: false, error: e.message };
    }
  });

  ipcMain.handle('grok-imagine', async (event, payload) => {
    try {
      const prompt = typeof payload === 'string' ? payload : payload?.prompt;
      return await grokBrowser.generateGrokImagine(store, userDataPath, prompt);
    } catch (e) {
      return { success: false, error: e.message };
    }
  });

  ipcMain.handle('grok-generate-infographic', async (event, payload) => {
    try {
      return await infographicGenerator.generateInfographic(store, userDataPath, payload || {});
    } catch (e) {
      return { success: false, error: e.message };
    }
  });

  ipcMain.handle('grok-close-browser', async () => {
    await grokBrowser.closeGrokBrowser();
    grokBrowser.saveSettings(store, { sessionValid: false });
    return { success: true };
  });

  console.log('[grokIpc] Registered Grok IPC handlers (ping, connect, status, text, imagine, infographic)');
}

module.exports = { registerGrokHandlers };