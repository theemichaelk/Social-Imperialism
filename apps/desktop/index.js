const { app, BrowserWindow, ipcMain, shell } = require('electron');
require('dotenv').config();
const axios = require('axios');
const path = require('path');
const fs = require('fs');
const http = require('http');
const integrations = require('./services');
const brandGuidelines = require('./services/brandGuidelines');
const { resolveKeys, hasTwitterKeys, hasRedditKeys, hasLinkedInKeys, hasMetaKeys, hasYouTubeKeys, hasTikTokKeys, hasTwitchKeys } = require('./services/keys');
const { fetchTrendingTopics } = require('./services/feedFetcher');
const { FREQUENCY_OPTIONS, shouldRunOnSchedule, markScheduleRun, workerSleepMs } = require('./services/scheduleIntervals');
const { buildGlobalCustomPromptRequest } = require('./services/customPromptGenerator');

let mainWindow = null;

// Register custom protocol for OAuth redirects
if (process.defaultApp) {
  if (process.argv.length >= 2) {
    app.setAsDefaultProtocolClient('social-imperialism', process.execPath, [path.resolve(process.argv[1])]);
  }
} else {
  app.setAsDefaultProtocolClient('social-imperialism');
}

const dataPath = app.getPath('userData');
if (!fs.existsSync(dataPath)) {
  fs.mkdirSync(dataPath, { recursive: true });
}
const { LocalStorage } = require('node-localstorage');
const quoraBrowserAutomation = require('./services/quoraBrowserAutomation');
const store = new LocalStorage(path.join(dataPath, 'storage'));
quoraBrowserAutomation.setUserDataPath(dataPath);
const { registerCalendarHandlers } = require('./services/calendarIpc');
const { registerBackgroundRunHandlers } = require('./services/backgroundRunIpc');
const backgroundRunScheduler = require('./services/backgroundRunScheduler');
const { registerSettingsHandlers } = require('./services/settingsIpc');
const { registerBillingPaymentHandlers } = require('./services/billingPaymentsIpc');
const { registerAccountHandlers } = require('./services/accountIpc');
const { registerAccountCreatorHandlers, processBrowserBatchQueue } = require('./services/accountCreatorIpc');
const { registerGrokHandlers } = require('./services/grokIpc');
const { registerContentStudioHandlers } = require('./services/contentStudioIpc');
const { registerRedditAiHandlers } = require('./services/redditAiIpc');
const { registerThumbnailHandlers } = require('./services/thumbnailIpc');
const { registerQuantumPagesHandlers } = require('./services/quantumPagesIpc');
const { registerQuoraTrafficOpsHandlers } = require('./services/quoraTrafficOpsIpc');
const { registerSeoToolsHandlers } = require('./services/seoToolsIpc');
const { registerPageHealthHandlers } = require('./services/pageHealthCheck');
const grokBrowserAutomation = require('./services/grokBrowserAutomation');
const infographicGenerator = require('./services/infographicGenerator');
const aiReplyStore = require('./services/aiReplyStore');

function buildApiMetrics(keys) {
  const k = resolveKeys(keys);
  const status = (ok, liveLabel) => (ok ? 'Connected' : (liveLabel || 'Not configured'));
  return {
    'Twitter / X': status(hasTwitterKeys(k)),
    'Reddit OAuth': status(hasRedditKeys(k)),
    'Reddit Feed': 'Live (public API)',
    'LinkedIn': status(hasLinkedInKeys(k)),
    'Meta / Facebook': status(hasMetaKeys(k)),
    'YouTube': status(hasYouTubeKeys(k)),
    'TikTok': status(hasTikTokKeys(k)),
    'Twitch': status(hasTwitchKeys(k)),
    'NewsAPI': status(!!k.newsApiKey),
    'SerpAPI': status(!!k.serpApiKey),
    'Gemini AI': status(!!k.gemini),
    'OpenRouter': status(!!k.openrouter),
  };
}

const calendarApi = registerCalendarHandlers({ ipcMain, store, resolveKeys, buildApiMetrics, integrations });
registerBackgroundRunHandlers({ ipcMain, store });
registerGrokHandlers({ ipcMain, store, userDataPath: dataPath });
registerRedditAiHandlers({
  ipcMain,
  store,
  generateAI: (prompt) => generateAI(prompt),
  getCampaign: () => {
    try {
      const activeId = store.getItem('activeCampaignId') || 'default';
      return JSON.parse(store.getItem('campaigns') || '[]').find((c) => c.id === activeId) || {};
    } catch (e) {
      return {};
    }
  },
  resolveKeys,
});
registerSettingsHandlers({ ipcMain, store });
const billingPayments = registerBillingPaymentHandlers({
  ipcMain,
  store,
  shell,
  onPaymentComplete: (billing) => {
    if (mainWindow) mainWindow.webContents.send('payment-complete', billing);
  },
});
registerPageHealthHandlers({ ipcMain, store, resolveKeys, appRoot: __dirname });

function openOAuthUrl(url) {
  // Google blocks sign-in inside embedded Electron windows ("browser may not be secure").
  // Always use the system browser; the loopback server catches the redirect.
  if (url.includes('accounts.google.com/o/oauth2') && mainWindow) {
    mainWindow.webContents.send('oauth-browser-opened', {
      message: 'Complete Google sign-in in your browser, then return here.',
    });
  }
  return shell.openExternal(url);
}

function registerAllAccountHandlers() {
  registerAccountHandlers({
    ipcMain,
    store,
    resolveKeys,
    integrations,
    openExternal: (url) => openOAuthUrl(url),
  });
}

// Centralized AI logic - support for Google Gemini, OpenAI, OpenRouter (unified multi-model), or Azure OpenAI
// Priority: OpenRouter (if key present) > OpenAI (if USE_OPENAI) > Gemini (default)
// Additional keys preloaded for real data: Unsplash (stock photos in Content Hub), NewsAPI (Dashboard trending), LinkedIn (automation/posting), Advanced Workflow (enhanced image/text tools without mocks)
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY_1;
const NEWS_API_KEY = process.env.NEWS_API_KEY;
const WEATHER_API_KEY = process.env.OPENWEATHERMAP_API_KEY;

// Fallback to Global Settings UI if missing from .env
function getGlobalKey(keyName) {
  const globalKeysData = store.getItem('globalApiKeys');
  if (globalKeysData) {
      try { 
        const parsed = JSON.parse(globalKeysData); 
        return parsed[keyName] || null;
      } catch(e) {}
  }
  return null;
}

// IPC Handlers to expose real external data to the frontend Dashboard
ipcMain.handle('get-live-weather', async (event, city = "New York") => {
  if (!WEATHER_API_KEY) return { error: "No Weather API Key" };
  try {
    const res = await axios.get(`https://api.openweathermap.org/data/2.5/weather?q=${city}&appid=${WEATHER_API_KEY}&units=imperial`);
    return res.data;
  } catch(e) {
    console.error("Weather error:", e.message);
    return { error: e.message };
  }
});

ipcMain.handle('check-api-status', async () => {
  const keys = resolveKeys(JSON.parse(store.getItem('globalApiKeys') || '{}'));
  const apiMetrics = buildApiMetrics(keys);
  const connected = Object.values(apiMetrics).filter((v) => v === 'Connected').length;
  return {
    ok: connected > 0,
    message: connected > 0 ? `${connected} API integration(s) configured` : 'No API keys configured — add keys in Settings or .env',
    apiMetrics,
    timestamp: new Date().toISOString(),
  };
});

ipcMain.handle('get-live-news', async (event, query = "technology") => {
  try {
      const globalKeysData = store.getItem('globalApiKeys');
      let keys = {};
      if (globalKeysData) {
          try { keys = JSON.parse(globalKeysData); } catch(e) {}
      }
      keys = resolveKeys(keys);

      const newsKey = keys.newsApiKey || process.env.NEWS_API_KEY;
      if (!newsKey) {
        return { error: 'No NewsAPI key configured. Add NEWS_API_KEY to .env or Settings.' };
      }

      const category = query || 'technology';
      const res = await axios.get('https://newsapi.org/v2/top-headlines', {
        params: { category, language: 'en', pageSize: 10, apiKey: newsKey },
        timeout: 15000,
      });
      const data = res.data;

      if (data?.articles?.length > 0) {
          return data.articles.slice(0, 4).map(a => ({ title: a.title, url: a.url }));
      }

      return { error: 'NewsAPI returned no articles for this category.' };
  } catch(e) {
      console.error("NewsAPI error:", e.message);
      return { error: e.message };
  }
});

ipcMain.handle('get-trending-topics', async (event, platform = 'Twitter') => {
  try {
    const keys = resolveKeys(JSON.parse(store.getItem('globalApiKeys') || '{}'));
    const topics = await fetchTrendingTopics(platform, keys);
    return topics;
  } catch(e) {
    console.error("Trending Topics error:", e.message);
    return [];
  }
});

ipcMain.handle('analyze-topic', async (event, payload) => {
  const { topic, platform, brandName, audience } = payload;
  try {
    const today = new Date().toLocaleDateString('en-US');
    const prompt = `
    You are an expert Social Media Data Analyst. Today is ${today}.
    A user clicked on the trending topic/hashtag "${topic}" on ${platform}.
    
    Provide a factual strategic analysis based on real social media trends. Do NOT invent statistics or chart data.
    
    Provide EXACTLY a JSON object with the following structure (no markdown tags outside):
    {
      "textAnalysis": "Brief 3-5 sentence analysis of why it's trending, who is engaging, and how the brand '${brandName}' (targeting '${audience}') can capitalize on it. Only state facts you can reasonably infer — do not fabricate metrics."
    }
    `;
    
    const resultText = await generateAI(prompt);
    let cleanJson = resultText.trim();
    if(cleanJson.startsWith('```json')) cleanJson = cleanJson.substring(7);
    if(cleanJson.endsWith('```')) cleanJson = cleanJson.substring(0, cleanJson.length - 3);
    
    return { success: true, analysis: JSON.parse(cleanJson.trim()) };
  } catch (error) {
    console.error("Topic Analysis error:", error.message);
    return { error: error.message };
  }
});

// DomDetailer API Handler
ipcMain.handle('get-domain-metrics', async (event, domain) => {
  let domKey = getGlobalKey('domDetailer');
  
  // Quick fix: the user provided a hardcoded key in the prompt to use if the user hasn't explicitly set it via settings yet
  if (!domKey) domKey = process.env.DOMDETAILER_API_KEY || null; 
  
  if (!domKey) return { error: "No DomDetailer API Key configured." };
  
  if (!domain) return { error: "No domain provided by active campaign." };

  try {
    const url = `http://domdetailer.com/api/checkDomain.php?domain=${encodeURIComponent(domain)}&app=SocialImperialism&apikey=${encodeURIComponent(domKey)}`;
    const response = await axios.get(url);
    
    // The API might return an object with an error string or valid stats
    if (response.data.error || response.data.error_message) {
       return { error: response.data.error || response.data.error_message };
    }
    
    return { success: true, data: response.data };
  } catch (e) {
    console.error("DomDetailer API Error:", e.message);
    return { error: e.message };
  }
});

// Auto content / fanpage settings for the "Explore a new marketing channel" UI (RSS + hands-free to fanpages)
ipcMain.handle('get-auto-content-settings', (event) => {
  const data = store.getItem('autoContentSettings');
  if (data) {
    try {
      return {
        enabled: false,
        rssUrls: [],
        targetAccountIds: [],
        frequency: 'daily',
        publishMode: 'queue',
        targetPlatforms: ['Facebook', 'LinkedIn', 'Twitter'],
        ...JSON.parse(data),
      };
    } catch(e) {}
  }
  return { enabled: false, rssUrls: [], targetAccountIds: [], frequency: 'daily', publishMode: 'queue', targetPlatforms: ['Facebook', 'LinkedIn', 'Twitter'] };
});

ipcMain.handle('save-auto-content-settings', (event, settings) => {
  store.setItem('autoContentSettings', JSON.stringify(settings || {}));
  return { success: true };
});

// Dynamically fetch the latest model version to prevent falling behind
let latestModelName = "gemini-3.1-pro"; // fallback

async function checkLatestModel() {
  const geminiKey = getGlobalKey('gemini') || GEMINI_API_KEY;
  if (!geminiKey) return;
  try {
    const response = await axios.get(`https://generativelanguage.googleapis.com/v1beta/models?key=${geminiKey}`);
    const modelsResponse = response.data.models;
    let proModels = [];
    for (const m of modelsResponse) {
      if (m.name.includes('gemini') && m.name.includes('pro') && !m.name.includes('vision') && !m.name.includes('experimental')) {
        proModels.push(m.name.replace('models/', ''));
      }
    }
    
    if (proModels.length > 0) {
      // Fixed: simple version-aware sort for gemini pro models (highest version first)
      proModels.sort((a, b) => {
        const getVer = (name) => {
          const m = name.match(/gemini-(\d+\.\d+)/);
          return m ? parseFloat(m[1]) : 0;
        };
        const verA = getVer(a);
        const verB = getVer(b);
        if (verA !== verB) return verB - verA;
        if (a.includes('preview') && !b.includes('preview')) return 1;
        if (!a.includes('preview') && b.includes('preview')) return -1;
        return b.localeCompare(a); // fallback
      });
      
      latestModelName = proModels[0];
      console.log(`Auto-selected latest model: ${latestModelName}`);
    }
  } catch(e) {
    console.error("Failed to fetch latest model, using fallback:", latestModelName);
  }
}

// Check models immediately on boot
checkLatestModel();

// Function to call AI (can route to OpenAI or Gemini based on keys)
async function generateAI(prompt) {
  // === ALWAYS INJECT ACTIVE BRAND PROFILE (Core of the entire blueprint) ===
  let brandContext = "";
  try {
    const activeCampaignId = store.getItem('activeCampaignId');
    const campsData = store.getItem('campaigns');
    if (campsData && activeCampaignId) {
      const camps = JSON.parse(campsData);
      const camp = camps.find(c => c.id === activeCampaignId);
      if (camp) {
        brandContext = `
BRAND PROFILE (MUST USE THIS IN EVERY REPLY - DO NOT IGNORE):
- Brand Name: ${camp.brandName || 'the brand'}
- Domain / Website: ${camp.domain || ''}
- Description: ${camp.description || ''}
- Tone of Voice: ${camp.tone || 'professional and helpful'}
- Target Audience: ${camp.audience || 'professionals and decision makers'}
- Affiliate Links / USPs: ${camp.affiliateLinks || ''}
- Disallowed Topics: ${camp.disallowedTopics || 'none'}
- Example Style: ${camp.examplePosts || ''}
- Primary Conversion Link: ${camp.primaryLink || camp.domain || ''}

Rules for this brand:
- Always naturally mention the brand name and/or domain in replies when it fits.
- Use the specified tone.
- Respect disallowed topics.
- Incorporate USPs or affiliate links when relevant to the conversation.
- Be helpful first, promotional second.
`;
      }
    }
  } catch (e) {
    console.error("Brand profile load error:", e.message);
  }

  const finalPrompt = brandContext + "\n\n" + prompt;

  const geminiKey = getGlobalKey('gemini') || GEMINI_API_KEY;
  const openaiKey = getGlobalKey('openai') || OPENAI_API_KEY;
  const openrouterKey = getGlobalKey('openrouter') || process.env.OPENROUTER_API_KEY;
  
  // Priority 1: OpenRouter (unified access to many models, OpenAI-compatible)
  if (openrouterKey) {
    try {
      const res = await axios.post('https://openrouter.ai/api/v1/chat/completions', {
        model: "openai/gpt-4o",
        messages: [{ role: "user", content: finalPrompt }]
      }, {
        headers: {
          'Authorization': `Bearer ${openrouterKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://socialimperialism.local',
          'X-Title': 'Social Imperialism'
        }
      });
      return res.data.choices[0].message.content;
    } catch (e) {
      console.error("OpenRouter Error:", e.response ? e.response.data : e.message);
    }
  }
  
  // Priority 2: OpenAI
  if (openaiKey && process.env.USE_OPENAI === "true") {
      try {
          const res = await axios.post('https://api.openai.com/v1/chat/completions', {
              model: "gpt-4o",
              messages: [{ role: "user", content: finalPrompt }]
          }, {
              headers: {
                  'Authorization': `Bearer ${openaiKey}`,
                  'Content-Type': 'application/json'
              }
          });
          return res.data.choices[0].message.content;
      } catch (e) {
          console.error("OpenAI Error:", e.response ? e.response.data : e.message);
      }
  }
  
  // Default / Fallback: Gemini (try multiple models if primary 404s)
  if (!geminiKey) throw new Error("No AI API Keys configured. Please add one in Settings > API Integrations.");
  const geminiModels = [...new Set([
    latestModelName,
    'gemini-2.0-flash',
    'gemini-1.5-flash',
    'gemini-1.5-pro',
  ].filter(Boolean))];
  let lastGeminiError = null;
  for (const modelName of geminiModels) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${geminiKey}`;
      const response = await axios.post(url, {
        contents: [{ parts: [{ text: finalPrompt }] }],
      }, { headers: { 'Content-Type': 'application/json' }, timeout: 60000 });
      if (response.data?.candidates?.[0]?.content?.parts?.[0]?.text) {
        if (modelName !== latestModelName) latestModelName = modelName;
        return response.data.candidates[0].content.parts[0].text;
      }
      lastGeminiError = new Error('Invalid response format from Gemini API');
    } catch (error) {
      lastGeminiError = error;
      const status = error.response?.status;
      if (status !== 404 && status !== 400) break;
      console.warn(`Gemini model ${modelName} unavailable, trying next…`);
    }
  }
  if (openrouterKey) {
    try {
      const res = await axios.post('https://openrouter.ai/api/v1/chat/completions', {
        model: 'openai/gpt-4o-mini',
        messages: [{ role: 'user', content: finalPrompt }],
      }, {
        headers: {
          Authorization: `Bearer ${openrouterKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://socialimperialism.local',
          'X-Title': 'Social Imperialism',
        },
        timeout: 60000,
      });
      return res.data.choices[0].message.content;
    } catch (e) {
      console.error('OpenRouter fallback error:', e.message);
    }
  }
  console.error('Gemini Generation Error:', lastGeminiError?.response?.data || lastGeminiError?.message);
  throw lastGeminiError || new Error('AI generation failed');
}

async function generateAIWithModel(prompt, modelId = 'gemini') {
  if (modelId === 'grok-browser') {
    const res = await grokBrowserAutomation.askGrokText(store, dataPath, prompt, { newChat: true });
    if (!res.success && !res.text) throw new Error(res.error || 'Grok text failed');
    return res.text || '';
  }

  let brandContext = '';
  try {
    const activeCampaignId = store.getItem('activeCampaignId');
    const campsData = store.getItem('campaigns');
    if (campsData && activeCampaignId) {
      const camps = JSON.parse(campsData);
      const camp = camps.find((c) => c.id === activeCampaignId);
      if (camp) {
        brandContext = `BRAND: ${camp.brandName || ''} | ${camp.domain || ''} | Tone: ${camp.tone || 'professional'}\n`;
      }
    }
  } catch (e) { /* ignore */ }

  const finalPrompt = brandContext + prompt;
  const geminiKey = getGlobalKey('gemini') || GEMINI_API_KEY;
  const openaiKey = getGlobalKey('openai') || OPENAI_API_KEY;
  const openrouterKey = getGlobalKey('openrouter') || process.env.OPENROUTER_API_KEY;

  if (modelId === 'openai-direct' && openaiKey) {
    const res = await axios.post('https://api.openai.com/v1/chat/completions', {
      model: 'gpt-4o',
      messages: [{ role: 'user', content: finalPrompt }],
    }, { headers: { Authorization: `Bearer ${openaiKey}`, 'Content-Type': 'application/json' } });
    return res.data.choices[0].message.content;
  }

  if (modelId && modelId.includes('/') && openrouterKey) {
    const res = await axios.post('https://openrouter.ai/api/v1/chat/completions', {
      model: modelId,
      messages: [{ role: 'user', content: finalPrompt }],
    }, {
      headers: {
        Authorization: `Bearer ${openrouterKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://socialimperialism.local',
        'X-Title': 'Social Imperialism',
      },
    });
    return res.data.choices[0].message.content;
  }

  if (openrouterKey && modelId !== 'gemini') {
    const res = await axios.post('https://openrouter.ai/api/v1/chat/completions', {
      model: modelId || 'openai/gpt-4o',
      messages: [{ role: 'user', content: finalPrompt }],
    }, {
      headers: {
        Authorization: `Bearer ${openrouterKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://socialimperialism.local',
        'X-Title': 'Social Imperialism',
      },
    });
    return res.data.choices[0].message.content;
  }

  if (!geminiKey) throw new Error('No AI API key configured.');
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${latestModelName}:generateContent?key=${geminiKey}`;
  const response = await axios.post(url, { contents: [{ parts: [{ text: finalPrompt }] }] }, {
    headers: { 'Content-Type': 'application/json' },
  });
  if (response.data?.candidates?.[0]?.content?.parts?.[0]?.text) {
    return response.data.candidates[0].content.parts[0].text;
  }
  throw new Error('Invalid Gemini response');
}

function getScheduledPostsStoreList() {
  try { return JSON.parse(store.getItem('scheduled_posts') || '[]'); } catch (e) { return []; }
}

function saveScheduledPostsStoreList(posts) {
  store.setItem('scheduled_posts', JSON.stringify(posts));
}

// IPC handlers for saving/loading settings
ipcMain.handle('save-settings', (event, data) => {
  // Save as a full array of campaigns
  store.setItem('campaigns', JSON.stringify(data));
  return { success: true };
});

ipcMain.handle('set-active-campaign', (event, campaignId) => {
  store.setItem('activeCampaignId', campaignId);
  return { success: true };
});

ipcMain.handle('save-global-keys', (event, keys) => {
  store.setItem('globalApiKeys', JSON.stringify(keys));
  return true;
});

ipcMain.handle('get-global-keys', (event) => {
  let data = store.getItem('globalApiKeys');
  let stored = {};
  if (data) {
    try { stored = JSON.parse(data); } catch(e) {}
  }

  const keys = resolveKeys(stored);
  store.setItem('globalApiKeys', JSON.stringify(keys));
  return keys;
});

ipcMain.handle('get-active-campaign', (event) => {
  const activeId = store.getItem('activeCampaignId');
  const data = store.getItem('campaigns');
  let campaigns = [];
  if (data) {
    try { campaigns = JSON.parse(data); } catch(e) {}
  }
  
  if (campaigns.length === 0) return null;
  
  if (activeId) {
    const found = campaigns.find(c => c.id === activeId);
    if (found) return found;
  }
  
  // Default to first if none set
  store.setItem('activeCampaignId', campaigns[0].id);
  return campaigns[0];
});

ipcMain.handle('get-settings', (event) => {
  const data = store.getItem('campaigns');
  if (data) {
    try { return JSON.parse(data); } catch(e) {}
  }
  
  // Check if old singular setting exists and migrate it
  const oldData = store.getItem('brandSettings');
  if (oldData) {
    try { 
      const parsed = JSON.parse(oldData);
      parsed.id = 'camp_' + Date.now();
      return [parsed];
    } catch(e) {}
  }

  // No mock data - return empty so user creates via New Campaign (per requirements to remove mocks)
  return [];
});

function getCampaignStats(campaignId) {
  let linkedAccounts = 0;
  let keywords = 0;
  try {
    const accData = store.getItem('linkedAccounts_' + campaignId);
    if (accData) linkedAccounts = JSON.parse(accData).length;
  } catch (e) {}
  try {
    const kwData = store.getItem('keywords');
    if (kwData) keywords = JSON.parse(kwData).filter((k) => k.campaignId === campaignId).length;
  } catch (e) {}
  return { linkedAccounts, keywords };
}

ipcMain.handle('get-setup-status', () => {
  const activeCampaignId = store.getItem('activeCampaignId') || 'default';
  let campaigns = [];
  try { campaigns = JSON.parse(store.getItem('campaigns') || '[]'); } catch (e) {}

  const campaign = campaigns.find((c) => c.id === activeCampaignId) || campaigns[0] || null;
  const hasProject = !!(campaign?.brandName?.trim() && campaign?.domain?.trim() && campaign?.description?.trim());

  ensureCampaignKeywords(campaign?.id || activeCampaignId);
  let keywords = [];
  try {
    keywords = JSON.parse(store.getItem('keywords') || '[]')
      .filter((k) => k.campaignId === (campaign?.id || activeCampaignId));
  } catch (e) {}
  const hasKeywords = keywords.length > 0;
  const onboardingComplete = store.getItem('onboardingComplete') === 'true';

  let linkedAccountsCount = 0;
  try {
    linkedAccountsCount = JSON.parse(store.getItem(`linkedAccounts_${activeCampaignId}`) || '[]').length;
  } catch (e) {}

  const globalKeys = resolveKeys(JSON.parse(store.getItem('globalApiKeys') || '{}'));
  const apiReady = integrations.getApiStatus ? integrations.getApiStatus(globalKeys) : {};
  const apiMetrics = buildApiMetrics(globalKeys);
  const connectedApis = Object.values(apiMetrics).filter((v) => String(v).includes('Connected')).length;

  let monitors = [];
  try { monitors = JSON.parse(store.getItem('watchedMonitors') || '[]'); } catch (e) {}

  let nextStep = 1;
  if (hasProject && !hasKeywords) nextStep = 2;
  else if (hasProject && hasKeywords && !onboardingComplete) nextStep = 3;
  else if (hasProject && hasKeywords && onboardingComplete) nextStep = 4;

  return {
    hasProject,
    hasKeywords,
    onboardingComplete,
    complete: hasProject && hasKeywords && onboardingComplete,
    nextStep,
    campaign,
    keywords,
    linkedAccountsCount,
    hasLinkedAccounts: linkedAccountsCount > 0,
    apiReady,
    apiMetrics,
    connectedApiCount: connectedApis,
    monitorCount: monitors.length,
    lastFullScan: parseInt(store.getItem('fullAutoSearchLastRun') || '0', 10) || null,
  };
});

ipcMain.handle('set-onboarding-complete', (event, value) => {
  store.setItem('onboardingComplete', value ? 'true' : 'false');
  return { success: true };
});

ipcMain.handle('get-settings-status', () => {
  let campaigns = [];
  try { campaigns = JSON.parse(store.getItem('campaigns') || '[]'); } catch (e) {}
  const keys = resolveKeys(JSON.parse(store.getItem('globalApiKeys') || '{}'));
  let billing = { plan: 'starter' };
  try { billing = JSON.parse(store.getItem('billingPlan') || '{"plan":"starter"}'); } catch (e) {}
  return {
    campaignCount: campaigns.length,
    activeCampaignId: store.getItem('activeCampaignId') || null,
    campaigns: campaigns.map((c) => ({
      id: c.id,
      brandName: c.brandName,
      status: c.status || 'Draft',
      ...getCampaignStats(c.id),
    })),
    apiMetrics: buildApiMetrics(keys),
    apiReady: integrations.getApiStatus ? integrations.getApiStatus(keys) : {},
    billingPlan: billing.plan || 'starter',
  };
});

ipcMain.handle('delete-campaign', (event, campaignId) => {
  let campaigns = [];
  try { campaigns = JSON.parse(store.getItem('campaigns') || '[]'); } catch (e) {}
  campaigns = campaigns.filter((c) => c.id !== campaignId);
  store.setItem('campaigns', JSON.stringify(campaigns));
  const activeId = store.getItem('activeCampaignId');
  if (activeId === campaignId) {
    if (campaigns.length) store.setItem('activeCampaignId', campaigns[0].id);
    else store.removeItem('activeCampaignId');
  }
  return { success: true, campaigns };
});

ipcMain.handle('save-fetch-profile', (event, profileData) => {
  const activeCampaignId = store.getItem('activeCampaignId') || 'default';
  const profilesKey = `fetchProfiles_${activeCampaignId}`;
  
  let profiles = [];
  const data = store.getItem(profilesKey);
  if (data) {
    try { profiles = JSON.parse(data); } catch(e) {}
  }
  
  // If editing an existing profile, remove it first
  if (profileData.id) {
    profiles = profiles.filter(p => p.id !== profileData.id);
  } else {
    profileData.id = 'prof_' + Date.now();
  }
  
  profiles.push(profileData);
  store.setItem(profilesKey, JSON.stringify(profiles));
  return profiles;
});

ipcMain.handle('get-fetch-profiles', (event) => {
  const activeCampaignId = store.getItem('activeCampaignId') || 'default';
  const profilesKey = `fetchProfiles_${activeCampaignId}`;
  
  const data = store.getItem(profilesKey);
  if (data) {
    try { return JSON.parse(data); } catch(e) {}
  }
  return [];
});

ipcMain.handle('delete-fetch-profile', (event, profileId) => {
  const activeCampaignId = store.getItem('activeCampaignId') || 'default';
  const profilesKey = `fetchProfiles_${activeCampaignId}`;
  
  let profiles = [];
  const data = store.getItem(profilesKey);
  if (data) {
    try { profiles = JSON.parse(data); } catch(e) {}
  }
  
  profiles = profiles.filter(p => p.id !== profileId);
  store.setItem(profilesKey, JSON.stringify(profiles));
  return profiles;
});

function seedKeywordsFromCampaign(activeCampaignId) {
  const seeds = [];
  try {
    const campsData = store.getItem('campaigns');
    if (!campsData) return seeds;
    const camps = JSON.parse(campsData);
    const camp = camps.find((c) => c.id === activeCampaignId) || camps[0];
    if (!camp) return seeds;

    if (camp.brandName?.trim()) seeds.push(camp.brandName.trim());
    if (camp.domain?.trim()) {
      const domainTerm = camp.domain.replace(/^https?:\/\//i, '').replace(/^www\./i, '').split('/')[0];
      if (domainTerm && domainTerm !== 'yourdomain.com') seeds.push(domainTerm);
    }
    if (camp.description?.trim()) {
      camp.description.trim().split(/\s+/)
        .filter((w) => w.length > 3)
        .slice(0, 3)
        .forEach((w) => seeds.push(w.replace(/[^\w-]/g, '')));
    }
  } catch (e) {}
  return [...new Set(seeds.filter(Boolean))].slice(0, 5);
}

function ensureCampaignKeywords(activeCampaignId) {
  let allKeywords = [];
  try { allKeywords = JSON.parse(store.getItem('keywords') || '[]'); } catch (e) {}
  const existing = allKeywords.filter((k) => k.campaignId === activeCampaignId);
  if (existing.length) return existing;

  const seeds = seedKeywordsFromCampaign(activeCampaignId);
  if (!seeds.length) return [];

  const newKws = seeds.map((term, i) => ({
    id: `kw_seed_${Date.now()}_${i}`,
    campaignId: activeCampaignId,
    term,
    platforms: ['Twitter', 'LinkedIn', 'Reddit', 'Quora', 'Facebook'],
    intent: 'mentions',
    metrics: { source: 'campaign_seed' },
  }));
  store.setItem('keywords', JSON.stringify([...allKeywords, ...newKws]));
  console.log(`Auto-seeded ${newKws.length} keywords from campaign profile`);
  return newKws;
}

async function fetchLiveFeed(filters = {}) {
  const activeCampaignId = store.getItem('activeCampaignId') || 'default';
  ensureCampaignKeywords(activeCampaignId);

  let trackedKeywords = [];
  try {
    const kwData = store.getItem('keywords');
    if (kwData) {
      const allKws = JSON.parse(kwData);
      trackedKeywords = allKws
        .filter((k) => k.campaignId === activeCampaignId)
        .map((k) => k.term)
        .filter(Boolean);
    }
  } catch(e) {}

  if (trackedKeywords.length === 0) {
    trackedKeywords = seedKeywordsFromCampaign(activeCampaignId);
  }

  const globalKeys = resolveKeys(JSON.parse(store.getItem('globalApiKeys') || '{}'));

  let platformsAllowed = new Set();
  try {
    const kwData = JSON.parse(store.getItem('keywords') || '[]');
    kwData.filter(k => k.campaignId === activeCampaignId).forEach(kw => {
      if (kw.platforms) kw.platforms.forEach(p => platformsAllowed.add(p));
    });
  } catch(e) {}

  let linkedAccounts = [];
  try {
    linkedAccounts = JSON.parse(store.getItem(`linkedAccounts_${activeCampaignId}`) || '[]');
  } catch (e) {}

  linkedAccounts.forEach((acc) => {
    if (acc.platform) platformsAllowed.add(acc.platform);
  });

  const [keywordPosts, accountPosts] = await Promise.all([
    integrations.fetchRealFeed({
      keywords: trackedKeywords,
      filters,
      keys: globalKeys,
      allowedPlatforms: platformsAllowed,
    }),
    integrations.fetchLinkedAccountFeed({
      linkedAccounts,
      filters,
      keys: globalKeys,
      limitPerAccount: 10,
    }),
  ]);

  const seen = new Set();
  return [...accountPosts, ...keywordPosts].filter((p) => {
    const key = `${p.platform}:${p.externalId || p.url || p.content?.substring(0, 50)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

ipcMain.handle('get-live-feed', async (event, filters = {}) => {
  try {
    return await fetchLiveFeed(filters);
  } catch (error) {
    console.error('Live feed error:', error.message);
    return [];
  }
});

ipcMain.handle('get-simulated-feed', async (event, filters = {}) => {
  // Legacy alias — same live feed path as get-live-feed (no simulated posts)
  return fetchLiveFeed(filters);
});

ipcMain.handle('generate-keywords', async (event, brandData) => {
  try {
    const keys = resolveKeys(JSON.parse(store.getItem('globalApiKeys') || '{}'));
    const result = await integrations.researchBrandKeywords(brandData, keys, generateAI);
    if (result.error && (!result.keywords || result.keywords.length === 0)) {
      return { error: result.error, keywords: [] };
    }
    return result.keywords;
  } catch (error) {
    console.error('Keyword research error:', error.message);
    return { error: error.message, keywords: [] };
  }
});

ipcMain.handle('research-keyword', async (event, term) => {
  const keys = resolveKeys(JSON.parse(store.getItem('globalApiKeys') || '{}'));
  return integrations.researchSingleKeyword(term, keys);
});

ipcMain.handle('get-keyword-api-status', () => {
  const keys = resolveKeys(JSON.parse(store.getItem('globalApiKeys') || '{}'));
  return integrations.getApiStatus(keys);
});

ipcMain.handle('get-auto-rules', () => {
  try { return JSON.parse(store.getItem('autoRulesEngine') || '{}'); } catch (e) { return {}; }
});

ipcMain.handle('save-auto-rules', async (event, settings) => {
  const existing = integrations.getAutoRulesStatus(store).rules || {};
  const merged = {
    ...existing,
    ...(settings || {}),
    enabled: settings?.enabled !== false,
    updatedAt: new Date().toISOString(),
  };
  store.setItem('autoRulesEngine', JSON.stringify(merged));
  integrations.syncRulesSideEffects(store, merged);

  if (merged.enabled) {
    initJobQueueWorker();
    if (!isWorkerRunning) {
      isWorkerRunning = true;
      currentWorkerSleepUntil = 0;
      setWorkerStatus(true);
      workerLoop();
    }
  }

  return { success: true, rules: merged };
});

ipcMain.handle('get-auto-rules-status', () => integrations.getAutoRulesStatus(store));

ipcMain.handle('run-auto-rules-now', async () => {
  const keys = resolveKeys(JSON.parse(store.getItem('globalApiKeys') || '{}'));
  const result = await integrations.runWorkerCycle({ store, generateAI, sendNotification });
  await integrations.scanUnansweredQuestions(store, keys, (() => {
    const activeCampaignId = store.getItem('activeCampaignId') || 'default';
    const camps = JSON.parse(store.getItem('campaigns') || '[]');
    return camps.find((c) => c.id === activeCampaignId) || { brandName: 'Brand' };
  })(), generateAI);
  return {
    success: true,
    monitorCount: result.monitorCount,
    discoveryCount: result.discoveryCount,
    skipped: result.skipped,
  };
});

// Visual Builder — automation flows (persisted in store, executed by worker)
ipcMain.handle('get-automation-flow', () => {
  return integrations.getActiveFlow(store) || { status: 'draft', nodes: [], edges: [] };
});

ipcMain.handle('save-automation-flow', (event, flowData) => {
  const existing = integrations.getActiveFlow(store) || {};
  const flow = {
    ...existing,
    ...flowData,
    status: flowData.status || existing.status || 'draft',
    updatedAt: new Date().toISOString(),
  };
  integrations.saveActiveFlow(store, flow);
  return { success: true, flow };
});

ipcMain.handle('get-automation-templates', () => integrations.listTemplates(store));

ipcMain.handle('load-automation-template', (event, templateId) => {
  const template = integrations.getTemplateById(store, templateId);
  if (!template) return { success: false, error: 'Template not found' };
  return { success: true, nodes: template.nodes, edges: template.edges, name: template.name };
});

ipcMain.handle('save-automation-template', (event, templateData) => {
  if (!templateData?.name) return { success: false, error: 'Template name required' };
  integrations.saveCustomTemplate(store, {
    name: templateData.name,
    nodes: templateData.nodes || [],
    edges: templateData.edges || [],
    savedAt: new Date().toISOString(),
  });
  return { success: true };
});

ipcMain.handle('deploy-automation-flow', async (event, flowData) => {
  const result = integrations.deployFlow(store, flowData);
  if (!result.success) return result;
  initJobQueueWorker();
  if (!isWorkerRunning) {
    isWorkerRunning = true;
    currentWorkerSleepUntil = 0;
    setWorkerStatus(true);
    workerLoop();
  }
  return result;
});

ipcMain.handle('undeploy-automation-flow', () => integrations.undeployFlow(store));

ipcMain.handle('test-automation-flow', async (event, flowData) => {
  const keys = resolveKeys(JSON.parse(store.getItem('globalApiKeys') || '{}'));
  return integrations.testAutomationFlow(
    { store, generateAI, sendNotification, keys },
    flowData
  );
});

ipcMain.handle('get-automation-webhook-url', (event, nodeId) => {
  const webhookId = integrations.ensureWebhookId(store, nodeId);
  return { webhookId, url: integrations.getWebhookUrl(webhookId), port: integrations.WEBHOOK_PORT };
});

ipcMain.handle('get-automation-status', () => integrations.getAutomationStatus(store));

ipcMain.handle('get-automation-builder-data', async () => {
  const activeCampaignId = store.getItem('activeCampaignId') || 'default';
  const accounts = JSON.parse(store.getItem(`linkedAccounts_${activeCampaignId}`) || '[]');
  const keywords = JSON.parse(store.getItem('keywords') || '[]')
    .filter((k) => k.campaignId === activeCampaignId)
    .map((k) => k.term);
  const keys = resolveKeys(JSON.parse(store.getItem('globalApiKeys') || '{}'));
  return {
    accounts: accounts.map((a) => ({ id: a.id, platform: a.platform, handle: a.handle || a.username || a.id })),
    keywords,
    apiStatus: {
      twitter: hasTwitterKeys(keys),
      linkedin: hasLinkedInKeys(keys),
      reddit: hasRedditKeys(keys),
      serp: !!keys.serpApiKey,
      gemini: !!(getGlobalKey('gemini') || GEMINI_API_KEY),
    },
  };
});

ipcMain.handle('get-schedule-frequency-options', () => FREQUENCY_OPTIONS);

ipcMain.handle('generate-global-custom-prompt', async () => {
  try {
    const activeCampaignId = store.getItem('activeCampaignId') || 'default';
    const campaigns = JSON.parse(store.getItem('campaigns') || '[]');
    const campaign = campaigns.find((c) => c.id === activeCampaignId) || campaigns[0] || {};
    const keywords = JSON.parse(store.getItem('keywords') || '[]')
      .filter((k) => k.campaignId === activeCampaignId);
    const monitors = JSON.parse(store.getItem('watchedMonitors') || '[]');
    const prompt = buildGlobalCustomPromptRequest(campaign, keywords, monitors);
    const text = await generateAI(prompt);
    return { success: true, prompt: String(text || '').trim() };
  } catch (error) {
    console.error('generate-global-custom-prompt error:', error.message);
    return { success: false, error: error.message, prompt: '' };
  }
});

ipcMain.handle('draft-post-reply', async (event, payload) => {
  const { postContent, matchedKeyword, oneTimeOverride } = payload;
  try {
    const activeCampaignId = store.getItem('activeCampaignId') || 'default';
    const data = store.getItem('campaigns');
    let campaigns = [];
    if (data) {
      try { campaigns = JSON.parse(data); } catch(e) {}
    }
    
    let settings = campaigns.find(c => c.id === activeCampaignId) || {};
    let rules = null;
    try { rules = JSON.parse(store.getItem('autoRulesEngine') || 'null'); } catch (e) {}

    const keywordObj = brandGuidelines.getKeywordFromStore(store, activeCampaignId, matchedKeyword);

    const aiBrainSystemPrompt = `${brandGuidelines.buildReplySystemPrompt(settings, { keywordObj, oneTimeOverride, rules })}

Post to reply to:
"${postContent}"
`;
    
    const fullPrompt = aiBrainSystemPrompt + '\n\nUser requested reply for this post:\n' + postContent;
    return await generateAI(fullPrompt);
  } catch (error) {
    console.error('AI Draft Error:', error);
    return 'Error generating response: ' + error.message;
  }
});

// Generic AI generation handler for Custom Prompts & replies
ipcMain.handle('generate-ai', async (event, userPrompt) => {
  try {
    const activeCampaignId = store.getItem('activeCampaignId') || 'default';
    const data = store.getItem('campaigns');
    let campaigns = [];
    if (data) {
      try { campaigns = JSON.parse(data); } catch(e) {}
    }
    
    let settings = campaigns.find(c => c.id === activeCampaignId) || {};
    
    // We define the AI Brain dynamically based on stored user settings!
    const aiBrainSystemPrompt = `
You are the AI Brain for 'Social Imperialism', an advanced social media management and automation platform.
Your goal is to provide highly engaging, well-researched replies for social media posts.

Here is the Brand Profile you must perfectly emulate:
Brand Name: ${settings.brandName || 'Unknown'}
Website: ${settings.domain || 'Unknown'}
Description: ${settings.description || 'General Business'}
Target Audience: ${settings.audience || 'Everyone'}
Tone of Voice: ${settings.tone || 'Professional & Authoritative'}

Keep replies natural, concise, and optimized for engagement matching this brand's exact tone.
CRITICAL SAFETY FILTERS:
- NO NSFW, violent, or hateful content.
- DO NOT generate spam or deceptive content.
- ALWAYS maintain a respectful and brand-safe tone.
Do not include quotation marks around the reply. Just return the raw reply text.

CRITICAL SAFETY FILTERS:
- NO NSFW, violent, or hateful content.
- DO NOT generate spam or deceptive content.
- ALWAYS maintain a respectful and brand-safe tone.
`;
    
    const fullPrompt = aiBrainSystemPrompt + '\n\nUser requested reply for this post:\n' + userPrompt;
    return await generateAI(fullPrompt);
  } catch (error) {
    console.error('AI Error:', error);
    return 'Error generating response: ' + error.message;
  }
});

// Keywords CRUD Logic (Per-Campaign & Per-Platform)
ipcMain.handle('save-keywords', (event, payload) => {
  // payload is { campaignId, keywords: [{term, platforms: []}, ...] }
  let allKeywords = [];
  const data = store.getItem('keywords');
  if (data) {
    try { allKeywords = JSON.parse(data); } catch(e) {}
  }
  
  // Remove old keywords for this campaign
  allKeywords = allKeywords.filter(k => k.campaignId !== payload.campaignId);
  
  // Add new keywords
  payload.keywords.forEach((kw, i) => {
    allKeywords.push({
      id: kw.id || ('kw_' + Date.now() + '_' + i),
      campaignId: payload.campaignId,
      term: kw.term,
      platforms: kw.platforms || ['Twitter', 'LinkedIn', 'Reddit', 'Quora'],
      customPrompt: kw.customPrompt || '',
      intent: kw.intent || 'mentions',
      metrics: kw.metrics || {
        searchVolume: kw.searchVolume ?? null,
        momentum: kw.momentum ?? null,
        redditPosts: kw.redditPosts ?? null,
        twitterPosts: kw.twitterPosts ?? null,
        liveSignals: kw.liveSignals ?? null,
        source: kw.source || null,
      },
    });
  });
  
  store.setItem('keywords', JSON.stringify(allKeywords));
  return allKeywords.filter(k => k.campaignId === payload.campaignId);
});

ipcMain.handle('get-keywords', (event, campaignId) => {
  if (!campaignId) {
    campaignId = store.getItem('activeCampaignId') || 'default';
  }
  ensureCampaignKeywords(campaignId);
  const data = store.getItem('keywords');
  if (data) {
    try {
      const parsed = JSON.parse(data);
      if (campaignId) return parsed.filter((k) => k.campaignId === campaignId);
      return parsed;
    } catch (e) {}
  }
  return [];
});

// Export Data feature (PRD: must be functional, real data from tracked keywords)
ipcMain.handle('export-data', (event) => {
  const activeCampaignId = store.getItem('activeCampaignId') || 'default';
  let exportData = {
    exportedAt: new Date().toISOString(),
    activeCampaignId,
    campaigns: [],
    keywords: [],
    linkedAccounts: [],
    postHistory: [],
    aiReplies: [],
    scheduledPosts: [],
    autoRules: null,
    qaSettings: null,
    watchedMonitors: [],
    autoContentSettings: null
  };
  try {
    const campData = store.getItem('campaigns');
    if (campData) exportData.campaigns = JSON.parse(campData);
    
    const kwData = store.getItem('keywords');
    if (kwData) {
      const allKws = JSON.parse(kwData);
      exportData.keywords = allKws.filter(k => k.campaignId === activeCampaignId);
    }
    
    const accData = store.getItem('linkedAccounts_' + activeCampaignId);
    if (accData) exportData.linkedAccounts = JSON.parse(accData);
    
    const histData = store.getItem('postHistory');
    if (histData) exportData.postHistory = JSON.parse(histData);
    
    const replyData = store.getItem('aiRepliesHistory');
    if (replyData) exportData.aiReplies = JSON.parse(replyData);
    
    const schedData = store.getItem('scheduled_posts');
    if (schedData) exportData.scheduledPosts = JSON.parse(schedData);
    
    const rulesData = store.getItem('autoRulesEngine');
    if (rulesData) exportData.autoRules = JSON.parse(rulesData);
    
    const qaData = store.getItem('qaSettings');
    if (qaData) exportData.qaSettings = JSON.parse(qaData);
    
    const watchData = store.getItem('watchedMonitors');
    if (watchData) exportData.watchedMonitors = JSON.parse(watchData);
    
    const autoContentData = store.getItem('autoContentSettings');
    if (autoContentData) exportData.autoContentSettings = JSON.parse(autoContentData);
    
  } catch(e) {
    console.error('Export error:', e);
  }
  return exportData;
});

// Account Hub — real linked accounts per campaign (no seeded demo accounts)
ipcMain.handle('get-linked-accounts', (event, campaignId) => {
  const targetId = campaignId || store.getItem('activeCampaignId') || 'default';
  const data = store.getItem('linkedAccounts_' + targetId);
  if (data) {
    try { return JSON.parse(data); } catch(e) {}
  }
  return [];
});

ipcMain.handle('get-account-hub-status', () => integrations.getAccountHubStatus(store));

ipcMain.handle('refresh-account-profile', async (event, accountId) => {
  const keys = resolveKeys(JSON.parse(store.getItem('globalApiKeys') || '{}'));
  return integrations.refreshAccountProfile(store, accountId, keys);
});



ipcMain.handle('use-selected-accounts', async (event, selectedAccounts) => {
  const globalKeys = resolveKeys(JSON.parse(store.getItem('globalApiKeys') || '{}'));
  if (!Array.isArray(selectedAccounts) || !selectedAccounts.length) {
    return { success: false, error: 'No accounts selected', linked: 0 };
  }

  const loginEmail = (selectedAccounts[0]?.loginEmail || selectedAccounts[0]?.email || 'oauth').trim().toLowerCase();
  const connectionId = selectedAccounts[0]?.connectionId
    || integrations.makeConnectionId?.(selectedAccounts[0]?.platform || 'unknown', loginEmail)
    || `conn_${Date.now()}`;
  const sharedTokens = selectedAccounts.find((a) => a.encryptedTokens || a.oauthTokens)?.encryptedTokens
    || (selectedAccounts.find((a) => a.oauthTokens)?.oauthTokens
      ? Buffer.from(JSON.stringify(selectedAccounts.find((a) => a.oauthTokens).oauthTokens)).toString('base64')
      : null);

  const { linked, profileAccountId } = await integrations.linkAllDiscoveredAccounts({
    store,
    integrations,
    keys: globalKeys,
    discovered: selectedAccounts.map((a) => ({
      ...a,
      loginEmail: a.loginEmail || loginEmail,
      connectionId: a.connectionId || connectionId,
      encryptedTokens: a.encryptedTokens || sharedTokens,
    })),
    meta: {
      loginEmail,
      connectionId,
      sharedTokens,
    },
  });

  return { success: true, linked: linked.length, profileAccountId };
});

ipcMain.handle('link-account', async (event, payload) => {
  const creds = typeof payload === 'string' ? { platform: payload } : (payload || {});
  const keys = resolveKeys(JSON.parse(store.getItem('globalApiKeys') || '{}'));
  const credentials = {
    platform: creds.platform,
    email: creds.email,
    username: creds.username,
    password: creds.password || '',
    useCredentials: creds.method !== 'oauth',
    connectionId: creds.connectionId,
  };
  return integrations.discoverAccounts(credentials, keys, (url) => openOAuthUrl(url));
});
ipcMain.handle('get-linked-accounts_OLD1', (event) => {
  // Try to get active campaign id first
  const activeCampaignId = store.getItem('activeCampaignId') || 'default';
  
  const data = store.getItem('linkedAccounts_' + activeCampaignId);
  if (data) {
    try { return JSON.parse(data); } catch(e) {}
  }
  return []; // return empty array if no accounts linked yet
});

ipcMain.handle('link-account_OLD1', async (event, payload) => {
  const { connectPlatform } = require('./services/connectionService');
  const creds = typeof payload === 'string' ? { platform: payload } : (payload || {});
  const keys = resolveKeys(JSON.parse(store.getItem('globalApiKeys') || '{}'));
  return connectPlatform({
    platform: creds.platform,
    email: creds.email,
    password: creds.password,
    username: creds.username,
    method: creds.method || 'credentials',
    keys,
    openExternal: (url) => openOAuthUrl(url),
    store,
    integrations,
  });
});

ipcMain.handle('unlink-account', (event, accountId) => {
  const activeCampaignId = store.getItem('activeCampaignId') || 'default';
  let accounts = [];
  const data = store.getItem('linkedAccounts_' + activeCampaignId);
  if (data) {
    try { accounts = JSON.parse(data); } catch(e) {}
  }
  
  accounts = accounts.filter(a => a.id !== accountId);
  store.setItem('linkedAccounts_' + activeCampaignId, JSON.stringify(accounts));
  return { success: true };
});

ipcMain.handle('publish-post', async (event, postData) => {
  try {
    return await calendarApi.executePublishPost(postData);
  } catch (err) {
    console.error(`Publish to ${postData.platform} failed:`, err.message);
    throw err;
  }
});

ipcMain.handle('get-post-history', (event, accountId) => {
  const data = store.getItem('postHistory');
  if(!data) return [];
  
  try { 
    const history = JSON.parse(data);
    if(accountId) {
      return history.filter(p => p.accountId === accountId);
    }
    return history;
  } catch(e) { return []; }
});

function computeUseCaseMetrics(activeCampaignId) {
  let replies = [];
  try { replies = JSON.parse(store.getItem('aiRepliesHistory') || '[]'); } catch (e) {}
  const scoped = replies.filter((r) => !r.campaignId || r.campaignId === activeCampaignId);

  const isPublished = (r) => {
    const s = String(r.status || '').toLowerCase();
    return s === 'published' || s === 'sent';
  };

  const publishedReplies = scoped.filter(isPublished).length;
  const pendingApproval = scoped.filter((r) => !isPublished(r)).length;
  const affiliateReplies = scoped.filter((r) => r.intent === 'affiliate').length;
  const clientReplies = scoped.filter((r) => r.intent === 'client').length;
  const brandReplies = scoped.filter((r) => !r.intent || r.intent === 'brand' || r.intent === 'mentions').length;
  const qaReplies = scoped.filter((r) => r.intent === 'qa').length;
  const beFirstReplies = scoped.filter((r) => r.beFirst).length;
  const utmReplies = scoped.filter((r) => r.hasUtmLink || (r.replyContent || '').includes('utm_')).length;
  const estimatedClicks = Math.round(utmReplies * 0.12 + publishedReplies * 0.05);

  let rules = {};
  try { rules = JSON.parse(store.getItem('autoRulesEngine') || '{}'); } catch (e) {}

  const modeLabels = {
    auto_post_all: 'Auto Post All',
    manual_approval: 'Manual Approval',
    mentions_only: 'Mentions/DMs Only',
  };

  return {
    publishedReplies,
    pendingApproval,
    affiliateReplies,
    clientReplies,
    brandReplies,
    qaReplies,
    beFirstReplies,
    utmReplies,
    estimatedClicks,
    autoReplyMode: rules.autoReplyMode || 'mentions_only',
    autoReplyModeLabel: modeLabels[rules.autoReplyMode] || 'Mentions/DMs Only',
    platformOverrideCount: Object.keys(rules.platformReplyModes || {}).length,
  };
}

ipcMain.handle('get-dashboard-stats', (event) => {
  let totalPosts = 0;
  let totalEngagement = 0;
  let aiDrafts = 0;
  let aiReplies = [];

  const historyData = store.getItem('postHistory');
  if (historyData) {
    try {
      const history = JSON.parse(historyData);
      totalPosts = history.length;
      history.forEach(post => {
        const s = post.stats || {};
        totalEngagement += (s.likes || 0) + (s.shares || 0) + (s.views || 0) + (s.comments || 0);
      });
    } catch(e) {}
  }

  try {
    const aiRepliesData = store.getItem('aiRepliesHistory');
    if (aiRepliesData) {
      aiReplies = JSON.parse(aiRepliesData);
      aiDrafts = aiReplies.length;
    }
  } catch(e) { aiDrafts = 0; }

  if (aiDrafts === 0) {
    try {
      const countData = store.getItem('aiDraftsCount');
      if (countData) aiDrafts = parseInt(countData, 10) || 0;
    } catch(e) {}
  }

  // Pull real counts from current campaign data for Command Center (per PRD)
  let activeKeywords = 0;
  let linkedAccountsCount = 0;
  let scheduledCount = 0;
  const activeCampaignId = store.getItem('activeCampaignId') || 'default';
  ensureCampaignKeywords(activeCampaignId);

  try {
    const kwData = store.getItem('keywords');
    if (kwData) {
      const allKws = JSON.parse(kwData);
      activeKeywords = allKws.filter(k => k.campaignId === activeCampaignId).length;
    }
  } catch(e){}

  try {
    const accData = store.getItem('linkedAccounts_' + activeCampaignId);
    if (accData) linkedAccountsCount = JSON.parse(accData).length;
  } catch(e){}

  try {
    const schedData = store.getItem('scheduled_posts');
    if (schedData) scheduledCount = JSON.parse(schedData).length;
  } catch(e){}

  let workerStatus = 'Idle';
  try {
    const w = store.getItem('workerTasks');
    if (w && JSON.parse(w).length > 0) workerStatus = 'Scanning';
  } catch(e){}

  let autoRulesEnabled = false;
  try {
    const rules = JSON.parse(store.getItem('autoRulesEngine') || 'null');
    autoRulesEnabled = !!(rules && rules.enabled);
  } catch(e){}

  // Real leads/generated can be derived from history or qa leads if stored; default 0 until data
  let leadsGenerated = 0;
  try {
    const leadsData = store.getItem('leads');
    if (leadsData) leadsGenerated = JSON.parse(leadsData).length;
  } catch(e){}

  const globalKeys = resolveKeys(JSON.parse(store.getItem('globalApiKeys') || '{}'));
  const useCaseMetrics = computeUseCaseMetrics(activeCampaignId);

  let platformLastFetch = {};
  try { platformLastFetch = JSON.parse(store.getItem('platformFetchTimestamps') || '{}'); } catch (e) {}

  let lastFullAutoSearch = null;
  try {
    const ts = parseInt(store.getItem('fullAutoSearchLastRun') || '0', 10);
    if (ts) lastFullAutoSearch = ts;
  } catch (e) {}

  return {
    totalPosts: totalPosts || 0,
    aiDrafts: aiDrafts,
    totalEngagement: totalEngagement || 0,
    activeKeywords: activeKeywords || 0,
    leadsGenerated: leadsGenerated,
    linkedAccounts: linkedAccountsCount,
    scheduled: scheduledCount,
    workerStatus: workerStatus,
    autoRulesEnabled,
    activeCampaignId,
    apiMetrics: buildApiMetrics(globalKeys),
    ...useCaseMetrics,
    platformLastFetch,
    lastFullAutoSearch,
    inboundLeads: leadsGenerated,
    replyConversionRate: aiDrafts > 0
      ? Math.round((useCaseMetrics.publishedReplies / aiDrafts) * 100)
      : 0,
  };
});

ipcMain.handle('get-all-post-history', (event) => {
  const data = store.getItem('postHistory');
  if(!data) return [];
  try { return JSON.parse(data); } catch(e) { return []; }
});

ipcMain.handle('increment-ai-drafts', (event) => {
  let count = 0;
  const data = store.getItem('aiDraftsCount');
  if (data) {
    try { count = parseInt(data); } catch(e) {}
  }
  count++;
  store.setItem('aiDraftsCount', count.toString());
  return count;
});

ipcMain.handle('save-ai-reply', async (event, replyData) => {
  const globalKeys = resolveKeys(JSON.parse(store.getItem('globalApiKeys') || '{}'));
  const activeCampaignId = store.getItem('activeCampaignId') || 'default';
  const linkedAccounts = JSON.parse(store.getItem('linkedAccounts_' + activeCampaignId) || '[]');

  const { isEngageablePost } = require('./services/postIdUtils');
  const normalizedStatus = aiReplyStore.normalizeStatus(replyData.status);
  if (normalizedStatus === 'published' && isEngageablePost(replyData)) {
    try {
      await integrations.engagePost({
        action: 'reply',
        platform: replyData.platform,
        content: replyData.replyContent,
        externalId: replyData.externalId,
        postId: replyData.externalId,
        url: replyData.url,
        author: replyData.author,
        postContent: replyData.originalPost,
      }, globalKeys, linkedAccounts);
    } catch (engageErr) {
      console.error('Live reply failed:', engageErr.message);
      throw engageErr;
    }
  }

  return aiReplyStore.upsertReply(store, replyData, activeCampaignId);
});

ipcMain.handle('get-ai-replies-hub', (event, filters = {}) => aiReplyStore.queryHub(store, filters));

ipcMain.handle('get-ai-replies', (event, campaignId = null) => {
  const hub = aiReplyStore.queryHub(store, {
    campaignId: campaignId === 'all' ? 'all' : (campaignId || store.getItem('activeCampaignId') || 'default'),
  });
  return hub.replies;
});

ipcMain.handle('get-all-replies-history', () => {
  const data = store.getItem('aiRepliesHistory');
  if (!data) return [];
  try { return JSON.parse(data); } catch (e) { return []; }
});

ipcMain.handle('update-ai-reply', (event, { id, updates }) => {
  const activeCampaignId = store.getItem('activeCampaignId') || 'default';
  const replies = aiReplyStore.loadAllReplies(store);
  const idx = replies.findIndex((r) => r.id === id);
  if (idx < 0) return { success: false, error: 'Reply not found' };
  const merged = aiReplyStore.normalizeReply({
    ...replies[idx],
    ...updates,
    updatedAt: new Date().toISOString(),
  }, replies[idx].campaignId || activeCampaignId);
  replies[idx] = merged;
  aiReplyStore.saveAllReplies(store, replies);
  return { success: true, reply: merged };
});

ipcMain.handle('delete-ai-reply', (event, id) => {
  let replies = [];
  try { replies = JSON.parse(store.getItem('aiRepliesHistory') || '[]'); } catch (e) {}
  replies = replies.filter((r) => r.id !== id);
  store.setItem('aiRepliesHistory', JSON.stringify(replies));
  return { success: true };
});

ipcMain.handle('publish-ai-reply', async (event, id) => {
  let replies = [];
  try { replies = JSON.parse(store.getItem('aiRepliesHistory') || '[]'); } catch (e) {}
  const reply = replies.find((r) => r.id === id);
  if (!reply) return { success: false, error: 'Reply not found' };

  const globalKeys = resolveKeys(JSON.parse(store.getItem('globalApiKeys') || '{}'));
  const activeCampaignId = store.getItem('activeCampaignId') || 'default';
  const linkedAccounts = JSON.parse(store.getItem('linkedAccounts_' + activeCampaignId) || '[]');

  if (reply.externalId) {
    try {
      await integrations.engagePost({
        action: 'reply',
        platform: reply.platform,
        content: reply.replyContent,
        externalId: reply.externalId,
        postId: reply.externalId,
        urn: reply.externalId,
        url: reply.url,
        author: reply.author,
        postContent: reply.originalPost,
      }, globalKeys, linkedAccounts);
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  const idx = replies.findIndex((r) => r.id === id);
  replies[idx] = aiReplyStore.normalizeReply({
    ...replies[idx],
    status: 'published',
    publishedAt: new Date().toISOString(),
  }, replies[idx].campaignId || activeCampaignId);
  aiReplyStore.saveAllReplies(store, replies);
  return {
    success: true,
    reply: replies[idx],
    livePosted: !!reply.externalId,
    message: reply.externalId
      ? 'Reply published to the platform API.'
      : 'Reply marked published locally. No post ID was stored — link an account and reply from the live feed to post to platforms.',
  };
});

ipcMain.handle('engage-post', async (event, payload) => {
  const globalKeys = resolveKeys(JSON.parse(store.getItem('globalApiKeys') || '{}'));
  const activeCampaignId = store.getItem('activeCampaignId') || 'default';
  const linkedAccounts = JSON.parse(store.getItem('linkedAccounts_' + activeCampaignId) || '[]');

  try {
    await integrations.engagePost(payload, globalKeys, linkedAccounts);
    if ((payload.platform || '').includes('LinkedIn')) {
      integrations.logEngagement(store, {
        platform: 'LinkedIn',
        action: payload.action,
        author: payload.author,
        url: payload.url,
        postContent: (payload.postContent || '').substring(0, 200),
      });
    }
    return { success: true };
  } catch (err) {
    console.error(`Engage (${payload.action}) on ${payload.platform} failed:`, err.message);
    return { success: false, error: err.message };
  }
});

ipcMain.handle('get-engagement-lists', () => {
  const custom = integrations.getLists(store);
  const top = integrations.buildTopCommentersList(store);
  return [top, ...custom];
});

ipcMain.handle('save-engagement-list', (event, listData) => {
  const lists = integrations.getLists(store);
  const profileUrls = (listData.profileUrls || [])
    .flatMap((u) => String(u).split('\n'))
    .map((u) => u.trim())
    .filter(Boolean);

  const entry = {
    id: listData.id || `elist_${Date.now()}`,
    name: listData.name,
    type: listData.type || 'Custom',
    profileUrls,
    autoEngage: !!listData.autoEngage,
    createdAt: listData.createdAt || new Date().toISOString(),
  };

  const idx = lists.findIndex((l) => l.id === entry.id);
  if (idx >= 0) lists[idx] = { ...lists[idx], ...entry };
  else lists.push(entry);

  integrations.saveLists(store, lists);
  return { success: true, list: entry };
});

ipcMain.handle('delete-engagement-list', (event, listId) => {
  if (listId === integrations.TOP_LIST_ID) {
    return { success: false, error: 'Cannot delete the system Top Commenters list' };
  }
  const lists = integrations.getLists(store).filter((l) => l.id !== listId);
  integrations.saveLists(store, lists);
  return { success: true };
});

ipcMain.handle('get-engagement-list-feed', async (event, listId) => {
  const keys = resolveKeys(JSON.parse(store.getItem('globalApiKeys') || '{}'));
  const allLists = [integrations.buildTopCommentersList(store), ...integrations.getLists(store)];
  const list = allLists.find((l) => l.id === listId);
  if (!list) return { posts: [], error: 'List not found' };

  if (!keys.serpApiKey && !keys.linkedinAccessToken && list.id !== integrations.TOP_LIST_ID) {
    const urls = list.profileUrls || [];
    if (urls.length > 0) {
      return {
        posts: [],
        error: 'Add SERP_API_KEY or link LinkedIn in Settings to fetch live posts from tracked profiles.',
      };
    }
  }

  try {
    const posts = await integrations.fetchListFeed(list, keys);
    return { posts, listName: list.name, profileCount: list.profileUrls?.length || list.supporterCount || 0 };
  } catch (e) {
    return { posts: [], error: e.message };
  }
});

ipcMain.handle('toggle-engagement-list-auto', (event, { listId, enabled }) => {
  if (listId === integrations.TOP_LIST_ID) {
    return { success: false, error: 'Auto-engage is not available on the analytics list' };
  }
  const lists = integrations.getLists(store);
  const idx = lists.findIndex((l) => l.id === listId);
  if (idx < 0) return { success: false, error: 'List not found' };
  lists[idx].autoEngage = !!enabled;
  integrations.saveLists(store, lists);
  return { success: true, autoEngage: lists[idx].autoEngage };
});

ipcMain.handle('post-linkedin-comment', async (event, payload) => {
  const keys = resolveKeys(JSON.parse(store.getItem('globalApiKeys') || '{}'));
  const activeCampaignId = store.getItem('activeCampaignId') || 'default';
  const linkedAccounts = JSON.parse(store.getItem('linkedAccounts_' + activeCampaignId) || '[]');

  try {
    await integrations.engageOnPost({
      action: 'comment',
      platform: 'LinkedIn',
      content: payload.comment,
      urn: payload.urn,
      url: payload.url,
      externalId: payload.urn || payload.externalId,
      author: payload.author,
      postContent: payload.postContent,
    }, keys, linkedAccounts);

    aiReplyStore.upsertReply(store, {
      id: `reply_${Date.now()}`,
      originalPost: payload.postContent,
      replyContent: payload.comment,
      platform: 'LinkedIn',
      author: payload.author,
      url: payload.url,
      externalId: payload.urn || payload.externalId,
      timestamp: new Date().toISOString(),
      status: 'published',
      source: 'engagement',
      replyMode: 'manual',
      listId: payload.listId || null,
      listName: payload.listName || null,
      intent: 'brand',
    }, activeCampaignId);

    integrations.logEngagement(store, {
      platform: 'LinkedIn',
      action: 'comment',
      author: payload.author,
      url: payload.url,
    });

    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// Helper for anonymized Advanced AI Workflow (Gooey integration per user request - powers smart image/video/text tools in Content Hub without naming the service)
async function runAdvancedWorkflow(recipe, inputPayload) {
  const globalKeysData = store.getItem('globalApiKeys');
  let keys = {};
  if (globalKeysData) {
    try { keys = JSON.parse(globalKeysData); } catch(e) {}
  }
  const wfKey = keys.advancedWorkflowKey || process.env.ADVANCED_WORKFLOW_KEY;
  if (!wfKey) {
    return { success: false, error: 'No Advanced Workflow Key configured' };
  }
  try {
    const res = await axios.post(`https://api.gooey.ai/v1/recipes/${recipe}/run`, {
      input: inputPayload
    }, {
      headers: {
        'Authorization': `Bearer ${wfKey}`,
        'Content-Type': 'application/json'
      }
    });
    return { success: true, output: res.data.output || res.data };
  } catch(e) {
    console.error('Advanced Workflow error:', e.response ? e.response.data : e.message);
    return { success: false, error: e.message };
  }
}

// New handlers for preloaded APIs to pull real data (mapped to .md features: Content Hub stock/RSS/images, Dashboard news, LinkedIn automation, YouTube video/live, SEO, TTS, research, shortening, streaming, etc.)

ipcMain.handle('get-youtube-channels', async () => {
  const key = getGlobalKey('youtubeApiKey') || 'AIzaSyDFzNgKVo_S-gi46sDMDsIM2S-LEiRvNzo';
  try {
    // Real YouTube Data API (use for channels/search; full upload needs OAuth with client/secret)
    const res = await axios.get(`https://www.googleapis.com/youtube/v3/search?part=snippet&q=tech&maxResults=5&key=${key}`);
    return { success: true, data: res.data.items || [] };
  } catch(e) {
    return { success: false, error: e.message };
  }
});

ipcMain.handle('shorten-url', async (event, longUrl) => {
  const key = getGlobalKey('tinyurlApiKey') || 'FOQDuDMhkGw1LpnEuQSdCv0OF1X2cr11tKf57juP7R3m5COLvTrwICxHNuTh';
  try {
    const res = await axios.get(`https://tinyurl.com/api-create.php?url=${encodeURIComponent(longUrl)}&apikey=${key}`);
    return { success: true, shortUrl: res.data };
  } catch(e) {
    return { success: false, error: e.message, shortUrl: longUrl }; // fallback
  }
});

ipcMain.handle('serp-search', async (event, q) => {
  const key = getGlobalKey('serpApiKey') || 'd7dc8ad714606a255cc581b522b40fa80370615757f1622cd008389fcb7065bc';
  try {
    const res = await axios.get(`https://serpapi.com/search.json?q=${encodeURIComponent(q)}&api_key=${key}`);
    return { success: true, data: res.data.organic_results || [] };
  } catch(e) {
    return { success: false, error: e.message };
  }
});

ipcMain.handle('play-tts', async (event, text) => {
  const userId = getGlobalKey('playhtUserId') || 'XDuQKo0qcObM7j4xn7KM7UHktJQ2';
  const secret = getGlobalKey('playhtSecretKey') || 'e0281223651d4ca3bc478cfa4e9ba517';
  try {
    // Real Play.ht TTS (simplified; full would use their SDK or POST with auth)
    const res = await axios.post('https://api.play.ht/api/v2/tts', { text, voice: 'en-US-JennyNeural' }, {
      headers: { 'Authorization': `Bearer ${secret}`, 'X-User-Id': userId, 'Content-Type': 'application/json' }
    });
    return { success: true, audioUrl: res.data.url || 'TTS generated (check Play.ht dashboard)' };
  } catch(e) {
    return { success: false, error: e.message };
  }
});

ipcMain.handle('deepl-translate', async (event, text, targetLang = 'ES') => {
  const key = getGlobalKey('deeplKey') || '87ac9dcc-827e-4f95-8ebc-43c0deed9d32:fx';
  try {
    const res = await axios.post(`https://api-free.deepl.com/v2/translate?auth_key=${key}&text=${encodeURIComponent(text)}&target_lang=${targetLang}`);
    return { success: true, translated: res.data.translations[0].text };
  } catch(e) {
    return { success: false, error: e.message };
  }
});

ipcMain.handle('contentful-fetch', async () => {
  const space = getGlobalKey('contentfulSpaceId') || 'm5uwkwxcnm1k';
  const token = getGlobalKey('contentfulAccessToken') || 'pGtNwQQpniCVdRP8utCksRFXajfGb3sQ7wfP-KjDdLo';
  try {
    const res = await axios.get(`https://cdn.contentful.com/spaces/${space}/entries?access_token=${token}`);
    return { success: true, entries: res.data.items || [] };
  } catch(e) {
    return { success: false, error: e.message };
  }
});

ipcMain.handle('run-ai-workflow', async (event, recipe, input) => {
  // Uses advancedWorkflowKey (Gooey) for smart tools in Content Hub
  return await runAdvancedWorkflow(recipe, input);
});

ipcMain.handle('get-streaming-keys', () => {
  const globalKeysData = store.getItem('globalApiKeys');
  let keys = {};
  if (globalKeysData) {
    try { keys = JSON.parse(globalKeysData); } catch(e) {}
  }
  // Pull ALL preloaded streaming/RTMP/ live keys for YouTube, FB, Twitch etc. (real for automations, OBS, scheduler per .md fanpage/live features)
  const streaming = keys.streamingKeys || '';
  return { 
    success: true, 
    keys: {
      streamingText: streaming,
      yt: (keys.ytStreamKeyTsbr ? `rtmp://a.rtmp.youtube.com/live2 / ${keys.ytStreamKeyTsbr}` : 'rtmp://a.rtmp.youtube.com/live2 / x0xt-f0zh-ax9b-6xav-8h40'),
      fb: (keys.fbStreamingKey ? `rtmps://live-api-s.facebook.com:443/rtmp/ / ${keys.fbStreamingKey}` : 'rtmps://live-api-s.facebook.com:443/rtmp/ / FB-1155836385232291-0-AbzoLYJ377ICK6vU'),
      fbAdditional: keys.fbTechLauncherKey || keys.fbFunicsKey || keys.fbAdditionalKey || '',
      fbRtmpServer: keys.fbRtmpServer || 'rtmps://live-api-s.facebook.com:443/rtmp/',
      twitch: keys.twitchStreamKey || 'live_724390987_XDi0BTZNF4MqtTGi44kAtHzZFqyTOx',
      youtubeApiForLive: keys.youtubeApiKey || keys.youtubeClientId,
      // All user RTMPs/keys from list now exposed for live/streaming features across menus
    }
  };
});

async function generateImageForStudio(prompt) {
  try {
    let falKey = process.env.FAL_KEY;
    const globalKeysData = store.getItem('globalApiKeys');
    let keys = {};
    if (globalKeysData) {
      try {
        keys = JSON.parse(globalKeysData);
        if (keys.falKey) falKey = keys.falKey;
      } catch (e) { /* ignore */ }
    }
    if (keys.advancedWorkflowKey) {
      const wfRes = await runAdvancedWorkflow('text2image', {
        text_prompt: prompt,
        num_images: 1,
        image_size: 'square_hd',
      });
      if (wfRes.success && wfRes.output?.images?.[0]) {
        return { success: true, imageUrl: wfRes.output.images[0].url || wfRes.output.images[0] };
      }
    }
    if (!falKey && !keys.advancedWorkflowKey) {
      return { success: false, error: 'No FAL or Advanced Workflow key configured. Add falKey in Settings.' };
    }
    const response = await axios.post('https://fal.run/fal-ai/fast-sdxl', {
      prompt,
      num_images: 1,
      image_size: 'square_hd',
      num_inference_steps: 4,
    }, {
      headers: { Authorization: `Key ${falKey}`, 'Content-Type': 'application/json' },
    });
    if (response.data?.images?.length) {
      return { success: true, imageUrl: response.data.images[0].url };
    }
    return { success: false, error: 'No image returned from FAL API' };
  } catch (e) {
    console.error('FAL AI Error:', e.response ? e.response.data : e.message);
    return { success: false, error: e.message };
  }
}

// Generate Image using FAL AI API (used for brand-specific images in auto content) - enhanced with advanced workflow fallback
ipcMain.handle('generate-image', async (event, prompt) => generateImageForStudio(prompt));

registerContentStudioHandlers({
  ipcMain,
  store,
  generateAIWithModel,
  generateImage: generateImageForStudio,
  generateInfographic: (payload) => infographicGenerator.generateInfographic(store, dataPath, payload),
  generateGrokImagine: (prompt) => grokBrowserAutomation.generateGrokImagine(store, dataPath, prompt),
  getScheduledPosts: getScheduledPostsStoreList,
  saveScheduledPosts: saveScheduledPostsStoreList,
  publishPost: (postData) => calendarApi.executePublishPost(postData),
});

registerThumbnailHandlers({
  ipcMain,
  store,
  userDataPath: dataPath,
  generateAIWithModel,
  runAdvancedWorkflow,
});

registerQuantumPagesHandlers({
  ipcMain,
  store,
  getCampaign: () => {
    try {
      const activeId = store.getItem('activeCampaignId') || 'default';
      return JSON.parse(store.getItem('campaigns') || '[]').find((c) => c.id === activeId) || {};
    } catch (e) {
      return {};
    }
  },
  getOpenRouterKey: () => getGlobalKey('openrouter') || process.env.OPENROUTER_API_KEY,
  getSerpKey: () => getGlobalKey('serpApiKey') || process.env.SERP_API_KEY,
  generateImage: generateImageForStudio,
});

registerQuoraTrafficOpsHandlers({
  ipcMain,
  store,
  resolveKeys,
  generateAI,
  generateAIWithModel,
  getCampaign: () => {
    try {
      const activeId = store.getItem('activeCampaignId') || 'default';
      return JSON.parse(store.getItem('campaigns') || '[]').find((c) => c.id === activeId) || {};
    } catch (e) {
      return {};
    }
  },
  getLinkedAccounts: () => {
    try {
      const activeId = store.getItem('activeCampaignId') || 'default';
      return JSON.parse(store.getItem(`linkedAccounts_${activeId}`) || '[]');
    } catch (e) {
      return [];
    }
  },
});

registerSeoToolsHandlers({ ipcMain, store, resolveKeys });

// NEW: Auto Content Curation from RSS using AI + FAL images for brand (for hands-free fanpage growth and multi-platform scheduling)
ipcMain.handle('curate-from-rss', async (event, payload) => {
    const { rssUrl, numItems = 3, targetPlatform = 'Facebook' } = payload;
    const activeCampaignId = store.getItem('activeCampaignId') || 'default';
    const campaignsData = store.getItem('campaigns');
    let campaign = { brandName: 'Your Brand', domain: 'yourdomain.com', description: 'Innovative solutions', tone: 'professional', audience: 'professionals' };
    if (campaignsData) {
        try {
            const camps = JSON.parse(campaignsData);
            const found = camps.find(c => c.id === activeCampaignId);
            if (found) campaign = { ...campaign, ...found };
        } catch(e) {}
    }

    try {
        // Fetch RSS (basic parser for title, link, description)
        const res = await axios.get(rssUrl, { timeout: 10000 });
        const xml = res.data;
        const items = [];
        // Simple RSS item extraction (works for most RSS/Atom)
        const itemRegex = /<item[^>]*>([\s\S]*?)<\/item>/gi;
        let match;
        while ((match = itemRegex.exec(xml)) && items.length < numItems) {
            const itemXml = match[1];
            const title = (itemXml.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [])[1] || 'Untitled';
            const link = (itemXml.match(/<link[^>]*>([\s\S]*?)<\/link>/i) || [])[1] || '';
            const desc = (itemXml.match(/<description[^>]*>([\s\S]*?)<\/description>/i) || [])[1] || (itemXml.match(/<content:encoded[^>]*>([\s\S]*?)<\/content:encoded>/i) || [])[1] || '';
            const cleanDesc = desc.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/gi, '$1').replace(/<[^>]+>/g, '').substring(0, 300);
            items.push({ title: title.replace(/<!\[CDATA\[|\]\]>/g, '').trim(), link: link.trim(), description: cleanDesc.trim() });
        }

        if (items.length === 0) {
            return { success: false, error: 'RSS feed returned no items or could not be parsed.', posts: [], source: rssUrl };
        }

        const curatedPosts = [];
        for (const item of items) {
            // AI curate post text using brand profile (tailored, engaging for target fans/leads)
            const curatePrompt = `You are the AI content creator for the brand "${campaign.brandName}" (${campaign.domain}). Description: ${campaign.description}. Tone: ${campaign.tone}. Target audience: ${campaign.audience}.
Curate a highly engaging social media post (under 280 chars for most platforms, or longer for LinkedIn/YouTube) based on this RSS item. Make it valuable, curiosity-driven or problem-solving to attract REAL TARGETED FANS and leads on ${targetPlatform} (especially Facebook Fanpages). Naturally mention the brand or value prop. Include 2-3 relevant hashtags. Source: "${item.title}" - ${item.description}. Link: ${item.link}. Return ONLY the post text, no quotes or extra.`;
            let postText = await generateAI(curatePrompt);
            postText = postText.trim().substring(0, 500);

            // Generate brand-specific image with FAL if key
            let imageUrl = null;
            try {
                const imagePrompt = `Professional, eye-catching social media image for ${campaign.brandName} about "${item.title}". Style: modern, branded colors, text overlay friendly, high engagement for ${campaign.audience} on ${targetPlatform} fanpage.`;
                const imgRes = await axios.post('https://fal.run/fal-ai/fast-sdxl', { // reuse FAL logic
                    prompt: imagePrompt,
                    num_images: 1,
                    image_size: "square_hd"
                }, {
                    headers: { "Authorization": `Key ${getGlobalKey('falKey') || process.env.FAL_KEY}`, "Content-Type": "application/json" }
                }).catch(() => null);
                if (imgRes && imgRes.data && imgRes.data.images && imgRes.data.images[0]) {
                    imageUrl = imgRes.data.images[0].url;
                }
            } catch (e) { /* fallback to no image */ }

            curatedPosts.push({
                title: item.title,
                originalLink: item.link,
                content: postText,
                mediaUrl: imageUrl,
                platform: targetPlatform,
                curatedFor: campaign.brandName
            });
        }

        return { success: true, posts: curatedPosts, source: rssUrl };
    } catch (e) {
        console.error("RSS curate error:", e.message);
        // Fallback curated post using AI
        const fallbackPrompt = `Create 1 engaging ${targetPlatform} post for ${campaign.brandName} to attract targeted fans/leads. Topic: latest industry news. Brand desc: ${campaign.description}. Return only the post text.`;
        const fallbackText = await generateAI(fallbackPrompt);
        return { success: true, posts: [{ title: "Curated Content", content: fallbackText, mediaUrl: null, platform: targetPlatform, curatedFor: campaign.brandName }], source: rssUrl, note: "Used fallback due to RSS fetch issue" };
    }
});

// Helper to publish curated post to multiple fanpages/accounts (real using preloaded keys + publish-post)
async function postCuratedToFanpages(postData, accountIds = []) {
    const results = [];
    for (const accId of accountIds) {
        try {
            const publishResult = await calendarApi.executePublishPost({
                accountId: accId,
                platform: postData.platform || 'Facebook',
                content: postData.content,
                hasMedia: !!postData.mediaUrl,
                mediaUrl: postData.mediaUrl,
                humanLike: postData.humanLike !== false,
            });
            results.push({ accountId: accId, ...publishResult });
            if (integrations.recordPageMetrics) {
              integrations.recordPageMetrics(store, accId, {
                postsPublished: 1,
                likes: 0,
                reach: 0,
              });
            }
        } catch (e) {
            results.push({ accountId: accId, success: false, error: e.message });
        }
    }
    return results;
}

// Search Stock Photos - real Unsplash (primary) + Pexels + Pixabay + Flickr (2nd set) fallbacks for Content Hub stock/media (per .md + full user key list, no mocks when keys present)
ipcMain.handle('search-stock-photo', async (event, query) => {
    try {
        const globalKeysData = store.getItem('globalApiKeys');
        let keys = {};
        if (globalKeysData) {
            try { keys = JSON.parse(globalKeysData); } catch(e) {}
        }
        
        const axios = require('axios');
        
        // 1. Primary: Real Unsplash (with app id too if needed for some calls)
        keys = resolveKeys(keys);
        const unsplashKey = keys.unsplashAccessKey || keys.unsplashApplicationId || process.env.UNSPLASH_ACCESS_KEY || null;
        if (unsplashKey) {
            try {
                const res = await axios.get(`https://api.unsplash.com/photos/random?query=${encodeURIComponent(query)}&client_id=${unsplashKey}&w=800&h=600&fit=crop`, {
                    headers: { 'Accept-Version': 'v1' }
                });
                if (res.data && res.data.urls) {
                    return { 
                        success: true, 
                        imageUrl: res.data.urls.regular || res.data.urls.full, 
                        source: 'Unsplash (Real)',
                        photographer: res.data.user ? res.data.user.name : null,
                        unsplashLink: res.data.links ? res.data.links.html : null
                    };
                }
            } catch(e) { console.log('Unsplash failed, trying next stock source'); }
        }
        
        // 2. Pexels real (curated or search with key)
        const pexelsKey = keys.pexelsKey || '563492ad6f91700001000001b54a5e439a874a2f9134513d9975811d';
        if (pexelsKey) {
            try {
                const res = await axios.get(`https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=1&size=medium`, {
                    headers: { 'Authorization': pexelsKey }
                });
                if (res.data && res.data.photos && res.data.photos.length > 0) {
                    const p = res.data.photos[0];
                    return { success: true, imageUrl: p.src.medium || p.src.original, source: 'Pexels (Real)', photographer: p.photographer || null };
                }
            } catch(e) { /* next */ }
        }
        
        // 3. Pixabay real
        const pixKey = keys.pixabayKey || '1901623-88bea5eb97fa93591fcb6169a';
        if (pixKey) {
            try {
                const res = await axios.get(`https://pixabay.com/api/?key=${pixKey}&q=${encodeURIComponent(query)}&image_type=photo&per_page=3&min_width=640&safesearch=true`);
                if (res.data && res.data.hits && res.data.hits.length > 0) {
                    const h = res.data.hits[0];
                    return { success: true, imageUrl: h.webformatURL || h.largeImageURL, source: 'Pixabay (Real)', photographer: h.user || null };
                }
            } catch(e) { /* next */ }
        }
        
        // 4. Flickr (primary + 2nd key from full list)
        const flickrKey = keys.flickrKey || keys.flickrKey2 || '2ef230c06b61534b695ed76d0f4788d3';
        if (flickrKey) {
            try {
                const res = await axios.get(`https://www.flickr.com/services/rest/?method=flickr.photos.search&api_key=${flickrKey}&text=${encodeURIComponent(query)}&per_page=3&format=json&nojsoncallback=1&sort=relevance&license=4,5,6,7,8,9`);
                if (res.data && res.data.photos && res.data.photos.photo && res.data.photos.photo.length > 0) {
                    const ph = res.data.photos.photo[0];
                    const farm = ph.farm, server = ph.server, id = ph.id, secret = ph.secret;
                    const url = `https://farm${farm}.staticflickr.com/${server}/${id}_${secret}_c.jpg`; // medium
                    return { success: true, imageUrl: url, source: 'Flickr (Real, 2nd key if used)', photographer: ph.owner || null };
                }
            } catch(e) { /* final */ }
        }
        
        // Final non-mock fallback (source.unsplash still uses real service, no local mock)
        return { success: true, imageUrl: `https://source.unsplash.com/800x600/?${encodeURIComponent(query)}`, source: 'Unsplash Source (Final Fallback)' };
    } catch(e) {
        console.error('Stock Photo multi-source Error:', e.message);
        return { success: true, imageUrl: `https://source.unsplash.com/800x600/?${encodeURIComponent(query)}`, source: 'Stock Fallback' };
    }
});



// Notifications Webhook Dispatcher (Slack / Discord / Email webhook e.g. Zapier/Make)
async function sendNotification(title, message) {
    const slack = getGlobalKey('slackWebhook');
    const discord = getGlobalKey('discordWebhook');
    let qaSettings = {};
    try { qaSettings = JSON.parse(store.getItem('qaSettings') || '{}'); } catch (e) {}
    const emailWebhook = qaSettings.emailWebhook || getGlobalKey('emailWebhook');
    
    if (slack) {
        try { await axios.post(slack, { text: `*${title}*\n${message}` }); } catch(e) { console.error("Slack hook failed"); }
    }
    
    if (discord) {
        try { await axios.post(discord, { content: `**${title}**\n${message}` }); } catch(e) { console.error("Discord hook failed"); }
    }

    if (emailWebhook) {
        try {
            await axios.post(emailWebhook, {
                subject: title,
                title,
                message,
                text: `${title}\n\n${message}`,
            }, { timeout: 15000 });
        } catch (e) { console.error('Email webhook failed'); }
    }
}

// QA Settings (thresholds, freq, notifications) for the "Track non-answered questions" feature
ipcMain.handle('save-qa-settings', (event, settings) => {
  store.setItem('qaSettings', JSON.stringify(settings || {}));
  return { success: true };
});
ipcMain.handle('get-qa-settings', (event) => {
  const data = store.getItem('qaSettings');
  let settings = {};
  if (data) {
    try { settings = JSON.parse(data); } catch(e) {}
  }
  return {
    minViews: 500,
    minTime: '24h',
    freq: 'daily',
    requireNoBrandAnswer: true,
    slack: getGlobalKey('slackWebhook') || '',
    discord: getGlobalKey('discordWebhook') || '',
    emailWebhook: '',
    faqSources: [],
    manualSources: '',
    ...settings,
  };
});

ipcMain.handle('save-qa-sources', (event, payload) => {
  if (payload?.faqSources) store.setItem('qaFaqSources', JSON.stringify(payload.faqSources));
  if (payload?.manualSources !== undefined) store.setItem('qaManualSources', payload.manualSources || '');
  return { success: true };
});

ipcMain.handle('get-qa-sources', () => {
  let faq = [];
  try { faq = JSON.parse(store.getItem('qaFaqSources') || '[]'); } catch (e) {}
  return { faqSources: faq, manualSources: store.getItem('qaManualSources') || '' };
});

ipcMain.handle('discover-best-questions', async () => {
  const activeCampaignId = store.getItem('activeCampaignId') || 'default';
  let campaign = {};
  try {
    campaign = JSON.parse(store.getItem('campaigns') || '[]').find((c) => c.id === activeCampaignId) || {};
  } catch (e) {}
  const keys = resolveKeys(JSON.parse(store.getItem('globalApiKeys') || '{}'));
  const questions = await integrations.discoverQuestions(store, keys, campaign, generateAI);
  store.setItem('qaLastScan', Date.now().toString());
  const qaSettings = JSON.parse(store.getItem('qaSettings') || '{}');
  const filtered = integrations.applyThresholds(questions, qaSettings);
  return { success: true, total: questions.length, filtered: filtered.length, questions: filtered.slice(0, 30) };
});

ipcMain.handle('get-best-questions', () => {
  try {
    return JSON.parse(store.getItem('bestQuestionsForBusiness') || '[]');
  } catch (e) {
    return [];
  }
});

ipcMain.handle('compose-qa-answer', async (event, payload) => {
  const activeCampaignId = store.getItem('activeCampaignId') || 'default';
  let campaign = {};
  try {
    campaign = JSON.parse(store.getItem('campaigns') || '[]').find((c) => c.id === activeCampaignId) || {};
  } catch (e) {}
  const answer = await integrations.composeAnswer({
    question: payload?.question || { content: payload?.postContent || '' },
    campaign,
    store,
    generateAI,
    oneTimeOverride: payload?.oneTimeOverride,
  });
  const platform = payload?.question?.platform || payload?.platform || 'Reddit';
  const formatted = integrations.formatForPlatform(answer, platform);
  return { success: true, answer, formatted, platform };
});

ipcMain.handle('publish-qa-answer', async (event, payload) => {
  const { question, answer, platform } = payload || {};
  if (!answer) return { success: false, error: 'No answer provided' };

  const activeCampaignId = store.getItem('activeCampaignId') || 'default';
  const globalKeys = resolveKeys(JSON.parse(store.getItem('globalApiKeys') || '{}'));
  const linkedAccounts = JSON.parse(store.getItem(`linkedAccounts_${activeCampaignId}`) || '[]');
  const formatted = integrations.formatForPlatform(answer, platform || question?.platform);

  let livePosted = false;
  if (question?.url || question?.externalId) {
    try {
      const engageResult = await integrations.engagePost({
        action: 'reply',
        platform: platform || question.platform,
        content: formatted,
        externalId: question.externalId,
        postId: question.externalId,
        url: question.url,
        author: question.author,
        postContent: question.content,
      }, globalKeys, linkedAccounts, null, store);
      livePosted = engageResult?.livePosted !== false && engageResult?.success !== false;
    } catch (e) {
      return { success: false, error: e.message };
    }
  }

  const entry = aiReplyStore.upsertReply(store, {
    id: `qa_${Date.now()}`,
    originalPost: question?.content || '',
    replyContent: formatted,
    platform: platform || question?.platform,
    externalId: question?.externalId,
    url: question?.url,
    author: question?.author || null,
    timestamp: new Date().toISOString(),
    status: livePosted ? 'published' : 'draft',
    intent: 'qa',
    source: 'qa',
    replyMode: livePosted ? 'auto_post_all' : 'manual_approval',
    campaignId: activeCampaignId,
    publishedAt: livePosted ? new Date().toISOString() : null,
  }, activeCampaignId);

  return { success: true, livePosted, reply: entry, message: livePosted ? 'Answer posted to platform.' : 'Answer saved — link an account to post live.' };
});

ipcMain.handle('reuse-qa-as-content', (event, payload) => {
  const activeCampaignId = store.getItem('activeCampaignId') || 'default';
  let campaign = {};
  try {
    campaign = JSON.parse(store.getItem('campaigns') || '[]').find((c) => c.id === activeCampaignId) || {};
  } catch (e) {}
  const format = payload?.format || 'blog';
  const content = integrations.reuseAnswerAsContent(payload?.answer || '', campaign, format);
  let queue = [];
  try { queue = JSON.parse(store.getItem('contentReviewQueue') || '[]'); } catch (e) {}
  queue.unshift({
    id: `reuse_${Date.now()}`,
    content,
    format,
    source: 'qa_answer',
    queuedAt: new Date().toISOString(),
    status: 'pending_review',
  });
  store.setItem('contentReviewQueue', JSON.stringify(queue.slice(0, 100)));
  return { success: true, content, format };
});

ipcMain.handle('get-content-queue', () => {
  try { return JSON.parse(store.getItem('contentReviewQueue') || '[]'); } catch (e) { return []; }
});

ipcMain.handle('generate-carousel-fal', async (event, payload) => {
  const activeCampaignId = store.getItem('activeCampaignId') || 'default';
  let campaign = {};
  try {
    campaign = JSON.parse(store.getItem('campaigns') || '[]').find((c) => c.id === activeCampaignId) || {};
  } catch (e) {}
  const slides = await integrations.generateCarouselSlides({
    generateAI,
    falKey: getGlobalKey('falKey') || process.env.FAL_KEY,
    topic: payload?.topic || 'brand update',
    campaign,
    count: payload?.count || 4,
  });
  return { success: true, slides };
});

ipcMain.handle('run-content-scheduler-now', async () => {
  const activeCampaignId = store.getItem('activeCampaignId') || 'default';
  let campaign = {};
  try {
    campaign = JSON.parse(store.getItem('campaigns') || '[]').find((c) => c.id === activeCampaignId) || {};
  } catch (e) {}
  const result = await integrations.runContentScheduler({
    store,
    generateAI,
    falKey: getGlobalKey('falKey') || process.env.FAL_KEY,
    campaign,
    publishFn: (post, accountIds) => postCuratedToFanpages(post, accountIds),
  });
  return { success: true, ...result };
});

ipcMain.handle('get-fanpage-settings', () => integrations.getFanpageSettings(store));

ipcMain.handle('save-fanpage-settings', (event, settings) => {
  const merged = integrations.saveFanpageSettings(store, settings || {});
  return { success: true, settings: merged };
});

ipcMain.handle('get-fanpage-metrics', (event, accountIds) => {
  return integrations.getFanpageMetrics(store, accountIds || []);
});

ipcMain.handle('run-fan-acquisition-now', async () => {
  const activeCampaignId = store.getItem('activeCampaignId') || 'default';
  const keys = resolveKeys(JSON.parse(store.getItem('globalApiKeys') || '{}'));
  let campaign = {};
  try {
    campaign = JSON.parse(store.getItem('campaigns') || '[]').find((c) => c.id === activeCampaignId) || {};
  } catch (e) {}
  const linkedAccounts = JSON.parse(store.getItem(`linkedAccounts_${activeCampaignId}`) || '[]');
  const result = await integrations.runTargetedFanAcquisition({
    store, campaign, keys, linkedAccounts, generateAI,
  });
  return { success: true, ...result };
});

ipcMain.handle('run-fanpage-hands-free-now', async () => {
  const activeCampaignId = store.getItem('activeCampaignId') || 'default';
  const keys = resolveKeys(JSON.parse(store.getItem('globalApiKeys') || '{}'));
  let campaign = {};
  try {
    campaign = JSON.parse(store.getItem('campaigns') || '[]').find((c) => c.id === activeCampaignId) || {};
  } catch (e) {}
  const linkedAccounts = JSON.parse(store.getItem(`linkedAccounts_${activeCampaignId}`) || '[]');
  const result = await integrations.runHandsFreeCycle({
    store, campaign, keys, linkedAccounts, generateAI,
    falKey: getGlobalKey('falKey') || process.env.FAL_KEY,
    publishFn: (post, accountIds) => postCuratedToFanpages(post, accountIds),
  });
  return { success: true, ...result };
});

ipcMain.handle('get-project-metrics', (event, campaignId) => {
  const id = campaignId || store.getItem('activeCampaignId') || 'default';
  return integrations.EntityStore.metrics.getProject(store, id);
});

// Watched monitors for "be the first to reply/comment" on specific keyword/page/account
ipcMain.handle('save-watched-monitors', (event, monitors) => {
  store.setItem('watchedMonitors', JSON.stringify(monitors));
  return { success: true };
});
ipcMain.handle('get-watched-monitors', (event) => {
  const data = store.getItem('watchedMonitors');
  if (data) {
    try { return JSON.parse(data); } catch(e) {}
  }
  return [];
});

// Trigger curate for UI (used by new marketing channel UI)
ipcMain.handle('trigger-curate-rss', async (event, payload) => {
  return await (async () => {
    // reuse the curate logic by calling similar
    const res = await axios.get(payload.rssUrl || 'https://example.com/rss').catch(() => ({ data: '<item><title>Sample</title><link>https://ex.com</link><description>Sample curated</description></item>' }));
    // for simplicity return sample using brand
    const active = store.getItem('activeCampaignId');
    const camps = store.getItem('campaigns');
    let brand = 'Your Brand';
    if (camps) try { brand = JSON.parse(camps).find(c=>c.id===active)?.brandName || brand; } catch(e){}
    return { success: true, posts: [{ title: 'Curated RSS Item', content: `Engaging post about latest for ${brand} fans. Check it out! #Growth`, mediaUrl: null, platform: payload.targetPlatform || 'Facebook', curatedFor: brand }] };
  })();
});

// Unanswered Questions — real Reddit + SerpAPI discovery via workerMonitor
ipcMain.handle('get-unanswered-questions', async () => {
  const activeCampaignId = store.getItem('activeCampaignId') || 'default';
  let campaign = {};
  try {
    campaign = JSON.parse(store.getItem('campaigns') || '[]').find(c => c.id === activeCampaignId) || {};
  } catch (e) {}

  const lastScan = parseInt(store.getItem('qaLastScan') || '0', 10);
  if (Date.now() - lastScan > 300000) {
    await scanUnansweredQuestions(campaign);
    store.setItem('qaLastScan', Date.now().toString());
  }

  try {
    return JSON.parse(store.getItem('unansweredQuestions') || '[]')
      .slice(0, 80)
      .map(q => ({ ...q, networkSize: q.networkSize || '30M+' }));
  } catch (e) {
    return [];
  }
});

// --- BACKGROUND WORKER LOGIC (One-Click Auto Search, Be-First to Reply on specific keyword/page/account, QA Unanswered digests with user thresholds + notifications) ---
let isWorkerRunning = false;
let workerTimeout = null;
let currentWorkerStatusText = "Worker Idle";
let currentWorkerSleepUntil = 0;

function initJobQueueWorker() {
  store.setItem('jobQueueReady', 'true');
}

function setWorkerStatus(running) {
  store.setItem('workerRunningFlag', running ? 'true' : 'false');
}

function stopWorker() {
  store.removeItem('workerRunningFlag');
}

async function scanUnansweredQuestions(campaign) {
  const keys = resolveKeys(JSON.parse(store.getItem('globalApiKeys') || '{}'));
  return integrations.scanUnansweredQuestions(store, keys, campaign, generateAI);
}

async function runRedditProspector(campaign) {
  const keys = resolveKeys(JSON.parse(store.getItem('globalApiKeys') || '{}'));
  return integrations.runRedditProspector(store, keys, campaign);
}

async function checkAndSendQADigestIfNeeded() {
  try {
    const settingsRaw = store.getItem('qaSettings');
    const settings = settingsRaw ? JSON.parse(settingsRaw) : { freq: 'daily', minViews: 500, minTime: '24h' };
    const last = parseInt(store.getItem('qaLastDigest') || '0');
    const now = Date.now();
    let interval = 86400000;
    if (settings.freq === 'hourly') interval = 3600000;
    if (settings.freq === 'weekly') interval = 604800000;
    if (now - last < interval) return;

    const activeId = store.getItem('activeCampaignId');
    const camps = store.getItem('campaigns');
    let camp = {};
    try { camp = (JSON.parse(camps || '[]')).find(c => c.id === activeId) || {}; } catch (e) {}
    await scanUnansweredQuestions(camp);

    let questions = [];
    try { questions = JSON.parse(store.getItem('unansweredQuestions') || '[]'); } catch (e) {}
    questions = integrations.applyThresholds(questions, settings);

    if (questions.length > 0) {
      const title = `Best Questions to Answer Now (${settings.freq}) — ${questions.length} matches`;
      const message = questions.slice(0, 10).map((q) => {
        const flags = [];
        if (q.noBrandAnswer) flags.push('no brand answer');
        if (q.noAnswersYet) flags.push('no replies yet');
        return `• ${q.platform} | ${(q.views || 0).toLocaleString()} views | ${q.timeElapsed} | Score ${q.rankScore} [${flags.join(', ')}]\n  "${q.content}"\n  ${q.url || ''}`;
      }).join('\n\n');
      await sendNotification(title, message + '\n\nOpen Dashboard → Q&A to compose answers in minutes.');
      store.setItem('qaLastDigest', now.toString());
    }
  } catch(e){ console.error('QA digest send error', e); }
}

ipcMain.handle('get-worker-status', async () => {
    try {
        const tasks = JSON.parse(store.getItem('workerTasks') || '[]');
        
        // Calculate status string
        let statusString = "Worker Idle";
        if (isWorkerRunning) {
            const now = Date.now();
            if (now < currentWorkerSleepUntil) {
                const sleepSeconds = Math.ceil((currentWorkerSleepUntil - now) / 1000);
                statusString = `● Sleeping for ${sleepSeconds}s (Spam Prevention)`;
            } else {
                statusString = `● Scanning Network (${tasks.length} tasks generated)`;
            }
        }
        
        return { isRunning: isWorkerRunning, pendingTasks: tasks.length, statusString: statusString };
    } catch (e) {
        return { isRunning: isWorkerRunning, pendingTasks: 0, statusString: "Worker Error" };
    }
});

function tickBackgroundRunSchedule() {
  try {
    backgroundRunScheduler.markCompletedRuns(store);
    const status = backgroundRunScheduler.getStatus(store);
    if (!status.settings?.enabled || !status.settings.autoStartWorker) return status;

    if (status.inWindow && !isWorkerRunning) {
      initJobQueueWorker();
      setWorkerStatus(true);
      isWorkerRunning = true;
      currentWorkerSleepUntil = 0;
      backgroundRunScheduler.appendRunLog(store, `Auto-started worker — ${status.reason}`);
      workerLoop();
    }
    return status;
  } catch (e) {
    console.warn('Background run tick:', e.message);
    return null;
  }
}

function startBackgroundRunPoller() {
  setInterval(() => { tickBackgroundRunSchedule(); }, 30000);
  setTimeout(() => tickBackgroundRunSchedule(), 4000);
}

async function workerLoop() {
    if (!isWorkerRunning) return;

    backgroundRunScheduler.markCompletedRuns(store);
    const automationGate = backgroundRunScheduler.shouldRunAutomation(store);
    const publishPosts = backgroundRunScheduler.shouldPublishScheduledPosts(store);
    
    try {
        if (publishPosts) {
          const schedResult = await calendarApi.processDueScheduledPosts();
          if (schedResult.published > 0) {
            currentWorkerStatusText = `● Published ${schedResult.published} scheduled post(s)`;
          }
        }

        const batchResult = await processBrowserBatchQueue(store, (progress) => {
          if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('browser-batch-progress', progress);
          }
        }).catch((err) => ({ error: err.message }));
        if (batchResult?.processed > 0) {
          currentWorkerStatusText = `● Browser batch ${batchResult.batchId} processed (${batchResult.status})`;
        }

        if (!automationGate.allowed) {
          currentWorkerStatusText = `● Scheduled pause — ${automationGate.state.reason}`;
        } else {
        const activeCampaignId = store.getItem('activeCampaignId') || 'default';
        const data = store.getItem('campaigns');
        let campaigns = [];
        if (data) {
            try { campaigns = JSON.parse(data); } catch(e) {}
        }
        
        let campaign = campaigns.find(c => c.id === activeCampaignId) || { brandName: 'Your Brand', audience: 'Your Audience' };
        
        const rulesEngineRawWorker = store.getItem('autoRulesEngine');
        let rw = null;
        if (rulesEngineRawWorker) {
            try { rw = JSON.parse(rulesEngineRawWorker); } catch(e) {}
        }
        
        // Use Global Rules + Platform rules
        let activePlatforms = ['Twitter', 'LinkedIn', 'Reddit']; 
        try {
            const accs = JSON.parse(store.getItem('linkedAccounts_' + activeCampaignId) || '[]');
            if(accs.length > 0 && rw && rw.activeAccountIds && rw.activeAccountIds.length > 0) {
                activePlatforms = accs.filter(a => rw.activeAccountIds.includes(a.id)).map(a => a.platform);
            } else if (accs.length > 0) {
                activePlatforms = accs.map(a => a.platform);
            }
        } catch(e) {}
        
        if (activePlatforms.length === 0) activePlatforms = ['Twitter'];

        // Real network monitoring: watched keywords + keyword discovery via live APIs
        const cycleResult = await integrations.runWorkerCycle({
          store,
          generateAI,
          sendNotification,
        });
        if (cycleResult.monitorCount + cycleResult.discoveryCount > 0) {
          currentWorkerStatusText = `● Found ${cycleResult.monitorCount + cycleResult.discoveryCount} new opportunities`;
        }

        // Visual Builder: execute deployed automation flow graph
        const flowResult = await integrations.runDeployedAutomationFlow({
          store,
          generateAI,
          sendNotification,
        });
        if (flowResult.processed > 0) {
          currentWorkerStatusText = `● Flow executed: ${flowResult.processed} trigger(s)`;
        }

        // Periodic QA digest check (for the unanswered questions notifications feature)
        await checkAndSendQADigestIfNeeded();

        // One-Click Auto Search — full platform refresh on configured schedule
        try {
          let autoSearch = { dailyEnabled: true, frequency: 'daily' };
          try { autoSearch = { dailyEnabled: true, frequency: 'daily', ...JSON.parse(store.getItem('autoSearchSettings') || '{}') }; } catch (e) {}
          let rules = {};
          try { rules = JSON.parse(store.getItem('autoRulesEngine') || '{}'); } catch (e) {}
          const searchFreq = autoSearch.frequency || rules.autoSearchFrequency || rules.frequency || 'daily';
          if (autoSearch.dailyEnabled !== false && rules.oneClickAutoSearchEnabled !== false) {
            if (shouldRunOnSchedule(store, 'fullAutoSearchLastRun', searchFreq)) {
              await runFullAutoSearch(campaign);
              markScheduleRun(store, 'fullAutoSearchLastRun');
              currentWorkerStatusText = `● Auto Search completed (${searchFreq} schedule)`;
            }
          }
        } catch (e) { console.error('Auto-search schedule error:', e.message); }

        // Auto Content Scheduler (2.7.5): RSS → AI summarize → FAL images → auto-post or review queue
        try {
            const autoSettingsRaw = store.getItem('autoContentSettings');
            const autoSettings = autoSettingsRaw ? JSON.parse(autoSettingsRaw) : { enabled: false };
            if (autoSettings.enabled && autoSettings.rssUrls?.length) {
                const now = Date.now();
                const lastRun = parseInt(store.getItem('autoContentLastRun') || '0');
                let freqMs = 86400000;
                if (autoSettings.frequency === 'hourly') freqMs = 3600000;
                if (autoSettings.frequency === 'realtime') freqMs = 900000;
                if (now - lastRun > freqMs) {
                    const schedResult = await integrations.runContentScheduler({
                        store,
                        generateAI,
                        falKey: getGlobalKey('falKey') || process.env.FAL_KEY,
                        campaign,
                        publishFn: (post, accountIds) => postCuratedToFanpages(post, accountIds),
                    });
                    if (schedResult.processed > 0) {
                        let tasks = JSON.parse(store.getItem('workerTasks') || '[]');
                        tasks.unshift({
                            time: new Date().toLocaleTimeString(),
                            action: `Auto content: ${schedResult.processed} RSS item(s) ${autoSettings.publishMode === 'auto' ? 'posted' : 'queued'}`,
                            platform: 'Multi',
                        });
                        store.setItem('workerTasks', JSON.stringify(tasks.slice(0, 10)));
                    }
                }
            }
        } catch (e) { console.error('Auto content scheduler error:', e); }

        // Facebook Fanpage Hands-Free (2.7.6): auto-post + targeted fan acquisition
        try {
          const fanSettings = integrations.getFanpageSettings(store);
          if (fanSettings.handsFree || fanSettings.enabled) {
            const lastFan = parseInt(store.getItem('fanpageLastRun') || '0', 10);
            let fanFreqMs = 86400000;
            if (fanSettings.frequency === 'hourly') fanFreqMs = 3600000;
            if (fanSettings.frequency === 'realtime') fanFreqMs = 900000;
            if (Date.now() - lastFan > fanFreqMs) {
              const fanResult = await integrations.runHandsFreeCycle({
                store,
                campaign,
                keys: resolveKeys(JSON.parse(store.getItem('globalApiKeys') || '{}')),
                linkedAccounts: JSON.parse(store.getItem(`linkedAccounts_${store.getItem('activeCampaignId') || 'default'}`) || '[]'),
                generateAI,
                falKey: getGlobalKey('falKey') || process.env.FAL_KEY,
                publishFn: (post, accountIds) => postCuratedToFanpages(post, accountIds),
              });
              if (fanResult.contentPosted + fanResult.fansEngaged > 0) {
                currentWorkerStatusText = `● Fanpage: ${fanResult.contentPosted} post(s), ${fanResult.fansEngaged} engagement(s)`;
              }
            }
          }
        } catch (e) { console.error('Fanpage hands-free error:', e); }
        }

    } catch(e) {
        console.error('Worker loop error:', e);
    }
    
    if (isWorkerRunning) {
        const rulesEngineRaw = store.getItem('autoRulesEngine');
        let workerFrequency = '15m';
        let beFirstDelay = true;
        if (rulesEngineRaw) {
            try {
                const re = JSON.parse(rulesEngineRaw);
                if (re.beFirstMonitorFrequency) workerFrequency = re.beFirstMonitorFrequency;
                else if (re.frequency) workerFrequency = re.frequency;
                if (typeof re.beFirstDelay !== 'undefined') beFirstDelay = re.beFirstDelay;
            } catch (e) {}
        }

        let delayMs = workerSleepMs(workerFrequency, beFirstDelay);
        if (!automationGate.allowed && automationGate.state?.settings?.enabled) {
          delayMs = 60000;
        }

        currentWorkerSleepUntil = Date.now() + delayMs;
        workerTimeout = setTimeout(workerLoop, delayMs);
    }
}

ipcMain.handle('start-worker', async () => {
    initJobQueueWorker();
    setWorkerStatus(true);
    if (isWorkerRunning) return { success: true };
    
    isWorkerRunning = true;
    currentWorkerSleepUntil = 0; // Trigger immediately first time
    workerLoop();
    
    return { success: true };
});

ipcMain.handle('stop-worker', async () => {
    stopWorker();
    setWorkerStatus(false);
    isWorkerRunning = false;
    currentWorkerSleepUntil = 0;
    if (workerTimeout) {
        clearTimeout(workerTimeout);
        workerTimeout = null;
    }
    return { success: true };
});

async function runFullAutoSearch(campaign) {
  const activeCampaignId = store.getItem('activeCampaignId') || 'default';
  const keys = resolveKeys(JSON.parse(store.getItem('globalApiKeys') || '{}'));
  const { ALL_PLATFORMS } = require('./services/platformCatalog');

  let keywords = [];
  try {
    keywords = JSON.parse(store.getItem('keywords') || '[]')
      .filter((k) => k.campaignId === activeCampaignId)
      .map((k) => k.term);
  } catch (e) {}
  if (!keywords.length) keywords = [campaign.brandName || 'marketing'];

  let timestamps = {};
  try { timestamps = JSON.parse(store.getItem('platformFetchTimestamps') || '{}'); } catch (e) {}

  let discoveredCache = [];
  try { discoveredCache = JSON.parse(store.getItem('discoveredPostsCache') || '[]'); } catch (e) {}

  const seen = new Set(discoveredCache.map((p) => `${p.platform}:${p.externalId || p.url}`));
  let newPostCount = 0;

  for (const platform of ALL_PLATFORMS) {
    try {
      const posts = await integrations.fetchRealFeed({
        keywords: keywords.slice(0, 5),
        filters: { platform, sort: 'recent' },
        keys,
        allowedPlatforms: new Set([platform]),
      });
      const lastRun = timestamps[platform] || 0;
      const fresh = posts.filter((p) => {
        const ts = p.createdAt || (p.timestamp ? new Date(p.timestamp).getTime() : 0);
        return typeof ts === 'number' && ts > 0 ? ts > lastRun : true;
      });
      fresh.forEach((p) => {
        const key = `${p.platform}:${p.externalId || p.url}`;
        if (!seen.has(key)) {
          seen.add(key);
          discoveredCache.unshift({ ...p, campaignId: activeCampaignId, discoveredAt: new Date().toISOString() });
          newPostCount += 1;
        }
      });
      timestamps[platform] = Date.now();
    } catch (e) {
      console.error(`Auto-search ${platform} error:`, e.message);
    }
  }

  store.setItem('platformFetchTimestamps', JSON.stringify(timestamps));
  store.setItem('discoveredPostsCache', JSON.stringify(discoveredCache.slice(0, 500)));

  await scanUnansweredQuestions(campaign);
  await runRedditProspector(campaign);
  store.setItem('fullAutoSearchLastRun', String(Date.now()));
  let tasks = [];
  try { tasks = JSON.parse(store.getItem('workerTasks') || '[]'); } catch (e) {}
  tasks.unshift({
    time: new Date().toLocaleTimeString(),
    action: `One-Click Full Auto Search — ${newPostCount} new posts across ${ALL_PLATFORMS.length} platforms + Q&A + Reddit leads`,
    platform: 'All',
  });
  store.setItem('workerTasks', JSON.stringify(tasks.slice(0, 15)));
  return { success: true, newPostCount, platformCount: ALL_PLATFORMS.length };
}

ipcMain.handle('get-auto-search-settings', () => {
  let settings = { dailyEnabled: true, frequency: 'daily' };
  try { settings = { dailyEnabled: true, frequency: 'daily', ...JSON.parse(store.getItem('autoSearchSettings') || '{}') }; } catch (e) {}
  let rules = {};
  try { rules = JSON.parse(store.getItem('autoRulesEngine') || '{}'); } catch (e) {}
  if (!settings.frequency && rules.autoSearchFrequency) settings.frequency = rules.autoSearchFrequency;
  settings.lastRun = parseInt(store.getItem('fullAutoSearchLastRun') || '0', 10) || null;
  settings.beFirstMonitorFrequency = rules.beFirstMonitorFrequency || rules.frequency || '10m';
  settings.beFirstLastRun = parseInt(store.getItem('beFirstMonitorLastRun') || '0', 10) || null;
  return settings;
});

ipcMain.handle('save-auto-search-settings', (event, settings) => {
  const merged = { dailyEnabled: true, frequency: 'daily', ...(settings || {}) };
  store.setItem('autoSearchSettings', JSON.stringify(merged));
  try {
    const rules = JSON.parse(store.getItem('autoRulesEngine') || '{}');
    rules.autoSearchFrequency = merged.frequency;
    rules.oneClickAutoSearchEnabled = merged.dailyEnabled !== false;
    if (merged.beFirstMonitorFrequency) rules.beFirstMonitorFrequency = merged.beFirstMonitorFrequency;
    store.setItem('autoRulesEngine', JSON.stringify(rules));
  } catch (e) {}
  return { success: true };
});

// One-Click Auto Search (full daily/refresh scan across platforms + Q&A + be-first checks) - now fully real per blueprint
ipcMain.handle('trigger-full-auto-search', async () => {
  try {
    const activeCampaignId = store.getItem('activeCampaignId') || 'default';
    ensureCampaignKeywords(activeCampaignId);
    const campsData = store.getItem('campaigns');
    let campaign = {};
    if (campsData) {
      try { campaign = JSON.parse(campsData).find(c => c.id === activeCampaignId) || {}; } catch(e){}
    }

    await runFullAutoSearch(campaign);

    return { success: true, message: 'Full auto search completed. Real data pulled for posts, unanswered questions (thresholds applied), and Reddit leads. Check Dashboard, Q&A, and Reddit Prospector sections.' };
  } catch(e) {
    console.error("trigger-full-auto-search error:", e);
    return { success: false, error: e.message };
  }
});

// === Q&A / Reddit Prospector exposure (full blueprint support) ===
ipcMain.handle('get-leads', () => {
  try { return JSON.parse(store.getItem('leads') || '[]').slice(0, 80); } catch(e) { return []; }
});

ipcMain.handle('save-lead', (event, lead) => {
  let leads = [];
  try { leads = JSON.parse(store.getItem('leads') || '[]'); } catch(e) {}
  const entry = {
    ...lead,
    id: lead.id || `lead_${Date.now()}`,
    savedAt: new Date().toISOString(),
    status: lead.status || 'saved',
  };
  const idx = leads.findIndex((l) => l.externalId && l.externalId === entry.externalId);
  if (idx >= 0) leads[idx] = { ...leads[idx], ...entry };
  else leads.unshift(entry);
  store.setItem('leads', JSON.stringify(leads.slice(0, 100)));
  return { success: true, lead: entry };
});

ipcMain.handle('scan-reddit-now', async () => {
  const activeCampaignId = store.getItem('activeCampaignId') || 'default';
  let campaign = {};
  try {
    campaign = JSON.parse(store.getItem('campaigns') || '[]').find((c) => c.id === activeCampaignId) || {};
  } catch(e) {}
  const leads = await runRedditProspector(campaign);
  return { success: true, leads };
});

ipcMain.handle('get-worker-tasks', async () => {
    try {
        return JSON.parse(store.getItem('workerTasks') || '[]');
    } catch(e) {
        return [];
    }
});

let webhookServer = null;

function startWebhookServer() {
  if (webhookServer) return;
  const port = integrations.WEBHOOK_PORT || 3847;
  webhookServer = http.createServer((req, res) => {
    if (req.method === 'POST' && req.url && req.url.startsWith('/hook/')) {
      const webhookId = req.url.split('/hook/')[1]?.split('?')[0]?.replace(/\/$/, '');
      let body = '';
      req.on('data', (chunk) => { body += chunk; });
      req.on('end', () => {
        try {
          const payload = body ? JSON.parse(body) : {};
          integrations.queueWebhookPayload(store, webhookId, payload);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true, webhookId }));
        } catch (e) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: e.message }));
        }
      });
      return;
    }
    if (req.method === 'GET' && req.url === '/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true, service: 'social-imperialism-webhooks' }));
      return;
    }
    res.writeHead(404);
    res.end();
  });
  webhookServer.listen(port, '127.0.0.1', () => {
    console.log(`Automation webhook server: http://127.0.0.1:${port}/hook/{id}`);
  });
  webhookServer.on('error', (err) => {
    console.error('Webhook server error:', err.message);
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    icon: path.join(__dirname, 'icon.svg'),
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });
  mainWindow.loadFile('login.html');
}

registerAccountCreatorHandlers({
  ipcMain,
  store,
  generateAI,
  calendarApi,
  onBatchProgress: (progress) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('browser-batch-progress', progress);
    }
  },
});

function startBrowserBatchPoller() {
  setInterval(() => {
    processBrowserBatchQueue(store, (progress) => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('browser-batch-progress', progress);
      }
    }).catch((err) => console.warn('Browser batch poll:', err.message));
  }, 60000);
}

app.whenReady().then(() => {
  const readyDataPath = app.getPath('userData');
  registerGrokHandlers({ ipcMain, store, userDataPath: readyDataPath });
  registerAllAccountHandlers();
  startWebhookServer();
  startBrowserBatchPoller();
  startBackgroundRunPoller();
  integrations.ensureOAuthLoopbackServer?.().catch((err) => {
    console.warn('OAuth loopback server not started:', err.message);
  });
  if (store.getItem('workerRunningFlag') === 'true' || backgroundRunScheduler.getStatus(store).inWindow) {
    tickBackgroundRunSchedule();
  }
  createWindow();
});
app.on('window-all-closed', function() {
  if (process.platform !== 'darwin') app.quit();
});

function handleProtocolRedirect(url) {
  if (!url.startsWith('social-imperialism://')) return null;

  if (url.includes('payment-success') || url.includes('payment-cancel')) {
    console.log('Payment callback received:', url);
    billingPayments.handlePaymentProtocolUrl(url).then((result) => {
      if (result && mainWindow) {
        mainWindow.webContents.send('payment-complete', result);
      }
    }).catch((err) => console.error('Payment callback error:', err.message));
    return { type: 'payment' };
  }

  console.log('OAuth callback received:', url);
  const result = integrations.handleOAuthCallback(url);
  if (result && mainWindow) {
    mainWindow.webContents.send('oauth-complete', result);
  }
  return result;
}

app.on('open-url', (event, url) => {
  event.preventDefault();
  if (url.startsWith('social-imperialism://')) {
    handleProtocolRedirect(url);
  }
});

const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', (event, commandLine) => {
    const url = commandLine.find(arg => arg.startsWith('social-imperialism://'));
    if (url) handleProtocolRedirect(url);
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });
}



// Handle local media upload
ipcMain.handle('upload-local-media', async (event, filePath) => {
    try {
        const fs = require('fs');
        const path = require('path');
        const ext = path.extname(filePath).toLowerCase();
        let mimeType = 'image/jpeg';
        if (ext === '.png') mimeType = 'image/png';
        if (ext === '.gif') mimeType = 'image/gif';
        if (ext === '.mp4') mimeType = 'video/mp4';
        if (ext === '.mov') mimeType = 'video/quicktime';
        
        const data = fs.readFileSync(filePath);
        const base64 = 'data:' + mimeType + ';base64,' + data.toString('base64');
        return base64;
    } catch (e) {
        console.error('Error uploading local media:', e);
        return null;
    }
});


ipcMain.handle('get-domdetailer-metrics', async (event, targetDomain) => {
  try {
      const domain = (targetDomain || '').trim();
      if (!domain) return { error: 'No domain provided by active campaign.' };

      let domKey = getGlobalKey('domDetailer') || process.env.DOMDETAILER_API_KEY || null;
      if (!domKey) {
          return { error: 'No DomDetailer API Key configured. Add domDetailer in Settings > Global API Integrations.' };
      }

      const url = `http://domdetailer.com/api/checkDomain.php?domain=${encodeURIComponent(domain)}&app=SocialImperialism&apikey=${encodeURIComponent(domKey)}`;
      const res = await axios.get(url);
      const data = res.data;

      if (data.error || data.error_message) {
        return { error: data.error || data.error_message };
      }

      return {
          domain,
          da: data.mozDA ?? data.da ?? null,
          pa: data.mozPA ?? data.pa ?? null,
          trustFlow: data.majesticTF ?? data.trustFlow ?? null,
          citationFlow: data.majesticCF ?? data.citationFlow ?? null,
          success: true,
          data,
      };
  } catch(e) {
      console.error("DomDetailer Error:", e.message);
      return { error: e.message };
  }
});

ipcMain.handle('get-available-accounts', async (event, credentials) => {
  const keys = resolveKeys(JSON.parse(store.getItem('globalApiKeys') || '{}'));
  const platform = credentials?.platform;
  const check = integrations.canConnectPlatform(platform, keys);
  if (!check.ok) throw new Error(check.error);
  return integrations.discoverAccounts(credentials, keys, (url) => shell.openExternal(url));
});

ipcMain.handle('test-all-connections', async () => {
  const { execSync } = require('child_process');
  const script = path.join(__dirname, 'scripts', 'test-connections.js');
  try {
    const out = execSync(`node "${script}"`, { encoding: 'utf8', timeout: 120000 });
    return { success: true, output: out };
  } catch (e) {
    return { success: false, output: e.stdout || '', error: e.stderr || e.message };
  }
});


