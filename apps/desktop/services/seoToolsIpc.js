const seoTools = require('./seoTools');

function registerSeoToolsHandlers({ ipcMain, store, resolveKeys }) {
  const channels = ['get-seo-tools-list', 'run-seo-tool'];

  channels.forEach((ch) => {
    try { ipcMain.removeHandler(ch); } catch (e) { /* not registered */ }
  });

  ipcMain.handle('get-seo-tools-list', () => {
    const keys = resolveKeys(JSON.parse(store.getItem('globalApiKeys') || '{}'));
    return {
      tools: seoTools.listTools(),
      hasSerpApi: !!keys.serpApiKey,
    };
  });

  ipcMain.handle('run-seo-tool', async (event, { toolId, payload }) => {
    try {
      const keys = resolveKeys(JSON.parse(store.getItem('globalApiKeys') || '{}'));
      return await seoTools.runTool(toolId, payload || {}, keys);
    } catch (err) {
      return { success: false, error: err.message, toolId };
    }
  });

  console.log('[seoToolsIpc] Registered:', channels.join(', '));
}

module.exports = { registerSeoToolsHandlers };