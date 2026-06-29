const {
  getFormatTemplates,
  analyzeLibraryAsset,
  analyzeImageUrl,
  saveTemplateFromAsset,
  recreateFromFormatTemplate,
} = require('./imageFormatIntelligence');

function registerImageFormatIntelligenceHandlers({
  ipcMain, store, generateAIVision, generateAI, generateImage,
}) {
  const channels = [
    'analyze-library-image',
    'analyze-image-url',
    'get-format-templates',
    'save-format-template-from-asset',
    'delete-format-template',
    'recreate-from-format-template',
  ];
  channels.forEach((ch) => {
    try { ipcMain.removeHandler(ch); } catch (e) { /* noop */ }
  });

  ipcMain.handle('analyze-library-image', async (event, payload = {}) => {
    try {
      return await analyzeLibraryAsset({
        store,
        generateAIVision,
        assetId: payload.assetId || payload.id,
      });
    } catch (e) {
      return { success: false, error: e.message || 'Analysis failed' };
    }
  });

  ipcMain.handle('analyze-image-url', async (event, payload = {}) => {
    try {
      return await analyzeImageUrl({
        imageUrl: payload.imageUrl || payload.url,
        generateAIVision,
        store,
      });
    } catch (e) {
      return { success: false, error: e.message || 'Analysis failed' };
    }
  });

  ipcMain.handle('get-format-templates', () => ({
    success: true,
    templates: getFormatTemplates(store),
    count: getFormatTemplates(store).length,
  }));

  ipcMain.handle('save-format-template-from-asset', (event, payload = {}) => {
    try {
      return saveTemplateFromAsset({
        store,
        assetId: payload.assetId || payload.id,
        analysis: payload.analysis,
      });
    } catch (e) {
      return { success: false, error: e.message || 'Could not save format template' };
    }
  });

  ipcMain.handle('delete-format-template', (event, { id } = {}) => {
    const templates = getFormatTemplates(store).filter((t) => t.id !== id);
    const { saveFormatTemplates } = require('./imageFormatIntelligence');
    saveFormatTemplates(store, templates);
    return { success: true, count: templates.length };
  });

  ipcMain.handle('recreate-from-format-template', async (event, payload = {}) => {
    try {
      return await recreateFromFormatTemplate({
        store,
        generateAI,
        generateImage,
        templateId: payload.templateId || payload.id,
        keyword: payload.keyword || payload.topic,
        generateNewImage: payload.generateNewImage !== false,
      });
    } catch (e) {
      return { success: false, error: e.message || 'Recreation failed' };
    }
  });
}

module.exports = { registerImageFormatIntelligenceHandlers };