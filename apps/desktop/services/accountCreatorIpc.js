/**
 * Account Creator IPC — profile kits, proxy pool, AI assets, calendar push.
 */
const axios = require('axios');
const fs = require('fs');
const os = require('os');
const path = require('path');

function getProfileKitsExportDir() {
  try {
    const { app } = require('electron');
    if (app?.getPath) return path.join(app.getPath('userData'), 'profile-kits');
  } catch (e) { /* SaaS / headless — no Electron */ }
  const dir = path.join(os.tmpdir(), 'si-saas', 'profile-kits');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}
const proxyManager = require('./proxyManager');
const accountCreator = require('./accountCreator');
const { resolveKeys } = require('./keys');
const { uploadKitToLinkedAccounts } = require('./profileUploader');
const { applyKitViaBrowser } = require('./profileBrowserAutomation');
const { getLinkedAccounts } = require('./accountAutomation');
const browserBatchRunner = require('./browserBatchRunner');

async function generateImageWithKeys(store, prompt) {
  const keys = resolveKeys(JSON.parse(store.getItem('globalApiKeys') || '{}'));
  const falKey = keys.falKey || process.env.FAL_KEY;

  if (keys.advancedWorkflowKey) {
    try {
      const res = await axios.post('https://api.gooey.ai/v2/invoke/text2image', {
        text_prompt: prompt,
        num_images: 1,
        image_size: 'square_hd',
      }, {
        headers: { Authorization: `Bearer ${keys.advancedWorkflowKey}` },
        timeout: 120000,
      });
      const img = res.data?.output?.images?.[0];
      const url = typeof img === 'string' ? img : img?.url;
      if (url) return { success: true, imageUrl: url, source: 'Advanced Workflow' };
    } catch (e) {
      console.warn('Advanced Workflow image failed:', e.message);
    }
  }

  if (!falKey) {
    return { success: false, error: 'No FAL or Advanced Workflow key configured.' };
  }

  try {
    const response = await axios.post('https://fal.run/fal-ai/fast-sdxl', {
      prompt,
      num_images: 1,
      image_size: 'square_hd',
      num_inference_steps: 4,
    }, {
      headers: { Authorization: `Key ${falKey}`, 'Content-Type': 'application/json' },
      timeout: 120000,
    });
    if (response.data?.images?.[0]?.url) {
      return { success: true, imageUrl: response.data.images[0].url, source: 'FAL AI' };
    }
    return { success: false, error: 'No image returned from FAL API' };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

async function fetchUnsplashPhoto(keys, query, orientation = 'landscape') {
  const unsplashKey = keys.unsplashAccessKey || keys.unsplashApplicationId;
  if (!unsplashKey) return null;
  try {
    const res = await axios.get('https://api.unsplash.com/photos/random', {
      params: {
        query,
        orientation,
        client_id: unsplashKey,
      },
      headers: { 'Accept-Version': 'v1' },
      timeout: 30000,
    });
    if (res.data?.urls) {
      return {
        imageUrl: res.data.urls.regular || res.data.urls.full,
        source: 'Unsplash',
        photographer: res.data.user?.name || null,
        unsplashLink: res.data.links?.html || null,
      };
    }
  } catch (e) {
    console.warn('Unsplash fetch failed:', query, e.message);
  }
  return null;
}

function getActiveCampaign(store) {
  const activeCampaignId = store.getItem('activeCampaignId') || 'default';
  const camps = JSON.parse(store.getItem('campaigns') || '[]');
  return camps.find((c) => c.id === activeCampaignId) || null;
}

async function generateFullProfileKit(store, generateAI, payload, onProgress) {
  const campaign = getActiveCampaign(store);
  if (!campaign?.brandName) {
    throw new Error('Set up a campaign brand profile in Settings first.');
  }

  const platforms = (payload.platforms || []).filter((p) => accountCreator.SUPPORTED_PLATFORMS.includes(p));
  if (!platforms.length) throw new Error('Select at least one platform.');

  const kit = accountCreator.createEmptyKit(campaign.id, {
    platforms,
    proxyId: payload.proxyId || null,
    personaName: payload.personaName,
    youtubeVideoUrl: payload.youtubeVideoUrl,
    launchDate: payload.launchDate,
  });
  kit.status = 'generating';
  accountCreator.saveKit(store, kit);

  if (payload.proxyId) {
    proxyManager.assignProxyToKit(store, payload.proxyId, kit.id);
  }

  const keys = resolveKeys(JSON.parse(store.getItem('globalApiKeys') || '{}'));
  const variantCount = Math.min(Math.max(parseInt(payload.variantCount, 10) || 4, 1), 6);
  const variants = accountCreator.VARIANT_SETTINGS.slice(0, variantCount);

  try {
    onProgress?.({ step: 'identity', message: 'Generating persona name, bios, and handles...' });
    const identityRaw = await generateAI(accountCreator.buildIdentityPrompt(campaign, {
      platforms,
      personaName: payload.personaName,
      personaStyle: payload.personaStyle,
    }));
    const identity = accountCreator.parseJsonFromAi(identityRaw);
    kit.identity = identity;
    kit.name = identity.displayName || kit.name;
    kit.youtube = {
      ...kit.youtube,
      channelName: identity.youtube?.channelName || identity.displayName,
      channelDescription: identity.youtube?.channelDescription || identity.longDescription,
      featuredVideoUrl: payload.youtubeVideoUrl || null,
      videoId: accountCreator.extractYouTubeVideoId(payload.youtubeVideoUrl),
    };

    if (payload.generateAssets !== false) {
      onProgress?.({ step: 'profilePic', message: 'Creating AI profile picture...' });
      const profilePrompt = `${identity.profileImagePrompt || `Professional portrait of ${identity.displayName}, ${campaign.tone} brand ambassador`}, high quality, photorealistic, square crop`;
      const profileRes = await generateImageWithKeys(store, profilePrompt);
      if (profileRes.success) {
        kit.assets.profilePic = { url: profileRes.imageUrl, source: profileRes.source, prompt: profilePrompt };
      }

      kit.assets.variantPics = [];
      for (let i = 0; i < variants.length; i++) {
        const v = variants[i];
        onProgress?.({ step: 'variants', message: `Generating variant photo: ${v.label} (${i + 1}/${variants.length})...` });
        const vPrompt = `${identity.profileImagePrompt || identity.displayName}, ${v.promptSuffix}, photorealistic, high quality`;
        const vRes = await generateImageWithKeys(store, vPrompt);
        kit.assets.variantPics.push({
          id: v.id,
          label: v.label,
          url: vRes.success ? vRes.imageUrl : null,
          source: vRes.source || 'failed',
          prompt: vPrompt,
        });
      }

      kit.assets.covers = {};
      kit.assets.banners = {};
      const coverQueries = identity.coverSearchQueries || {};
      for (const platform of platforms) {
        const query = coverQueries[platform]
          || accountCreator.COVER_QUERIES[platform]
          || `${campaign.brandName} ${platform} banner`;
        onProgress?.({ step: 'covers', message: `Fetching ${platform} cover from Unsplash...` });
        const cover = await fetchUnsplashPhoto(keys, query, 'landscape');
        if (cover) {
          kit.assets.covers[platform] = cover;
          if (['YouTube', 'Twitter', 'Facebook', 'LinkedIn', 'Twitch'].includes(platform)) {
            kit.assets.banners[platform] = { ...cover };
          }
        }
      }
    }

    onProgress?.({ step: 'schedule', message: 'Building content schedule...' });
    let schedule = [];
    try {
      const schedRaw = await generateAI(accountCreator.buildSchedulePrompt(campaign, identity, {
        platforms,
        scheduleWeeks: payload.scheduleWeeks || 4,
        postsPerWeek: payload.postsPerWeek || 3,
        youtubeVideoUrl: payload.youtubeVideoUrl,
      }));
      schedule = accountCreator.parseScheduleFromAi(schedRaw);
    } catch (e) {
      console.warn('AI schedule parse failed, using fallback:', e.message);
      schedule = accountCreator.fallbackSchedule(platforms, identity, {
        scheduleWeeks: payload.scheduleWeeks || 4,
        postsPerWeek: payload.postsPerWeek || 3,
        youtubeVideoUrl: payload.youtubeVideoUrl,
        brandName: campaign.brandName,
      });
    }
    kit.contentSchedule = schedule.map((item, idx) => ({
      id: `cs_${kit.id}_${idx}`,
      ...item,
      youtubeUrl: item.youtubeUrl || (item.contentType === 'video' ? payload.youtubeVideoUrl : null),
      status: 'planned',
    }));

    kit.status = 'ready';
    kit.updatedAt = new Date().toISOString();
    accountCreator.saveKit(store, kit);
    onProgress?.({ step: 'done', message: 'Profile kit ready.' });
    return { success: true, kit };
  } catch (err) {
    kit.status = 'draft';
    kit.error = err.message;
    accountCreator.saveKit(store, kit);
    throw err;
  }
}

function pushKitScheduleToStore(store, kit, campaignId, launchDate) {
  const posts = accountCreator.scheduleToCalendarPosts(
    kit.contentSchedule,
    kit,
    campaignId,
    launchDate || kit.launchDate,
    kit.accountMap,
  );
  const existing = JSON.parse(store.getItem('scheduled_posts') || '[]');
  existing.push(...posts);
  store.setItem('scheduled_posts', JSON.stringify(existing));
  kit.status = 'scheduled';
  kit.scheduledAt = new Date().toISOString();
  accountCreator.saveKit(store, kit);
  return { success: true, count: posts.length };
}

function registerAccountCreatorHandlers({ ipcMain, store, generateAI, calendarApi, onBatchProgress }) {
  const channels = [
    'get-proxy-pool',
    'save-proxy',
    'delete-proxy',
    'test-proxy',
    'import-proxies-bulk',
    'get-profile-kits',
    'get-profile-kit',
    'save-profile-kit',
    'delete-profile-kit',
    'generate-profile-kit',
    'push-kit-schedule-to-calendar',
    'export-profile-kit',
    'get-account-creator-status',
    'generate-bulk-profile-kits',
    'apply-kit-browser-automation',
    'upload-kit-to-linked-accounts',
    'get-linked-accounts-for-kit',
    'save-kit-account-map',
    'schedule-browser-batch',
    'get-browser-batch-status',
    'cancel-browser-batch',
    'run-browser-batch-now',
    'process-browser-batch-queue',
  ];

  channels.forEach((ch) => {
    try { ipcMain.removeHandler(ch); } catch (e) { /* not registered */ }
  });

  ipcMain.handle('get-proxy-pool', () => proxyManager.getProxyPool(store));

  ipcMain.handle('save-proxy', (event, proxyInput) => {
    try {
      if (proxyInput?.id) {
        return { success: true, proxy: proxyManager.updateProxy(store, proxyInput.id, proxyInput) };
      }
      return { success: true, proxy: proxyManager.addProxy(store, proxyInput) };
    } catch (e) {
      return { success: false, error: e.message };
    }
  });

  ipcMain.handle('delete-proxy', (event, id) => {
    try {
      proxyManager.deleteProxy(store, id);
      return { success: true };
    } catch (e) {
      return { success: false, error: e.message };
    }
  });

  function parseProxyImportLine(line, defaultProtocol = 'http') {
    let raw = String(line || '').trim();
    if (!raw || raw.startsWith('#')) return null;
    let label = null;
    if (raw.includes('|')) {
      const parts = raw.split('|');
      label = parts[0].trim();
      raw = parts.slice(1).join('|').trim();
    }
    let username = null;
    let password = null;
    if (raw.includes('@')) {
      const at = raw.lastIndexOf('@');
      const auth = raw.slice(0, at);
      raw = raw.slice(at + 1);
      const colon = auth.indexOf(':');
      if (colon >= 0) {
        username = auth.slice(0, colon);
        password = auth.slice(colon + 1);
      } else username = auth;
    }
    const lastColon = raw.lastIndexOf(':');
    if (lastColon < 0) throw new Error(`Invalid format: ${line}`);
    const host = raw.slice(0, lastColon).trim();
    const port = parseInt(raw.slice(lastColon + 1), 10);
    if (!host || Number.isNaN(port)) throw new Error(`Invalid host:port — ${line}`);
    return {
      label: label || `${host}:${port}`,
      host,
      port,
      protocol: defaultProtocol,
      username,
      password,
    };
  }

  ipcMain.handle('import-proxies-bulk', (event, payload = {}) => {
    const text = String(payload.text || payload.lines || '');
    const protocol = ['http', 'https', 'socks5'].includes(payload.protocol) ? payload.protocol : 'http';
    const imported = [];
    const errors = [];
    text.split(/\r?\n/).forEach((line, i) => {
      try {
        const parsed = parseProxyImportLine(line, protocol);
        if (!parsed) return;
        imported.push(proxyManager.addProxy(store, parsed));
      } catch (e) {
        errors.push({ line: i + 1, error: e.message });
      }
    });
    return {
      success: imported.length > 0,
      imported,
      count: imported.length,
      errors,
    };
  });

  ipcMain.handle('test-proxy', async (event, proxyId) => {
    const proxy = proxyManager.findProxyById(store, proxyId);
    if (!proxy) return { success: false, error: 'Proxy not found.' };
    const url = proxyManager.formatProxyUrl(proxy);
    try {
      const start = Date.now();
      let res;
      if (proxy.protocol === 'socks5') {
        try {
          const { SocksProxyAgent } = require('socks-proxy-agent');
          const agent = new SocksProxyAgent(url);
          res = await axios.get('https://api.ipify.org?format=json', {
            httpAgent: agent,
            httpsAgent: agent,
            timeout: 15000,
            headers: { 'User-Agent': 'Social-Imperialism/1.0' },
          });
        } catch (socksErr) {
          return {
            success: false,
            error: `SOCKS5 test unavailable (${socksErr.message}). Proxy is saved — assign to a kit and verify during signup.`,
          };
        }
      } else {
        res = await axios.get('https://api.ipify.org?format=json', {
          proxy: {
            host: proxy.host,
            port: proxy.port,
            auth: proxy.username
              ? { username: proxy.username, password: proxy.password || '' }
              : undefined,
          },
          timeout: 15000,
          headers: { 'User-Agent': 'Social-Imperialism/1.0' },
        });
      }
      const proxies = proxyManager.getProxyPool(store);
      const idx = proxies.findIndex((p) => p.id === proxyId);
      if (idx >= 0) {
        proxies[idx].lastCheckedAt = new Date().toISOString();
        proxies[idx].lastCheckNote = `Egress IP via proxy: ${res.data?.ip || 'unknown'}`;
        proxies[idx].status = 'active';
        proxyManager.saveProxyPool(store, proxies);
      }
      return {
        success: true,
        message: `Proxy OK — egress IP: ${res.data?.ip || 'unknown'} (${Date.now() - start}ms)`,
        ip: res.data?.ip,
        latencyMs: Date.now() - start,
        proxyUrl: url,
      };
    } catch (e) {
      const proxies = proxyManager.getProxyPool(store);
      const idx = proxies.findIndex((p) => p.id === proxyId);
      if (idx >= 0) {
        proxies[idx].lastCheckedAt = new Date().toISOString();
        proxies[idx].lastCheckNote = `Test failed: ${e.message}`;
        proxyManager.saveProxyPool(store, proxies);
      }
      return { success: false, error: e.message };
    }
  });

  ipcMain.handle('get-profile-kits', (event, campaignId) => {
    const cid = campaignId || store.getItem('activeCampaignId') || 'default';
    return accountCreator.getProfileKits(store, cid);
  });

  ipcMain.handle('get-profile-kit', (event, { campaignId, kitId }) => {
    const cid = campaignId || store.getItem('activeCampaignId') || 'default';
    return accountCreator.getKitById(store, cid, kitId);
  });

  ipcMain.handle('save-profile-kit', (event, kit) => {
    if (!kit?.campaignId) {
      kit.campaignId = store.getItem('activeCampaignId') || 'default';
    }
    return { success: true, kit: accountCreator.saveKit(store, kit) };
  });

  ipcMain.handle('delete-profile-kit', (event, { campaignId, kitId }) => {
    const cid = campaignId || store.getItem('activeCampaignId') || 'default';
    const kit = accountCreator.getKitById(store, cid, kitId);
    if (kit?.proxyId) proxyManager.assignProxyToKit(store, kit.proxyId, null);
    accountCreator.deleteKit(store, cid, kitId);
    return { success: true };
  });

  ipcMain.handle('generate-profile-kit', async (event, payload) => {
    try {
      const kit = await generateFullProfileKit(store, generateAI, payload || {}, (progress) => {
        if (event?.sender && !event.sender.isDestroyed()) {
          event.sender.send('profile-kit-progress', progress);
        }
      });
      return kit;
    } catch (e) {
      return { success: false, error: e.message };
    }
  });

  ipcMain.handle('push-kit-schedule-to-calendar', (event, payload) => {
    const { kitId, campaignId, launchDate } = payload || {};
    if (!kitId) return { success: false, error: 'kitId is required.' };
    const cid = campaignId || store.getItem('activeCampaignId') || 'default';
    const kit = accountCreator.getKitById(store, cid, kitId);
    if (!kit) return { success: false, error: 'Profile kit not found.' };
    if (!kit.contentSchedule?.length) return { success: false, error: 'Kit has no content schedule.' };
    try {
      return pushKitScheduleToStore(store, kit, cid, launchDate);
    } catch (e) {
      return { success: false, error: e.message };
    }
  });

  ipcMain.handle('save-kit-account-map', (event, { kitId, campaignId, accountMap }) => {
    const cid = campaignId || store.getItem('activeCampaignId') || 'default';
    const kit = accountCreator.getKitById(store, cid, kitId);
    if (!kit) return { success: false, error: 'Profile kit not found.' };
    kit.accountMap = accountMap || {};
    kit.accountMapUpdatedAt = new Date().toISOString();
    accountCreator.saveKit(store, kit);
    return { success: true, kit };
  });

  ipcMain.handle('export-profile-kit', (event, { kitId, campaignId }) => {
    const cid = campaignId || store.getItem('activeCampaignId') || 'default';
    const kit = accountCreator.getKitById(store, cid, kitId);
    if (!kit) return { success: false, error: 'Profile kit not found.' };

    const proxy = kit.proxyId ? proxyManager.findProxyById(store, kit.proxyId) : null;
    const exportData = {
      exportedAt: new Date().toISOString(),
      kit,
      proxy: proxy ? { ...proxy, password: proxy.password ? '***' : null } : null,
    };

    const dir = getProfileKitsExportDir();
    const filePath = path.join(dir, `${kit.id}_export.json`);
    fs.writeFileSync(filePath, JSON.stringify(exportData, null, 2), 'utf8');
    return { success: true, filePath, data: exportData };
  });

  ipcMain.handle('get-account-creator-status', () => {
    const keys = resolveKeys(JSON.parse(store.getItem('globalApiKeys') || '{}'));
    const campaign = getActiveCampaign(store);
    let puppeteerReady = false;
    try { require.resolve('puppeteer'); puppeteerReady = true; } catch (e) { /* not installed */ }
    return {
      hasCampaign: !!campaign?.brandName,
      campaignName: campaign?.brandName || null,
      aiReady: !!(keys.gemini || keys.openrouter || keys.openai),
      imageGenReady: !!(keys.falKey || keys.advancedWorkflowKey),
      unsplashReady: !!(keys.unsplashAccessKey || keys.unsplashApplicationId),
      puppeteerReady,
      proxyCount: proxyManager.getProxyPool(store).length,
      availableProxies: proxyManager.getAvailableProxies(store).length,
      platforms: accountCreator.SUPPORTED_PLATFORMS,
    };
  });

  ipcMain.handle('generate-bulk-profile-kits', async (event, payload = {}) => {
    const count = Math.min(Math.max(parseInt(payload.count, 10) || 3, 1), 20);
    const kits = [];
    const errors = [];
    const availableProxies = payload.autoAssignProxies
      ? proxyManager.getAvailableProxies(store)
      : [];

    for (let i = 0; i < count; i++) {
      if (event?.sender && !event.sender.isDestroyed()) {
        event.sender.send('bulk-kit-progress', {
          current: i + 1,
          total: count,
          message: `Generating persona ${i + 1} of ${count}...`,
        });
      }

      const kitPayload = {
        ...payload,
        personaName: payload.personaNamePrefix
          ? `${payload.personaNamePrefix} ${i + 1}`
          : payload.personaName,
        proxyId: payload.autoAssignProxies
          ? (availableProxies[i]?.id || null)
          : (payload.proxyId || null),
      };

      try {
        const result = await generateFullProfileKit(store, generateAI, kitPayload, (progress) => {
          if (event?.sender && !event.sender.isDestroyed()) {
            event.sender.send('bulk-kit-progress', {
              current: i + 1,
              total: count,
              message: `Persona ${i + 1}: ${progress.message || progress.step}`,
            });
          }
        });
        if (result.kit) kits.push(result.kit);
        else if (result.error) errors.push({ index: i + 1, error: result.error });
      } catch (e) {
        errors.push({ index: i + 1, error: e.message });
      }
    }

    return { success: kits.length > 0, kits, errors, count: kits.length };
  });

  ipcMain.handle('apply-kit-browser-automation', async (event, { kitId, campaignId, platforms, mode, keepBrowserOpen }) => {
    const cid = campaignId || store.getItem('activeCampaignId') || 'default';
    const kit = accountCreator.getKitById(store, cid, kitId);
    if (!kit) return { success: false, error: 'Profile kit not found.' };

    try {
      const result = await applyKitViaBrowser(store, kit, {
        platforms: platforms || kit.platforms,
        mode: mode || 'edit',
        keepBrowserOpen: !!keepBrowserOpen,
      });
      kit.browserAppliedAt = new Date().toISOString();
      kit.browserResults = result.results;
      accountCreator.saveKit(store, kit);
      return result;
    } catch (e) {
      return { success: false, error: e.message };
    }
  });

  ipcMain.handle('upload-kit-to-linked-accounts', async (event, { kitId, campaignId, platforms, accountMap }) => {
    const cid = campaignId || store.getItem('activeCampaignId') || 'default';
    const kit = accountCreator.getKitById(store, cid, kitId);
    if (!kit) return { success: false, error: 'Profile kit not found.' };

    const keys = resolveKeys(JSON.parse(store.getItem('globalApiKeys') || '{}'));
    const summary = await uploadKitToLinkedAccounts(store, kit, keys, {
      platforms,
      accountMap: accountMap || kit.accountMap,
    });

    kit.apiUploadedAt = new Date().toISOString();
    kit.apiUploadResults = summary;
    accountCreator.saveKit(store, kit);

    const ok = summary.filter((s) => s.success).length;
    return { success: ok > 0, summary, uploaded: ok, total: summary.length };
  });

  ipcMain.handle('get-linked-accounts-for-kit', (event, { campaignId, platforms }) => {
    const cid = campaignId || store.getItem('activeCampaignId') || 'default';
    const accounts = getLinkedAccounts(store, cid);
    const plats = platforms || accountCreator.SUPPORTED_PLATFORMS;
    const norm = (p) => String(p || '').toLowerCase().replace(/twitter\s*\/\s*x/g, 'twitter').replace(/^x$/, 'twitter');
    return plats.map((platform) => {
      const target = norm(platform);
      const matches = accounts.filter((a) => {
        const p = norm(a.platform);
        return p === target || p.includes(target) || target.includes(p);
      });
      return { platform, accounts: matches };
    });
  });

  ipcMain.handle('schedule-browser-batch', (event, payload) => {
    try {
      const job = browserBatchRunner.enqueueBatch(store, payload);
      return { success: true, job };
    } catch (e) {
      return { success: false, error: e.message };
    }
  });

  ipcMain.handle('get-browser-batch-status', () => browserBatchRunner.getBatchStatus(store));

  ipcMain.handle('cancel-browser-batch', (event, batchId) => browserBatchRunner.cancelBatch(store, batchId));

  ipcMain.handle('run-browser-batch-now', (event, batchId) => {
    const res = browserBatchRunner.runBatchNow(store, batchId);
    if (res.success) {
      processBrowserBatchQueueInternal(store, onBatchProgress).catch((e) => {
        console.error('Browser batch error:', e.message);
      });
    }
    return res;
  });

  ipcMain.handle('process-browser-batch-queue', async () => {
    return processBrowserBatchQueueInternal(store, onBatchProgress);
  });
}

async function processBrowserBatchQueueInternal(store, onBatchProgress) {
  return browserBatchRunner.processBrowserBatchQueue(store, {
    applyKitViaBrowser,
    uploadKitToLinkedAccounts,
    accountCreator,
    resolveKeys,
    pushKitSchedule: (kit, campaignId) => pushKitScheduleToStore(store, kit, campaignId, kit.launchDate),
  }, (progress) => {
    if (typeof onBatchProgress === 'function') onBatchProgress(progress);
  });
}

module.exports = {
  registerAccountCreatorHandlers,
  generateFullProfileKit,
  processBrowserBatchQueue: processBrowserBatchQueueInternal,
};