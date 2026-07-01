/**
 * Registers IPC handlers present in SaaS but missing from desktop index.js.
 */
const path = require('path');

function safeHandle(ipcMain, channel, fn, existing = {}) {
  if (existing[channel]) return;
  try { ipcMain.removeHandler(channel); } catch { /* ignore */ }
  ipcMain.handle(channel, fn);
}

/** Channels registered here (for static IPC audits): run-live-connection-audit, get-intelligence-settings, save-intelligence-settings, get-site-traffic-health */

function registerParityHandlers(deps) {
  const { ipcMain, store, resolveKeys, integrations, buildApiMetrics, desktopIpcHandlers = {} } = deps;

  const { registerBrandGuidelinesHandlers } = require('./services/brandGuidelinesIpc');
  registerBrandGuidelinesHandlers({ ipcMain, store });

  const { runLiveConnectionAudit } = require('./services/connectionProbeService');
  const liveAuditFn = async () => {
    const keys = resolveKeys(JSON.parse(store.getItem('globalApiKeys') || '{}'));
    return runLiveConnectionAudit(desktopIpcHandlers, buildApiMetrics, keys);
  };
  if (!desktopIpcHandlers['run-live-connection-audit']) {
    ipcMain.handle('run-live-connection-audit', liveAuditFn);
  }
  if (!desktopIpcHandlers['test-all-connections']) {
    desktopIpcHandlers['test-all-connections'] = liveAuditFn;
    ipcMain.handle('test-all-connections', liveAuditFn);
  }

  const defaultIntelligenceSettings = () => ({
    enabled: true,
    surfaces: ['account-hub', 'dashboard', 'calendar', 'content-hub', 'browse-posts', 'rules', 'account-creator'],
    autoSuggestScheduling: true,
    autoSuggestNiches: true,
    autoSuggestCommunities: true,
  });

  if (!desktopIpcHandlers['get-intelligence-settings']) {
    ipcMain.handle('get-intelligence-settings', () => {
      try {
        const raw = JSON.parse(store.getItem('intelligenceSettings') || 'null');
        return { ...defaultIntelligenceSettings(), ...(raw || {}) };
      } catch {
        return defaultIntelligenceSettings();
      }
    });
  }

  if (!desktopIpcHandlers['save-intelligence-settings']) {
    ipcMain.handle('save-intelligence-settings', (event, payload) => {
      const next = { ...defaultIntelligenceSettings(), ...(payload || {}) };
      store.setItem('intelligenceSettings', JSON.stringify(next));
      return { success: true, settings: next };
    });
  }

  const axios = require('axios');
  if (!desktopIpcHandlers['get-site-traffic-health']) {
    ipcMain.handle('get-site-traffic-health', async (event, payload) => {
    const { domains = [], keyword = '' } = payload || {};
    const keys = resolveKeys(JSON.parse(store.getItem('globalApiKeys') || '{}'));
    const domKey = keys.domDetailer;
    const serpKey = keys.serpApiKey;
    const siteList = (Array.isArray(domains) ? domains : [domains]).filter(Boolean).slice(0, 8);

    const sites = await Promise.all(siteList.map(async (domain) => {
      const clean = String(domain).replace(/^https?:\/\//, '').split('/')[0].trim();
      if (!clean) return { domain, error: 'Invalid domain' };
      if (!domKey) return { domain: clean, error: 'DomDetailer key not configured', health: 'unknown' };
      try {
        const url = `http://domdetailer.com/api/checkDomain.php?domain=${encodeURIComponent(clean)}&app=SocialImperialism&apikey=${encodeURIComponent(domKey)}`;
        const res = await axios.get(url, { timeout: 12000 });
        const data = res.data || {};
        if (data.error || data.error_message) {
          return { domain: clean, error: data.error || data.error_message, health: 'error' };
        }
        const da = data.mozDA ?? data.da ?? 0;
        const tf = data.majesticTF ?? data.trustFlow ?? 0;
        const health = da >= 30 && tf >= 15 ? 'strong' : da >= 15 ? 'moderate' : 'building';
        return {
          domain: clean, success: true, da, pa: data.mozPA ?? data.pa ?? 0, tf, cf: data.majesticCF ?? data.citationFlow ?? 0,
          health, backlinks: data.backlinks ?? data.majesticLinks ?? null, indexed: data.indexed ?? null, raw: data,
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

    return { success: true, keyword: kw, sites, keywordResearch, serp: serpResults, timestamp: new Date().toISOString() };
    });
  }

  console.log('[desktop] Parity handlers registered (brand, live audit, intelligence, traffic health)');
}

module.exports = { registerParityHandlers };