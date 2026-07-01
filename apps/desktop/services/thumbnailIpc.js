const thumbnailGenerator = require('./thumbnailGenerator');

function getGrokBrowserAutomation() {
  return require('./grokBrowserAutomation');
}

function registerThumbnailHandlers({
  ipcMain,
  store,
  userDataPath,
  generateAIWithModel,
  runAdvancedWorkflow,
}) {
  const channels = [
    'get-thumbnail-studio-config',
    'generate-viral-thumbnail',
    'generate-viral-thumbnail-batch',
  ];

  channels.forEach((ch) => {
    try { ipcMain.removeHandler(ch); } catch (e) { /* not registered */ }
  });

  const deps = {
    store,
    userDataPath,
    generateAIWithModel,
    generateGrokImagine: (prompt) => getGrokBrowserAutomation().generateGrokImagine(store, userDataPath, prompt),
    runAdvancedWorkflow,
  };

  ipcMain.handle('get-thumbnail-studio-config', () => ({
    models: thumbnailGenerator.THUMBNAIL_MODELS,
    styles: thumbnailGenerator.THUMBNAIL_STYLES,
    ratios: thumbnailGenerator.THUMBNAIL_RATIOS,
    copyModels: thumbnailGenerator.COPY_MODELS,
  }));

  ipcMain.handle('generate-viral-thumbnail', async (event, payload) => {
    try {
      return await thumbnailGenerator.generateViralThumbnail(deps, payload || {});
    } catch (e) {
      return { success: false, error: e.message };
    }
  });

  ipcMain.handle('generate-viral-thumbnail-batch', async (event, payload) => {
    try {
      return await thumbnailGenerator.generateThumbnailBatch(deps, payload || {});
    } catch (e) {
      return { success: false, error: e.message };
    }
  });
}

module.exports = { registerThumbnailHandlers };