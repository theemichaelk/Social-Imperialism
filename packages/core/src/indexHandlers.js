/**
 * Remaining inline handlers from apps/desktop/index.js for full SaaS parity.
 */
const path = require('path');
const axios = require('axios');

function registerIndexHandlers(deps) {
  const {
    ipcMain, store, integrations, resolveKeys, generateAI, buildApiMetrics, calendarApi,
  } = deps;

  const getGlobalKey = (key) => {
    try {
      return resolveKeys(JSON.parse(store.getItem('globalApiKeys') || '{}'))[key];
    } catch (e) { return null; }
  };

  const getCampaign = () => {
    const activeId = store.getItem('activeCampaignId') || 'default';
    const camps = JSON.parse(store.getItem('campaigns') || '[]');
    return camps.find((c) => c.id === activeId) || { brandName: 'Your Brand', domain: '' };
  };

  function getCampaignStats(campaignId) {
    let linkedAccounts = 0;
    let keywords = 0;
    try {
      const accData = store.getItem(`linkedAccounts_${campaignId}`);
      if (accData) linkedAccounts = JSON.parse(accData).length;
    } catch (e) {}
    try {
      const kwData = store.getItem('keywords');
      if (kwData) keywords = JSON.parse(kwData).filter((k) => k.campaignId === campaignId).length;
    } catch (e) {}
    return { linkedAccounts, keywords };
  }

  async function runAdvancedWorkflow(recipe, inputPayload) {
    const keys = resolveKeys(JSON.parse(store.getItem('globalApiKeys') || '{}'));
    const wfKey = keys.advancedWorkflowKey;
    if (!wfKey) return { success: false, error: 'No Advanced Workflow Key configured' };
    try {
      const res = await axios.post(`https://api.gooey.ai/v1/recipes/${recipe}/run`, { input: inputPayload }, {
        headers: { Authorization: `Bearer ${wfKey}`, 'Content-Type': 'application/json' },
      });
      return { success: true, output: res.data.output || res.data };
    } catch (e) {
      return { success: false, error: e.message };
    }
  }

  async function generateImageForStudio(prompt) {
    const keys = resolveKeys(JSON.parse(store.getItem('globalApiKeys') || '{}'));
    const falKey = keys.falKey;
    if (keys.advancedWorkflowKey) {
      const wfRes = await runAdvancedWorkflow('text2image', { text_prompt: prompt, num_images: 1, image_size: 'square_hd' });
      if (wfRes.success && wfRes.output?.images?.[0]) {
        return { success: true, imageUrl: wfRes.output.images[0].url || wfRes.output.images[0] };
      }
    }
    if (!falKey) return { success: false, error: 'No FAL or Advanced Workflow key configured.' };
    try {
      const response = await axios.post('https://fal.run/fal-ai/fast-sdxl', {
        prompt, num_images: 1, image_size: 'square_hd', num_inference_steps: 4,
      }, { headers: { Authorization: `Key ${falKey}`, 'Content-Type': 'application/json' } });
      if (response.data?.images?.length) return { success: true, imageUrl: response.data.images[0].url };
      return { success: false, error: 'No image returned' };
    } catch (e) {
      return { success: false, error: e.message };
    }
  }

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
      } catch (e) {
        results.push({ accountId: accId, success: false, error: e.message });
      }
    }
    return results;
  }

  // Analytics
  ipcMain.handle('analyze-topic', async (event, payload) => {
    const { topic, platform, brandName, audience } = payload || {};
    try {
      const prompt = `Analyze trending topic "${topic}" on ${platform} for brand "${brandName}" targeting "${audience}". Return JSON: {"textAnalysis":"3-5 sentences"}`;
      const resultText = await generateAI(prompt);
      let clean = resultText.trim().replace(/^```json/, '').replace(/```$/, '');
      return { success: true, analysis: JSON.parse(clean.trim()) };
    } catch (e) { return { error: e.message }; }
  });

  ipcMain.handle('get-domain-metrics', async (event, domain) => {
    const domKey = getGlobalKey('domDetailer');
    if (!domKey) return { error: 'No DomDetailer API Key configured.' };
    if (!domain) return { error: 'No domain provided.' };
    try {
      const url = `http://domdetailer.com/api/checkDomain.php?domain=${encodeURIComponent(domain)}&app=SocialImperialism&apikey=${encodeURIComponent(domKey)}`;
      const response = await axios.get(url);
      if (response.data.error || response.data.error_message) return { error: response.data.error || response.data.error_message };
      return { success: true, data: response.data };
    } catch (e) { return { error: e.message }; }
  });

  ipcMain.handle('get-site-traffic-health', async (event, payload) => {
    const { domains = [], keyword = '' } = payload || {};
    const keys = resolveKeys(JSON.parse(store.getItem('globalApiKeys') || '{}'));
    const domKey = keys.domDetailer;
    const serpKey = keys.serpApiKey;
    const siteList = (Array.isArray(domains) ? domains : [domains]).filter(Boolean).slice(0, 8);

    const sites = await Promise.all(siteList.map(async (domain) => {
      const clean = String(domain).replace(/^https?:\/\//, '').split('/')[0].trim();
      if (!clean) return { domain: domain, error: 'Invalid domain' };
      if (!domKey) return { domain: clean, error: 'DomDetailer key not configured', health: 'unknown' };
      try {
        const url = `http://domdetailer.com/api/checkDomain.php?domain=${encodeURIComponent(clean)}&app=SocialImperialism&apikey=${encodeURIComponent(domKey)}`;
        const res = await axios.get(url, { timeout: 12000 });
        const data = res.data || {};
        if (data.error || data.error_message) {
          return { domain: clean, error: data.error || data.error_message, health: 'error' };
        }
        const da = data.mozDA ?? data.da ?? 0;
        const pa = data.mozPA ?? data.pa ?? 0;
        const tf = data.majesticTF ?? data.trustFlow ?? 0;
        const cf = data.majesticCF ?? data.citationFlow ?? 0;
        const health = da >= 30 && tf >= 15 ? 'strong' : da >= 15 ? 'moderate' : 'building';
        return {
          domain: clean, success: true, da, pa, tf, cf, health,
          backlinks: data.backlinks ?? data.majesticLinks ?? null,
          indexed: data.indexed ?? null,
          raw: data,
        };
      } catch (e) {
        return { domain: clean, error: e.message, health: 'error' };
      }
    }));

    let keywordResearch = null;
    let serpResults = null;
    const kw = String(keyword || '').trim();
    if (kw) {
      try {
        keywordResearch = await integrations.researchSingleKeyword(kw, keys);
      } catch (e) {
        keywordResearch = { error: e.message };
      }
      if (serpKey) {
        try {
          const res = await axios.get(`https://serpapi.com/search.json?q=${encodeURIComponent(kw)}&api_key=${serpKey}`, { timeout: 12000 });
          serpResults = {
            success: true,
            total: (res.data.organic_results || []).length,
            results: (res.data.organic_results || []).slice(0, 8).map((r) => ({
              title: r.title, link: r.link, position: r.position, snippet: r.snippet,
            })),
          };
        } catch (e) {
          serpResults = { success: false, error: e.message };
        }
      } else {
        serpResults = { success: false, error: 'SerpAPI key not configured' };
      }
    }

    return {
      success: true,
      keyword: kw,
      sites,
      keywordResearch,
      serp: serpResults,
      timestamp: new Date().toISOString(),
    };
  });

  ipcMain.handle('get-domdetailer-metrics', async (event, targetDomain) => {
    const domain = (targetDomain || getCampaign().domain || '').trim();
    if (!domain) return { error: 'No domain provided.' };
    const domKey = getGlobalKey('domDetailer');
    if (!domKey) return { error: 'No DomDetailer API Key configured.' };
    try {
      const url = `http://domdetailer.com/api/checkDomain.php?domain=${encodeURIComponent(domain)}&app=SocialImperialism&apikey=${encodeURIComponent(domKey)}`;
      const res = await axios.get(url);
      const data = res.data;
      if (data.error || data.error_message) return { error: data.error || data.error_message };
      return {
        domain, success: true, data,
        da: data.mozDA ?? data.da ?? null,
        pa: data.mozPA ?? data.pa ?? null,
        trustFlow: data.majesticTF ?? data.trustFlow ?? null,
        citationFlow: data.majesticCF ?? data.citationFlow ?? null,
      };
    } catch (e) { return { error: e.message }; }
  });

  ipcMain.handle('get-project-metrics', (event, campaignId) => {
    const id = campaignId || store.getItem('activeCampaignId') || 'default';
    return integrations.EntityStore?.metrics?.getProject(store, id) || getCampaignStats(id);
  });

  // Settings status
  ipcMain.handle('get-settings-status', () => {
    let campaigns = [];
    try { campaigns = JSON.parse(store.getItem('campaigns') || '[]'); } catch (e) {}
    const keys = resolveKeys(JSON.parse(store.getItem('globalApiKeys') || '{}'));
    let billing = { plan: 'starter' };
    try { billing = JSON.parse(store.getItem('billingPlan') || '{"plan":"starter"}'); } catch (e) {}
    return {
      campaignCount: campaigns.length,
      activeCampaignId: store.getItem('activeCampaignId') || null,
      campaigns: campaigns.map((c) => ({ id: c.id, brandName: c.brandName, status: c.status || 'Draft', ...getCampaignStats(c.id) })),
      apiMetrics: buildApiMetrics(keys),
      apiReady: integrations.getApiStatus ? integrations.getApiStatus(keys) : {},
      billingPlan: billing.plan || 'starter',
    };
  });

  ipcMain.handle('save-fetch-profile', (event, profileData) => {
    const activeId = store.getItem('activeCampaignId') || 'default';
    const key = `fetchProfiles_${activeId}`;
    let profiles = [];
    try { profiles = JSON.parse(store.getItem(key) || '[]'); } catch (e) {}
    if (profileData.id) profiles = profiles.filter((p) => p.id !== profileData.id);
    else profileData.id = `prof_${Date.now()}`;
    profiles.push(profileData);
    store.setItem(key, JSON.stringify(profiles));
    return profiles;
  });
  ipcMain.handle('get-fetch-profiles', () => {
    const activeId = store.getItem('activeCampaignId') || 'default';
    try { return JSON.parse(store.getItem(`fetchProfiles_${activeId}`) || '[]'); } catch (e) { return []; }
  });
  ipcMain.handle('delete-fetch-profile', (event, profileId) => {
    const activeId = store.getItem('activeCampaignId') || 'default';
    const key = `fetchProfiles_${activeId}`;
    let profiles = [];
    try { profiles = JSON.parse(store.getItem(key) || '[]'); } catch (e) {}
    profiles = profiles.filter((p) => p.id !== profileId);
    store.setItem(key, JSON.stringify(profiles));
    return { success: true, profiles };
  });

  const defaultIntelligenceSettings = () => ({
    enabled: true,
    surfaces: ['account-hub', 'dashboard', 'calendar', 'content-hub', 'browse-posts', 'rules', 'account-creator'],
    autoSuggestScheduling: true,
    autoSuggestNiches: true,
    autoSuggestCommunities: true,
  });

  ipcMain.handle('get-intelligence-settings', () => {
    try {
      const raw = JSON.parse(store.getItem('intelligenceSettings') || 'null');
      return { ...defaultIntelligenceSettings(), ...(raw || {}) };
    } catch (e) {
      return defaultIntelligenceSettings();
    }
  });

  ipcMain.handle('save-intelligence-settings', (event, payload) => {
    const next = { ...defaultIntelligenceSettings(), ...(payload || {}) };
    store.setItem('intelligenceSettings', JSON.stringify(next));
    return { success: true, settings: next };
  });

  // Account hub extras
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
    const connectionId = selectedAccounts[0]?.connectionId || `conn_${Date.now()}`;
    const proxyId = selectedAccounts[0]?.proxyId || null;
    const useProxy = selectedAccounts[0]?.useProxy === true || !!proxyId;
    const { linked, profileAccountId } = await integrations.linkAllDiscoveredAccounts({
      store, integrations, keys: globalKeys,
      discovered: selectedAccounts.map((a) => ({
        ...a,
        loginEmail,
        connectionId,
        proxyId: useProxy ? (a.proxyId || proxyId) : null,
      })),
      meta: { loginEmail, connectionId, proxyId: useProxy ? proxyId : null },
    });
    return { success: true, linked: linked.length, profileAccountId };
  });
  ipcMain.handle('get-available-accounts', async (event, credentials) => {
    const keys = resolveKeys(JSON.parse(store.getItem('globalApiKeys') || '{}'));
    const check = integrations.canConnectPlatform(credentials?.platform, keys);
    if (!check.ok) throw new Error(check.error);
    return integrations.discoverAccounts(credentials, keys, deps.openExternal || (() => {}));
  });
  ipcMain.handle('test-all-connections', async () => {
    const keys = resolveKeys(JSON.parse(store.getItem('globalApiKeys') || '{}'));
    return { success: true, apiMetrics: buildApiMetrics(keys), output: buildApiMetrics(keys) };
  });

  // Worker / replies
  ipcMain.handle('increment-ai-drafts', () => {
    const count = parseInt(store.getItem('aiDraftsCount') || '0', 10) + 1;
    store.setItem('aiDraftsCount', count.toString());
    return count;
  });
  ipcMain.handle('get-all-replies-history', () => {
    try { return JSON.parse(store.getItem('aiRepliesHistory') || '[]'); } catch (e) { return []; }
  });
  ipcMain.handle('get-worker-tasks', () => {
    try { return JSON.parse(store.getItem('workerTasks') || '[]'); } catch (e) { return []; }
  });

  // Auto content / queue
  ipcMain.handle('get-auto-content-settings', () => {
    const defaults = { enabled: false, rssUrls: [], targetAccountIds: [], frequency: 'daily', publishMode: 'queue', targetPlatforms: ['Facebook', 'LinkedIn', 'Twitter'] };
    try { return { ...defaults, ...JSON.parse(store.getItem('autoContentSettings') || '{}') }; } catch (e) { return defaults; }
  });
  ipcMain.handle('save-auto-content-settings', (event, settings) => {
    store.setItem('autoContentSettings', JSON.stringify(settings || {}));
    return { success: true };
  });
  ipcMain.handle('get-content-queue', () => {
    try { return JSON.parse(store.getItem('contentReviewQueue') || '[]'); } catch (e) { return []; }
  });
  ipcMain.handle('remove-content-queue-item', (event, id) => {
    let queue = [];
    try { queue = JSON.parse(store.getItem('contentReviewQueue') || '[]'); } catch (e) {}
    const before = queue.length;
    queue = queue.filter((item) => item.id !== id);
    store.setItem('contentReviewQueue', JSON.stringify(queue));
    return { success: true, removed: before - queue.length };
  });
  ipcMain.handle('reuse-qa-as-content', (event, payload) => {
    const campaign = getCampaign();
    const content = integrations.reuseAnswerAsContent(payload?.answer || '', campaign, payload?.format || 'blog');
    let queue = [];
    try { queue = JSON.parse(store.getItem('contentReviewQueue') || '[]'); } catch (e) {}
    queue.unshift({ id: `reuse_${Date.now()}`, content, format: payload?.format || 'blog', source: 'qa_answer', queuedAt: new Date().toISOString(), status: 'pending_review' });
    store.setItem('contentReviewQueue', JSON.stringify(queue.slice(0, 100)));
    return { success: true, content, format: payload?.format || 'blog' };
  });

  ipcMain.handle('curate-from-rss', async (event, payload) => {
    const { rssUrl, numItems = 3, targetPlatform = 'Facebook' } = payload || {};
    const campaign = getCampaign();
    try {
      const res = await axios.get(rssUrl, { timeout: 10000 });
      const items = [];
      const itemRegex = /<item[^>]*>([\s\S]*?)<\/item>/gi;
      let match;
      while ((match = itemRegex.exec(res.data)) && items.length < numItems) {
        const itemXml = match[1];
        const title = (itemXml.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [])[1] || 'Untitled';
        const link = (itemXml.match(/<link[^>]*>([\s\S]*?)<\/link>/i) || [])[1] || '';
        const desc = (itemXml.match(/<description[^>]*>([\s\S]*?)<\/description>/i) || [])[1] || '';
        items.push({ title: title.replace(/<!\[CDATA\[|\]\]>/g, '').trim(), link: link.trim(), description: desc.replace(/<[^>]+>/g, '').substring(0, 300) });
      }
      if (!items.length) return { success: false, error: 'RSS feed returned no items.', posts: [] };
      const curatedPosts = [];
      for (const item of items) {
        const postText = await generateAI(`Curate a ${targetPlatform} post for ${campaign.brandName} from: ${item.title}. Return only post text.`);
        curatedPosts.push({ title: item.title, originalLink: item.link, content: postText.trim().substring(0, 500), platform: targetPlatform, curatedFor: campaign.brandName });
      }
      return { success: true, posts: curatedPosts, source: rssUrl };
    } catch (e) {
      const fallbackText = await generateAI(`Create 1 engaging ${targetPlatform} post for ${campaign.brandName}.`);
      return { success: true, posts: [{ title: 'Curated Content', content: fallbackText, platform: targetPlatform }], note: 'RSS fallback' };
    }
  });

  ipcMain.handle('trigger-curate-rss', async (event, payload) => {
    const campaign = getCampaign();
    const brand = campaign.brandName || 'Your Brand';
    return {
      success: true,
      posts: [{ title: 'Curated RSS Item', content: `Engaging post for ${brand} fans. #Growth`, platform: payload?.targetPlatform || 'Facebook', curatedFor: brand }],
    };
  });

  ipcMain.handle('generate-carousel-fal', async (event, payload) => {
    const campaign = getCampaign();
    const slides = await integrations.generateCarouselSlides({
      generateAI, falKey: getGlobalKey('falKey'),
      topic: payload?.topic || 'brand update', campaign, count: payload?.count || 4,
    });
    return { success: true, slides };
  });

  ipcMain.handle('run-content-scheduler-now', async () => {
    const campaign = getCampaign();
    const result = await integrations.runContentScheduler({
      store, generateAI, falKey: getGlobalKey('falKey'), campaign,
      publishFn: (post, accountIds) => postCuratedToFanpages(post, accountIds),
    });
    return { success: true, ...result };
  });

  // Fanpage
  ipcMain.handle('get-fanpage-settings', () => integrations.getFanpageSettings(store));
  ipcMain.handle('save-fanpage-settings', (event, settings) => ({ success: true, settings: integrations.saveFanpageSettings(store, settings || {}) }));
  ipcMain.handle('get-fanpage-metrics', (event, accountIds) => integrations.getFanpageMetrics(store, accountIds || []));
  ipcMain.handle('run-fan-acquisition-now', async () => {
    const activeId = store.getItem('activeCampaignId') || 'default';
    const keys = resolveKeys(JSON.parse(store.getItem('globalApiKeys') || '{}'));
    const campaign = getCampaign();
    const linkedAccounts = JSON.parse(store.getItem(`linkedAccounts_${activeId}`) || '[]');
    return { success: true, ...(await integrations.runTargetedFanAcquisition({ store, campaign, keys, linkedAccounts, generateAI })) };
  });
  ipcMain.handle('run-fanpage-hands-free-now', async () => {
    const activeId = store.getItem('activeCampaignId') || 'default';
    const keys = resolveKeys(JSON.parse(store.getItem('globalApiKeys') || '{}'));
    const campaign = getCampaign();
    const linkedAccounts = JSON.parse(store.getItem(`linkedAccounts_${activeId}`) || '[]');
    return { success: true, ...(await integrations.runHandsFreeCycle({
      store, campaign, keys, linkedAccounts, generateAI,
      falKey: getGlobalKey('falKey'),
      publishFn: (post, accountIds) => postCuratedToFanpages(post, accountIds),
    })) };
  });

  // Q&A sources
  ipcMain.handle('get-qa-sources', () => {
    let faq = [];
    try { faq = JSON.parse(store.getItem('qaFaqSources') || '[]'); } catch (e) {}
    return { faqSources: faq, manualSources: store.getItem('qaManualSources') || '' };
  });
  ipcMain.handle('save-qa-sources', (event, payload) => {
    if (payload?.faqSources) store.setItem('qaFaqSources', JSON.stringify(payload.faqSources));
    if (payload?.manualSources !== undefined) store.setItem('qaManualSources', payload.manualSources || '');
    return { success: true };
  });

  // Media / integrations
  ipcMain.handle('generate-image', async (event, prompt) => generateImageForStudio(prompt));
  ipcMain.handle('serp-search', async (event, q) => {
    const key = getGlobalKey('serpApiKey');
    if (!key) return { success: false, error: 'No SerpAPI key' };
    try {
      const res = await axios.get(`https://serpapi.com/search.json?q=${encodeURIComponent(q)}&api_key=${key}`, { timeout: 20000 });
      return { success: true, data: res.data.organic_results || [] };
    } catch (e) {
      const msg = e.message || '';
      if (msg.includes('429') || msg.includes('403')) {
        return { success: true, rateLimited: true, data: [], note: 'SerpAPI rate limited — retry later or use Keyword Research' };
      }
      return { success: false, error: msg };
    }
  });
  ipcMain.handle('search-stock-photo', async (event, query) => {
    const keys = resolveKeys(JSON.parse(store.getItem('globalApiKeys') || '{}'));
    const unsplashKey = keys.unsplashAccessKey;
    if (unsplashKey) {
      try {
        const res = await axios.get(`https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&per_page=1&client_id=${unsplashKey}`, { headers: { 'Accept-Version': 'v1' } });
        const photo = res.data?.results?.[0];
        if (photo?.urls) {
          return { success: true, imageUrl: photo.urls.regular, source: 'Unsplash', photographer: photo.user?.name || null };
        }
      } catch (e) { /* next source */ }
    }
    const pexelsKey = keys.pexelsKey;
    if (pexelsKey) {
      try {
        const res = await axios.get(`https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=1&size=medium`, {
          headers: { Authorization: pexelsKey },
        });
        const p = res.data?.photos?.[0];
        if (p) return { success: true, imageUrl: p.src.medium || p.src.original, source: 'Pexels', photographer: p.photographer || null };
      } catch (e) { /* next */ }
    }
    const pixKey = keys.pixabayKey;
    if (pixKey) {
      try {
        const res = await axios.get(`https://pixabay.com/api/?key=${pixKey}&q=${encodeURIComponent(query)}&image_type=photo&per_page=3&min_width=640&safesearch=true`);
        const h = res.data?.hits?.[0];
        if (h) return { success: true, imageUrl: h.webformatURL || h.largeImageURL, source: 'Pixabay', photographer: h.user || null };
      } catch (e) { /* next */ }
    }
    const flickrKey = keys.flickrKey || keys.flickrKey2;
    if (flickrKey) {
      try {
        const res = await axios.get(`https://www.flickr.com/services/rest/?method=flickr.photos.search&api_key=${flickrKey}&text=${encodeURIComponent(query)}&per_page=3&format=json&nojsoncallback=1&sort=relevance&license=4,5,6,7,8,9`);
        const ph = res.data?.photos?.photo?.[0];
        if (ph) {
          const url = `https://farm${ph.farm}.staticflickr.com/${ph.server}/${ph.id}_${ph.secret}_c.jpg`;
          return { success: true, imageUrl: url, source: 'Flickr', photographer: ph.owner || null };
        }
      } catch (e) { /* final */ }
    }
    return { success: true, imageUrl: `https://source.unsplash.com/800x600/?${encodeURIComponent(query)}`, source: 'Unsplash Source (fallback)' };
  });
  ipcMain.handle('upload-local-media', async (event, input) => {
    if (typeof input === 'string' && input.startsWith('data:')) return input;
    if (input?.dataUrl?.startsWith('data:')) return input.dataUrl;
    if (input?.filePath) {
      try {
        const fs = require('fs');
        const ext = path.extname(input.filePath).toLowerCase();
        const mime = ext === '.png' ? 'image/png' : ext === '.gif' ? 'image/gif' : ext === '.mp4' ? 'video/mp4' : 'image/jpeg';
        return `data:${mime};base64,${fs.readFileSync(input.filePath).toString('base64')}`;
      } catch (e) { return null; }
    }
    return null;
  });
  ipcMain.handle('get-streaming-keys', () => {
    const keys = resolveKeys(JSON.parse(store.getItem('globalApiKeys') || '{}'));
    return {
      success: true,
      keys: {
        streamingText: keys.streamingKeys || '',
        yt: keys.ytStreamKeyTsbr ? `rtmp://a.rtmp.youtube.com/live2 / ${keys.ytStreamKeyTsbr}` : `rtmp://a.rtmp.youtube.com/live2 / ${keys.ytStreamKeyFunics || ''}`,
        ytFunics: keys.ytStreamKeyFunics ? `rtmp://a.rtmp.youtube.com/live2 / ${keys.ytStreamKeyFunics}` : null,
        fb: keys.fbStreamingKey ? `rtmps://live-api-s.facebook.com:443/rtmp/ / ${keys.fbStreamingKey}` : null,
        fbTechLauncher: keys.fbTechLauncherKey || null,
        fbStoneBuilders: keys.fbStoneBuildersKey || null,
        fbFunics: keys.fbFunicsKey || null,
        fbRtmpServer: keys.fbRtmpServer || 'rtmps://live-api-s.facebook.com:443/rtmp/',
        twitch: keys.twitchStreamKey || null,
        twitchServer: keys.twitchRtmpServer || 'rtmp://dfw.contribute.live-video.net/app/',
        youtubeApiForLive: keys.youtubeApiKey || keys.ytId || null,
      },
    };
  });
  ipcMain.handle('get-youtube-channels', async () => {
    const key = getGlobalKey('youtubeApiKey');
    if (!key) return { success: false, error: 'No YouTube API key' };
    try {
      const res = await axios.get(`https://www.googleapis.com/youtube/v3/search?part=snippet&q=tech&maxResults=5&key=${key}`, { timeout: 20000 });
      return { success: true, data: res.data.items || [] };
    } catch (e) {
      const msg = e.message || '';
      if (msg.includes('429') || msg.includes('403')) {
        return {
          success: true,
          rateLimited: true,
          data: [],
          note: 'YouTube quota rate limited — OAuth channel list still works in Account Hub',
        };
      }
      return { success: false, error: msg };
    }
  });
  ipcMain.handle('play-tts', async (event, text) => {
    const secret = getGlobalKey('playhtSecretKey');
    const userId = getGlobalKey('playhtUserId');
    if (!secret) return { success: false, error: 'No Play.ht key' };
    try {
      const res = await axios.post('https://api.play.ht/api/v2/tts', { text, voice: 'en-US-JennyNeural' }, {
        headers: { Authorization: `Bearer ${secret}`, 'X-User-Id': userId, 'Content-Type': 'application/json' },
      });
      return { success: true, audioUrl: res.data.url };
    } catch (e) { return { success: false, error: e.message }; }
  });
  ipcMain.handle('deepl-translate', async (event, text, targetLang = 'ES') => {
    const key = getGlobalKey('deeplKey');
    if (!key) return { success: false, error: 'No DeepL key' };
    const endpoints = key.endsWith(':fx')
      ? ['https://api-free.deepl.com/v2/translate', 'https://api.deepl.com/v2/translate']
      : ['https://api.deepl.com/v2/translate', 'https://api-free.deepl.com/v2/translate'];
    for (const base of endpoints) {
      try {
        const body = new URLSearchParams({
          auth_key: key,
          text: String(text || ''),
          target_lang: String(targetLang || 'EN').toUpperCase(),
        });
        const res = await axios.post(base, body.toString(), {
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          timeout: 15000,
        });
        if (res.data?.translations?.[0]?.text) {
          return { success: true, translated: res.data.translations[0].text };
        }
      } catch (e) { /* try next endpoint */ }
    }
    return { success: false, error: 'DeepL translation failed on all endpoints' };
  });
  ipcMain.handle('contentful-fetch', async () => {
    const space = getGlobalKey('contentfulSpaceId');
    const token = getGlobalKey('contentfulAccessToken');
    if (!space || !token) return { success: false, error: 'No Contentful credentials' };
    try {
      const res = await axios.get(`https://cdn.contentful.com/spaces/${space}/entries?access_token=${token}`);
      return { success: true, entries: res.data.items || [] };
    } catch (e) { return { success: false, error: e.message }; }
  });
  ipcMain.handle('run-ai-workflow', async (event, recipe, input) => runAdvancedWorkflow(recipe, input));
}

module.exports = { registerIndexHandlers };