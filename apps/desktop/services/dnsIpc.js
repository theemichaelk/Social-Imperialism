/**
 * IPC handlers for DNS site registry and record management.
 */
const dnsService = require('./dnsService');

function getCtx(store) {
  return store._invokeContext || {};
}

function registerDnsHandlers({ ipcMain, store }) {
  ipcMain.handle('get-dns-sites', async () => {
    return dnsService.listSites(store);
  });

  ipcMain.handle('sync-dns-sites', async () => {
    const ctx = getCtx(store);
    const isAdmin = dnsService.isPlatformAdmin(ctx.email);
    const sites = await dnsService.syncAllSites(store, { includeAdmin: isAdmin });
    return { success: true, sites, count: sites.length };
  });

  ipcMain.handle('add-dns-site', async (event, payload) => {
    const domain = dnsService.normalizeDomain(payload?.domain);
    if (!domain) return { success: false, error: 'Domain is required' };
    const ctx = getCtx(store);
    const isAdmin = dnsService.isPlatformAdmin(ctx.email);
    const site = dnsService.upsertSite(store, {
      domain,
      name: payload?.name || domain,
      source: payload?.source || 'manual',
      projectId: payload?.projectId || store.projectId || null,
      organizationId: store.organizationId || null,
      scope: payload?.scope || (isAdmin ? 'admin' : 'client'),
      hostedZoneId: payload?.hostedZoneId || null,
    });
    return { success: true, site };
  });

  ipcMain.handle('update-dns-site', async (event, payload = {}) => {
    const { siteId, name, domain, hostedZoneId, status } = payload;
    if (!siteId) return { success: false, error: 'siteId required' };
    try {
      const site = dnsService.updateSite(store, siteId, { name, domain, hostedZoneId, status }, getCtx(store));
      return { success: true, site };
    } catch (e) {
      return { success: false, error: e.message };
    }
  });

  ipcMain.handle('delete-dns-site', async (event, payload = {}) => {
    const siteId = payload?.siteId || payload;
    if (!siteId) return { success: false, error: 'siteId required' };
    try {
      return dnsService.deleteSite(store, siteId, getCtx(store));
    } catch (e) {
      return { success: false, error: e.message };
    }
  });

  ipcMain.handle('get-dns-records', async (event, siteId) => {
    try {
      const site = dnsService.assertSiteAccess(store, siteId, getCtx(store));
      const records = dnsService.getRecords(store, siteId, getCtx(store));
      return { site, records };
    } catch (e) {
      return { error: e.message };
    }
  });

  ipcMain.handle('save-dns-record', async (event, { siteId, record } = {}) => {
    if (!siteId) return { success: false, error: 'siteId required' };
    try {
      const saved = dnsService.saveRecord(store, siteId, record || {}, getCtx(store));
      return { success: true, record: saved };
    } catch (e) {
      return { success: false, error: e.message };
    }
  });

  ipcMain.handle('delete-dns-record', async (event, { siteId, recordId } = {}) => {
    if (!siteId || !recordId) return { success: false, error: 'siteId and recordId required' };
    try {
      return dnsService.deleteRecord(store, siteId, recordId, getCtx(store));
    } catch (e) {
      return { success: false, error: e.message };
    }
  });

  ipcMain.handle('verify-dns-record', async (event, { siteId, recordId } = {}) => {
    try {
      const site = dnsService.assertSiteAccess(store, siteId, getCtx(store));
      const records = dnsService.getRecords(store, siteId, getCtx(store));
      const record = records.find((r) => r.id === recordId);
      if (!record) return { success: false, error: 'Record not found' };
      const result = await dnsService.verifyRecord(site, record);
      return { success: true, ...result };
    } catch (e) {
      return { success: false, error: e.message };
    }
  });

  ipcMain.handle('apply-dns-records', async (event, siteId) => {
    try {
      const result = await dnsService.applyRecordsToRoute53(store, siteId, getCtx(store));
      return result;
    } catch (e) {
      return { success: false, error: e.message };
    }
  });

  ipcMain.handle('export-dns-records', async (event, siteId) => {
    try {
      const site = dnsService.assertSiteAccess(store, siteId, getCtx(store));
      const records = dnsService.getRecords(store, siteId, getCtx(store));
      return dnsService.exportRecords(site, records);
    } catch (e) {
      return { error: e.message };
    }
  });

  ipcMain.handle('get-dns-config', () => ({
    recordTypes: dnsService.RECORD_TYPES,
    route53Configured: !!(process.env.AWS_S3_ACCESS_KEY_ID || process.env.AWS_ACCESS_KEY_ID),
    defaultHostedZone: process.env.ROUTE53_HOSTED_ZONE_ID || null,
    cloudfrontDomain: process.env.DEFAULT_CLOUDFRONT_DOMAIN || 'd1azg31w2pn0x4.cloudfront.net',
  }));
}

module.exports = { registerDnsHandlers };