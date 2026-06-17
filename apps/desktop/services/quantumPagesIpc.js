const quantumPagesSeo = require('./quantumPagesSeo');

function registerQuantumPagesHandlers({
  ipcMain,
  store,
  getCampaign,
  getOpenRouterKey,
  getSerpKey,
  generateImage,
}) {
  const channels = [
    'get-quantum-pages-config',
    'run-quantum-pages-full',
    'get-quantum-pages-job',
    'get-quantum-pages-jobs',
    'save-quantum-pages-article',
  ];

  channels.forEach((ch) => {
    try { ipcMain.removeHandler(ch); } catch (e) { /* not registered */ }
  });

  ipcMain.handle('get-quantum-pages-config', () => ({
    steps: quantumPagesSeo.getPipelineSteps(),
    requiresOpenRouter: true,
    requiresSerpForStep1: true,
  }));

  ipcMain.handle('run-quantum-pages-full', async (event, payload) => {
    try {
      const keyword = (payload?.keyword || '').trim();
      if (!keyword) return { success: false, error: 'Keyword is required' };
      const campaign = payload?.campaign || getCampaign();
      const openrouterKey = getOpenRouterKey();
      const serpApiKey = getSerpKey();
      const sendProgress = (data) => {
        try { event.sender.send('quantum-pages-progress', data); } catch (e) { /* window closed */ }
      };
      return await quantumPagesSeo.runFullPipeline(store, {
        keyword,
        campaign,
        openrouterKey,
        serpApiKey,
        generateImage,
        options: {
          includeInlineImages: !!payload?.includeInlineImages,
          numberOfImages: payload?.numberOfImages ?? 2,
          generateFeaturedImage: payload?.generateFeaturedImage !== false,
        },
        onProgress: sendProgress,
      });
    } catch (e) {
      return { success: false, error: e.message };
    }
  });

  ipcMain.handle('get-quantum-pages-job', (event, jobId) => {
    const job = quantumPagesSeo.getJob(store, jobId);
    return job || { error: 'Job not found' };
  });

  ipcMain.handle('get-quantum-pages-jobs', () => quantumPagesSeo.loadJobs(store));

  ipcMain.handle('save-quantum-pages-article', (event, article) => {
    try {
      const item = quantumPagesSeo.saveToContentQueue(store, article || {});
      return { success: true, item };
    } catch (e) {
      return { success: false, error: e.message };
    }
  });
}

module.exports = { registerQuantumPagesHandlers };