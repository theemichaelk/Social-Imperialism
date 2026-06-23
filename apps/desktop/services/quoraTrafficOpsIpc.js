const quoraTrafficOps = require('./quoraTrafficOps');

function registerQuoraTrafficOpsHandlers({
  ipcMain,
  store,
  resolveKeys,
  generateAI,
  generateAIWithModel,
  getCampaign,
  getLinkedAccounts,
}) {
  const channels = [
    'get-quora-traffic-status',
    'get-quora-traffic-settings',
    'save-quora-traffic-settings',
    'scrape-quora-questions',
    'generate-quora-answer',
    'publish-quora-answer',
    'fetch-youtube-transcript',
    'save-quora-traffic-answer',
    'delete-quora-traffic-answer',
    'lookup-quora-question-url',
  ];

  channels.forEach((ch) => {
    try { ipcMain.removeHandler(ch); } catch (e) { /* not registered */ }
  });

  const campaignId = () => store.getItem('activeCampaignId') || 'default';
  const keys = () => resolveKeys(JSON.parse(store.getItem('globalApiKeys') || '{}'));

  const deps = () => ({
    generateAI,
    generateAIWithModel: generateAIWithModel || ((p, m) => generateAI(p)),
    campaign: getCampaign(),
    linkedAccounts: getLinkedAccounts ? getLinkedAccounts() : [],
    keys: keys(),
    store,
    campaignId: campaignId(),
  });

  ipcMain.handle('get-quora-traffic-status', () => {
    const d = deps();
    return quoraTrafficOps.getStatus(store, d.campaignId, keys(), d.linkedAccounts, d.campaign);
  });

  ipcMain.handle('get-quora-traffic-settings', () => ({
    settings: quoraTrafficOps.loadSettings(store, campaignId()),
    frameworks: quoraTrafficOps.PROMPT_FRAMEWORKS,
  }));

  ipcMain.handle('save-quora-traffic-settings', (event, partial) => {
    const saved = quoraTrafficOps.saveSettings(store, campaignId(), partial || {});
    return { success: true, settings: saved };
  });

  ipcMain.handle('scrape-quora-questions', async (event, { keyword, limit, enrich, enrichMax }) => {
    try {
      if (!keyword?.trim()) return { success: false, error: 'Keyword required' };
      const questions = await quoraTrafficOps.scrapeQuestions(keyword.trim(), keys(), {
        limit: limit || 25,
        enrich: enrich !== false,
        enrichMax: enrichMax || 5,
      });
      const settings = quoraTrafficOps.loadSettings(store, campaignId());
      settings.lastScrape = { keyword, at: new Date().toISOString(), count: questions.length };
      settings.cachedQuestions = questions;
      quoraTrafficOps.saveSettings(store, campaignId(), settings);
      return { success: true, questions, count: questions.length };
    } catch (e) {
      const settings = quoraTrafficOps.loadSettings(store, campaignId());
      const cached = settings.cachedQuestions || [];
      if (cached.length) {
        return {
          success: true,
          questions: cached.slice(0, limit || 25),
          count: Math.min(cached.length, limit || 25),
          fallback: true,
          warning: e.message,
        };
      }
      return { success: false, error: e.message };
    }
  });

  ipcMain.handle('generate-quora-answer', async (event, payload) => {
    try {
      const settings = quoraTrafficOps.loadSettings(store, campaignId());
      const result = await quoraTrafficOps.generateAnswer(
        { ...deps(), settings },
        { ...payload, settings },
      );
      settings.answers = [result.answer, ...settings.answers];
      quoraTrafficOps.saveSettings(store, campaignId(), settings);
      return result;
    } catch (e) {
      return { success: false, error: e.message };
    }
  });

  ipcMain.handle('publish-quora-answer', async (event, { answer, automated }) => {
    try {
      const d = deps();
      return await quoraTrafficOps.publishAnswer(d, {
        answer,
        automated,
        store,
        campaignId: campaignId(),
      });
    } catch (e) {
      return { success: false, error: e.message };
    }
  });

  ipcMain.handle('fetch-youtube-transcript', async (event, arg) => {
    const url = typeof arg === 'string' ? arg : arg?.url;
    try {
      const data = await quoraTrafficOps.fetchYouTubeTranscript(url);
      return { success: true, ...data };
    } catch (e) {
      return { success: false, error: e.message };
    }
  });

  ipcMain.handle('save-quora-traffic-answer', (event, answer) => {
    const settings = quoraTrafficOps.loadSettings(store, campaignId());
    const idx = settings.answers.findIndex((a) => a.id === answer.id);
    if (idx >= 0) settings.answers[idx] = { ...settings.answers[idx], ...answer };
    else settings.answers.unshift(answer);
    quoraTrafficOps.saveSettings(store, campaignId(), settings);
    return { success: true };
  });

  ipcMain.handle('delete-quora-traffic-answer', (event, id) => {
    const settings = quoraTrafficOps.loadSettings(store, campaignId());
    settings.answers = settings.answers.filter((a) => a.id !== id);
    quoraTrafficOps.saveSettings(store, campaignId(), settings);
    return { success: true };
  });

  ipcMain.handle('lookup-quora-question-url', async (event, { url, keyword }) => {
    try {
      const question = await quoraTrafficOps.lookupQuestionByUrl(url, keyword || 'manual');
      const settings = quoraTrafficOps.loadSettings(store, campaignId());
      const cached = settings.cachedQuestions || [];
      if (!cached.some((q) => q.url === question.url)) {
        settings.cachedQuestions = [question, ...cached];
        quoraTrafficOps.saveSettings(store, campaignId(), settings);
      }
      return { success: true, question };
    } catch (e) {
      return { success: false, error: e.message };
    }
  });
}

module.exports = { registerQuoraTrafficOpsHandlers };