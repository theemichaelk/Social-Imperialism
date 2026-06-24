/**
 * IPC handlers for email sending, campaigns, and auto-reply triggers.
 */
const {
  resolveKeys,
} = require('./keys');
const emailService = require('./emailService');

function getBrandCampaign(store) {
  const activeId = store.getItem('activeCampaignId') || 'default';
  try {
    return JSON.parse(store.getItem('campaigns') || '[]').find((c) => c.id === activeId) || {};
  } catch (e) {
    return {};
  }
}

function registerEmailCampaignHandlers({ ipcMain, store }) {
  ipcMain.handle('test-email-connections', async () => {
    const keys = resolveKeys(JSON.parse(store.getItem('globalApiKeys') || '{}'));
    const result = await emailService.testAllConnections(keys);
    return {
      success: result.success,
      ...result,
      apiMetrics: {
        VBout: result.vbout?.ok ? 'Connected' : 'Not configured',
        MailChimp: result.mailchimp?.ok ? 'Connected' : 'Not configured',
        'Amazon SES': result.ses?.ok ? 'Connected' : 'Not configured',
        Acumbamail: result.acumbamail?.ok ? 'Connected' : 'Not configured',
      },
    };
  });

  ipcMain.handle('send-email', async (event, payload) => {
    const keys = resolveKeys(JSON.parse(store.getItem('globalApiKeys') || '{}'));
    const state = emailService.loadEmailCampaigns(store);
    return emailService.sendEmail(keys, {
      ...payload,
      providerPriority: payload?.providerPriority || state.settings?.providerPriority,
    });
  });

  ipcMain.handle('get-email-campaigns', () => {
    const brand = getBrandCampaign(store);
    return emailService.ensureEmailCampaigns(store, brand);
  });

  ipcMain.handle('save-email-campaigns', (event, data) => {
    const existing = emailService.loadEmailCampaigns(store);
    const merged = {
      ...existing,
      ...data,
      settings: { ...existing.settings, ...data?.settings },
      campaigns: data?.campaigns || existing.campaigns,
      updatedAt: new Date().toISOString(),
    };
    store.setItem('emailCampaigns', JSON.stringify(merged));
    return { success: true, ...merged };
  });

  ipcMain.handle('run-email-auto-reply', async (event, payload) => {
    const keys = resolveKeys(JSON.parse(store.getItem('globalApiKeys') || '{}'));
    return emailService.runEmailAutoReply(store, keys, payload || {});
  });

  ipcMain.handle('send-email-campaign', async (event, { campaignId, to, overrides } = {}) => {
    const keys = resolveKeys(JSON.parse(store.getItem('globalApiKeys') || '{}'));
    const state = emailService.ensureEmailCampaigns(store, getBrandCampaign(store));
    const camp = (state.campaigns || []).find((c) => c.id === campaignId);
    if (!camp) return { success: false, error: 'Campaign not found' };

    const recipient = to || state.settings?.alertEmail || keys.alertEmail;
    if (!recipient) return { success: false, error: 'No recipient email' };

    const brand = getBrandCampaign(store);
    const vars = {
      brandName: brand.brandName || brand.name || 'Your Brand',
      domain: brand.domain || 'yourbrand.com',
      brandUrl: brand.domain ? `https://${brand.domain}` : 'https://socialimperialism.com',
      dashboardUrl: 'https://www.socialimperialism.com/history',
      ...(overrides?.vars || {}),
    };

    return emailService.sendEmail(keys, {
      to: recipient,
      subject: emailService.renderTemplate(overrides?.subject || camp.subject, vars),
      html: emailService.renderTemplate(overrides?.html || camp.html, vars),
      provider: camp.provider === 'auto' ? undefined : camp.provider,
      shortenLinks: camp.shortenLinks !== false,
      providerPriority: state.settings?.providerPriority,
    });
  });
}

module.exports = { registerEmailCampaignHandlers };