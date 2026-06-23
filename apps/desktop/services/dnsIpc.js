/**
 * IPC handlers for DNS site registry and record management.
 */
const dnsService = require('./dnsService');

function registerDnsHandlers({ ipcMain, store }) {
  ipcMain.handle('get-dns-sites', async () => {
    return dnsService.listSites(store);
  });

  ipcMain.handle('sync-dns-sites', async () => {
    const ctx = store._invokeContext || {};
    const isAdmin = dnsService.isPlatformAdmin(ctx.email);
    const sites = await dnsService.syncAllSites(store, { includeAdmin: isAdmin });
    return { success: true, sites, count: sites.length };
  });

  ipcMain.handle('add-dns-site', async (event, payload) => {
    const domain = dnsService.normalizeDomain(payload?.domain);
    if (!domain) return { success: false, error: 'Domain is required' };
    const ctx = store._invokeContext || {};
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

  ipcMain.handle('get-dns-records', async (event, siteId) => {
    const { sites } = await dnsService.listSites(store);
    const site = sites.find((s) => s.id === siteId);
    if (!site) return { error: 'Site not found' };
    const records = dnsService.getRecords(store, siteId);
    return { site, records };
  });

  ipcMain.handle('save-dns-record', async (event, { siteId, record } = {}) => {
    if (!siteId) return { success: false, error: 'siteId required' };
    try {
      const saved = dnsService.saveRecord(store, siteId, record || {});
      return { success: true, record: saved };
    } catch (e) {
      return { success: false, error: e.message };
    }
  });

  ipcMain.handle('delete-dns-record', async (event, { siteId, recordId } = {}) => {
    if (!siteId || !recordId) return { success: false, error: 'siteId and recordId required' };
    return dnsService.deleteRecord(store, siteId, recordId);
  });

  ipcMain.handle('verify-dns-record', async (event, { siteId, recordId } = {}) => {
    const { sites } = await dnsService.listSites(store);
    const site = sites.find((s) => s.id === siteId);
    if (!site) return { success: false, error: 'Site not found' };
    const records = dnsService.getRecords(store, siteId);
    const record = records.find((r) => r.id === recordId);
    if (!record) return { success: false, error: 'Record not found' };
    const result = await dnsService.verifyRecord(site, record);
    return { success: true, ...result };
  });

  ipcMain.handle('apply-dns-records', async (event, siteId) => {
    try {
      const result = await dnsService.applyRecordsToRoute53(store, siteId);
      return result;
    } catch (e) {
      return { success: false, error: e.message };
    }
  });

  ipcMain.handle('export-dns-records', async (event, siteId) => {
    const { sites } = await dnsService.listSites(store);
    const site = sites.find((s) => s.id === siteId);
    if (!site) return { error: 'Site not found' };
    const records = dnsService.getRecords(store, siteId);
    return dnsService.exportRecords(site, records);
  });

  ipcMain.handle('get-dns-config', () => ({
    recordTypes: dnsService.RECORD_TYPES,
    route53Configured: !!(process.env.AWS_S3_ACCESS_KEY_ID || process.env.AWS_ACCESS_KEY_ID),
    defaultHostedZone: process.env.ROUTE53_HOSTED_ZONE_ID || null,
    cloudfrontDomain: process.env.DEFAULT_CLOUDFRONT_DOMAIN || 'd1azg31w2pn0x4.cloudfront.net',
  }));
}

module.exports = { registerDnsHandlers };