/**
 * Partner API + webhook integration hub for external apps, SaaS, and tools.
 */
const crypto = require('crypto');
const axios = require('axios');

const PARTNER_CHANNELS = [
  'check-api-status', 'get-live-news', 'get-trending-topics', 'search-stock-photo',
  'serp-search', 'get-domain-metrics', 'research-keyword', 'shorten-url',
  'deepl-translate', 'get-youtube-channels', 'get-settings-status',
  'get-active-campaign', 'get-engagement-queue', 'get-automation-status',
];

const OUTBOUND_EVENTS = [
  { id: 'post.published', label: 'Post Published', desc: 'When a post is published to a social network' },
  { id: 'reply.generated', label: 'AI Reply Generated', desc: 'When the worker drafts a new AI reply' },
  { id: 'keyword.matched', label: 'Keyword Match', desc: 'When a monitored keyword finds a new post' },
  { id: 'campaign.switched', label: 'Campaign Switched', desc: 'When the active campaign changes' },
  { id: 'integration.test', label: 'Integration Test', desc: 'Test ping from Integrations Hub' },
  { id: 'webhook.inbound', label: 'Inbound Webhook', desc: 'When an external app POSTs to your inbound URL' },
];

function loadConfig(store) {
  const defaults = {
    partnerApiKey: '',
    inboundWebhookId: '',
    inboundWebhookSecret: '',
    outboundWebhooks: [],
    subscribedEvents: ['integration.test'],
    enabled: true,
    rateLimitPerHour: 1000,
    allowedOrigins: [],
    createdAt: null,
    lastUsedAt: null,
    usageCount: 0,
  };
  try {
    const parsed = JSON.parse(store.getItem('partnerIntegrationConfig') || '{}');
    return { ...defaults, ...parsed };
  } catch (e) {
    return defaults;
  }
}

function saveConfig(store, partial) {
  const existing = loadConfig(store);
  const next = { ...existing, ...partial, updatedAt: new Date().toISOString() };
  store.setItem('partnerIntegrationConfig', JSON.stringify(next));
  return next;
}

function appendEventLog(store, entry) {
  let log = [];
  try { log = JSON.parse(store.getItem('integrationEventLog') || '[]'); } catch (e) {}
  log.unshift({ ...entry, id: `evt_${Date.now()}`, at: new Date().toISOString() });
  store.setItem('integrationEventLog', JSON.stringify(log.slice(0, 100)));
  return log[0];
}

function generateKey() {
  return `si_live_${crypto.randomBytes(24).toString('hex')}`;
}

function generateWebhookId() {
  return crypto.randomBytes(16).toString('hex');
}

async function syncPartnerToPrisma(store, cfg) {
  try {
    const { prisma } = require('@si/db');
    const projectId = store.projectId || store.getItem('activeCampaignId');
    if (!projectId) return;
    if (cfg.partnerApiKey) {
      await prisma.projectSetting.upsert({
        where: { projectId_key: { projectId, key: 'partnerApiKey' } },
        create: { projectId, key: 'partnerApiKey', value: cfg.partnerApiKey },
        update: { value: cfg.partnerApiKey },
      });
    }
    if (cfg.inboundWebhookId) {
      await prisma.projectSetting.upsert({
        where: { projectId_key: { projectId, key: 'inboundWebhookId' } },
        create: { projectId, key: 'inboundWebhookId', value: cfg.inboundWebhookId },
        update: { value: cfg.inboundWebhookId },
      });
      await prisma.projectSetting.upsert({
        where: { projectId_key: { projectId, key: 'inboundWebhookSecret' } },
        create: { projectId, key: 'inboundWebhookSecret', value: cfg.inboundWebhookSecret || '' },
        update: { value: cfg.inboundWebhookSecret || '' },
      });
    }
  } catch (e) { /* desktop-only mode */ }
}

function registerIntegrationHubHandlers({ ipcMain, store }) {
  const apiBase = process.env.API_PUBLIC_URL || process.env.WEB_URL?.replace('3000', '4000') || 'http://localhost:4000';

  ipcMain.handle('get-partner-integration-config', () => {
    const cfg = loadConfig(store);
    const inboundUrl = cfg.inboundWebhookId
      ? `${apiBase}/api/v1/hooks/${cfg.inboundWebhookId}`
      : null;
    return {
      ...cfg,
      partnerApiKey: cfg.partnerApiKey ? `${cfg.partnerApiKey.slice(0, 12)}…${cfg.partnerApiKey.slice(-4)}` : '',
      partnerApiKeyFull: cfg.partnerApiKey || null,
      inboundWebhookUrl: inboundUrl,
      outboundEvents: OUTBOUND_EVENTS,
      partnerChannels: PARTNER_CHANNELS,
      apiBase,
    };
  });

  ipcMain.handle('save-partner-integration-config', (event, partial) => {
    const saved = saveConfig(store, partial || {});
    return { success: true, config: saved };
  });

  ipcMain.handle('generate-partner-api-key', async () => {
    const key = generateKey();
    const cfg = saveConfig(store, { partnerApiKey: key, createdAt: new Date().toISOString() });
    await syncPartnerToPrisma(store, cfg);
    appendEventLog(store, { type: 'api.key_generated', source: 'integrations' });
    return { success: true, partnerApiKey: key, config: cfg };
  });

  ipcMain.handle('regenerate-inbound-webhook', async () => {
    const webhookId = generateWebhookId();
    const secret = crypto.randomBytes(20).toString('hex');
    const cfg = saveConfig(store, { inboundWebhookId: webhookId, inboundWebhookSecret: secret });
    await syncPartnerToPrisma(store, cfg);
    const inboundUrl = `${apiBase}/api/v1/hooks/${webhookId}`;
    appendEventLog(store, { type: 'webhook.regenerated', source: 'integrations' });
    return { success: true, inboundWebhookId: webhookId, inboundWebhookSecret: secret, inboundWebhookUrl: inboundUrl };
  });

  ipcMain.handle('test-outbound-webhook', async (event, payload) => {
    const { url, event: eventType } = payload || {};
    if (!url?.trim()) return { success: false, error: 'Webhook URL required' };
    const body = {
      event: eventType || 'integration.test',
      source: 'social-imperialism',
      timestamp: new Date().toISOString(),
      data: { message: 'Test webhook from Integrations Hub', test: true },
    };
    try {
      const start = Date.now();
      const res = await axios.post(url.trim(), body, {
        timeout: 10000,
        headers: { 'Content-Type': 'application/json', 'X-SI-Event': body.event, 'User-Agent': 'SocialImperialism/1.0' },
        validateStatus: () => true,
      });
      const ok = res.status >= 200 && res.status < 300;
      appendEventLog(store, { type: 'webhook.outbound_test', url, status: res.status, ok });
      return { success: ok, status: res.status, ms: Date.now() - start, response: typeof res.data === 'string' ? res.data.slice(0, 200) : res.data };
    } catch (e) {
      appendEventLog(store, { type: 'webhook.outbound_test', url, error: e.message, ok: false });
      return { success: false, error: e.message };
    }
  });

  ipcMain.handle('receive-partner-webhook', (event, payload) => {
    const cfg = loadConfig(store);
    const entry = appendEventLog(store, {
      type: 'webhook.inbound',
      source: payload?.source || 'external',
      payload: payload,
    });
    let queue = [];
    try { queue = JSON.parse(store.getItem('partnerWebhookQueue') || '[]'); } catch (e) {}
    queue.unshift({ ...payload, receivedAt: new Date().toISOString(), eventId: entry.id });
    store.setItem('partnerWebhookQueue', JSON.stringify(queue.slice(0, 50)));
    return { success: true, eventId: entry.id, queued: true };
  });

  ipcMain.handle('get-integration-events-log', () => {
    try { return JSON.parse(store.getItem('integrationEventLog') || '[]'); } catch (e) { return []; }
  });

  ipcMain.handle('get-partner-api-catalog', () => {
    const cfg = loadConfig(store);
    const base = apiBase;
    return {
      version: '1.0',
      baseUrl: `${base}/api/v1`,
      authHeader: 'X-SI-API-Key',
      endpoints: [
        { method: 'GET', path: '/status', desc: 'Connection health and API metrics summary' },
        { method: 'GET', path: '/docs', desc: 'Machine-readable API catalog' },
        { method: 'POST', path: '/invoke/:channel', desc: 'Execute whitelisted IPC channel', body: '{ "args": [] }' },
        { method: 'POST', path: '/hooks/:webhookId', desc: 'Inbound webhook receiver (no API key)', body: '{ "event": "...", "data": {} }' },
      ],
      channels: PARTNER_CHANNELS.map((ch) => ({ channel: ch, method: 'POST', path: `/invoke/${ch}` })),
      outboundEvents: OUTBOUND_EVENTS,
      configured: !!cfg.partnerApiKey,
      inboundUrl: cfg.inboundWebhookId ? `${base}/api/v1/hooks/${cfg.inboundWebhookId}` : null,
    };
  });

  ipcMain.handle('dispatch-outbound-webhook', async (event, payload) => {
    const { eventType, data } = payload || {};
    const cfg = loadConfig(store);
    const hooks = cfg.outboundWebhooks || [];
    const subscribed = cfg.subscribedEvents || [];
    if (!subscribed.includes(eventType)) return { success: true, skipped: true, reason: 'Event not subscribed' };
    const results = [];
    for (const hook of hooks) {
      if (!hook.url?.trim() || hook.enabled === false) continue;
      if (hook.events?.length && !hook.events.includes(eventType)) continue;
      try {
        const res = await axios.post(hook.url, {
          event: eventType, source: 'social-imperialism', timestamp: new Date().toISOString(), data: data || {},
        }, { timeout: 8000, headers: { 'X-SI-Event': eventType }, validateStatus: () => true });
        results.push({ url: hook.url, status: res.status, ok: res.status >= 200 && res.status < 300 });
      } catch (e) {
        results.push({ url: hook.url, error: e.message, ok: false });
      }
    }
    appendEventLog(store, { type: 'webhook.outbound_dispatch', eventType, results });
    return { success: true, dispatched: results.length, results };
  });

  ipcMain.handle('verify-partner-api-key', (event, key) => {
    const cfg = loadConfig(store);
    const valid = !!key && key === cfg.partnerApiKey;
    if (valid) {
      saveConfig(store, { lastUsedAt: new Date().toISOString(), usageCount: (cfg.usageCount || 0) + 1 });
    }
    return { valid, projectScoped: true };
  });

  ipcMain.handle('resolve-inbound-webhook', (event, webhookId) => {
    const cfg = loadConfig(store);
    if (!webhookId || webhookId !== cfg.inboundWebhookId) return { found: false };
    return { found: true, hasSecret: !!cfg.inboundWebhookSecret };
  });

  console.log('[integrationHubIpc] Registered partner API + webhook handlers');
}

module.exports = { registerIntegrationHubHandlers, PARTNER_CHANNELS, OUTBOUND_EVENTS };