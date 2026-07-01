const { buildGrokPrompt } = require('./grokPromptBuilder');

function getActiveCampaign(store) {
  const activeId = store.getItem('activeCampaignId') || 'default';
  try {
    const campaigns = JSON.parse(store.getItem('campaigns') || '[]');
    return campaigns.find((c) => c.id === activeId) || campaigns[0] || {};
  } catch (e) {
    return {};
  }
}

function resolveGrokPayload(store, payload) {
  if (typeof payload === 'string') {
    return { content: payload, newChat: true };
  }
  return payload || {};
}

function prepareGrokRequest(store, payload) {
  const p = resolveGrokPayload(store, payload);
  const campaign = getActiveCampaign(store);
  const built = buildGrokPrompt({
    store,
    campaign,
    content: p.content || p.prompt || p.topic || '',
    taskType: p.taskType,
    pageId: p.pageId,
    keywordTerm: p.keyword || p.keywordTerm,
    userInstruction: p.userInstruction || p.instruction,
    platform: p.platform,
  });
  return {
    prompt: built.prompt,
    meta: {
      primaryKeyword: built.primaryKeyword,
      matchedKeywords: built.matchedKeywords,
      taskType: built.taskType,
    },
    newChat: p.newChat !== false,
    rawContent: p.content || p.prompt || '',
  };
}

function registerGrokHandlers({ ipcMain, store, userDataPath }) {
  let grokBrowser;
  let infographicGenerator;
  try {
    grokBrowser = require('./grokBrowserAutomation');
    infographicGenerator = require('./infographicGenerator');
  } catch (e) {
    console.warn('[grokIpc] Browser automation unavailable (SaaS-safe skip):', e.message);
    const stub = async () => ({
      success: false,
      error: 'Grok browser automation is only available in the desktop app.',
      nodriverReady: false,
    });
    ipcMain.handle('grok-ping', () => ({ ok: false, saasStub: true }));
    ipcMain.handle('grok-get-status', stub);
    ipcMain.handle('grok-connect', stub);
    ipcMain.handle('grok-ask-text', stub);
    ipcMain.handle('grok-imagine', stub);
    ipcMain.handle('grok-generate-video', stub);
    ipcMain.handle('grok-generate-infographic', stub);
    return;
  }

  grokBrowser.seedGrokDefaultsIfNeeded(store);
  const channels = [
    'grok-ping',
    'get-grok-settings',
    'save-grok-settings',
    'grok-connect',
    'grok-get-status',
    'grok-ask-text',
    'grok-imagine',
    'grok-generate-video',
    'grok-generate-infographic',
    'grok-close-browser',
    'grok-build-prompt-preview',
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
        nodriverReady: false,
        puppeteerReady: false,
        error: e.message,
        settings: { sessionValid: false, hasCredentials: false },
        session: { loggedIn: false, lastError: e.message },
      };
    }
  });

  ipcMain.handle('grok-build-prompt-preview', (event, payload) => {
    try {
      const campaign = getActiveCampaign(store);
      const built = buildGrokPrompt({
        store,
        campaign,
        content: payload?.content || payload?.prompt || '',
        taskType: payload?.taskType,
        pageId: payload?.pageId,
        keywordTerm: payload?.keyword,
        userInstruction: payload?.userInstruction,
        platform: payload?.platform,
      });
      return { success: true, ...built };
    } catch (e) {
      return { success: false, error: e.message };
    }
  });

  ipcMain.handle('grok-ask-text', async (event, payload) => {
    try {
      const { prompt, meta, newChat } = prepareGrokRequest(store, payload);
      return await grokBrowser.askGrokText(store, userDataPath, prompt, { newChat, meta });
    } catch (e) {
      return { success: false, error: e.message };
    }
  });

  ipcMain.handle('grok-imagine', async (event, payload) => {
    try {
      const p = resolveGrokPayload(store, payload);
      const { prompt } = prepareGrokRequest(store, {
        ...p,
        content: p.content || p.prompt,
        taskType: 'imagine',
      });
      return await grokBrowser.generateGrokImagine(store, userDataPath, prompt);
    } catch (e) {
      return { success: false, error: e.message };
    }
  });

  ipcMain.handle('grok-generate-video', async (event, payload) => {
    try {
      const p = resolveGrokPayload(store, payload);
      const { prompt, meta } = prepareGrokRequest(store, {
        ...p,
        content: p.content || p.prompt || p.topic || '',
        taskType: 'video',
      });
      const motionSuffix = '\n\nCinematic marketing video clip with smooth motion, professional pacing, vertical 9:16 friendly framing.';
      return await grokBrowser.generateGrokVideo(store, userDataPath, `${prompt}${motionSuffix}`, {
        extendParts: p.extendParts ?? payload?.extendParts,
        maxExtends: p.maxExtends ?? payload?.maxExtends ?? 5,
        keywordMeta: meta,
      });
    } catch (e) {
      return { success: false, error: e.message };
    }
  });

  ipcMain.handle('grok-generate-infographic', async (event, payload) => {
    try {
      return await infographicGenerator.generateInfographic(store, userDataPath, payload || {}, getActiveCampaign);
    } catch (e) {
      return { success: false, error: e.message };
    }
  });

  ipcMain.handle('grok-close-browser', async () => {
    await grokBrowser.closeGrokBrowser();
    grokBrowser.saveSettings(store, { sessionValid: false });
    return { success: true };
  });

  console.log('[grokIpc] Registered Grok IPC handlers (keyword-aware prompts, connect, text, imagine, video+extend, infographic)');
}

module.exports = { registerGrokHandlers, prepareGrokRequest, getActiveCampaign };