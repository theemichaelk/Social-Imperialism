/**
 * Brand guidelines IPC — desktop parity with brand.html and web /brand.
 */
function registerBrandGuidelinesHandlers({ ipcMain, store }) {
  function syncBrandGuidelinesStore(activeId, campaign) {
    const payload = {
      brandName: campaign.brandName || '',
      domain: campaign.domain || '',
      voice: campaign.description || campaign.tone || '',
      description: campaign.description || '',
      tone: campaign.tone || '',
      audience: campaign.audience || '',
      doList: campaign.brandGuidelines?.doList || '',
      dontList: campaign.brandGuidelines?.dontList || '',
      sampleMessages: campaign.sampleMessages || '',
      disallowedTopics: campaign.disallowedTopics || '',
      affiliateLinks: campaign.affiliateLinks || '',
      updatedAt: new Date().toISOString(),
    };
    store.setItem(`brandGuidelines_${activeId}`, JSON.stringify(payload));
  }

  function toGuidelinesView(campaign, legacy = {}) {
    const g = campaign.brandGuidelines || {};
    const rulesFromDo = (g.doList || '').split('\n').map((s) => s.trim()).filter(Boolean);
    const rules = rulesFromDo.length ? rulesFromDo : (legacy.rules || legacy.contentRules || []);
    const samples = (campaign.sampleMessages || g.sampleMessages || '')
      .split(/\n---\n|\n\n/)
      .map((s) => s.trim())
      .filter(Boolean);
    const forbidden = (campaign.disallowedTopics || g.dontList || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    return {
      voice: legacy.voice || campaign.tone || campaign.description || '',
      brandVoice: legacy.brandVoice || campaign.tone || '',
      rules,
      contentRules: rules,
      samples: samples.length ? samples : (legacy.samples || []),
      samplePosts: samples,
      forbiddenWords: forbidden.length ? forbidden : (legacy.forbiddenWords || []),
      doList: g.doList || '',
      dontList: g.dontList || '',
    };
  }

  ipcMain.handle('get-brand-guidelines', () => {
    const activeId = store.getItem('activeCampaignId') || 'default';
    let legacy = {};
    try { legacy = JSON.parse(store.getItem(`brandGuidelines_${activeId}`) || '{}'); } catch { /* ignore */ }
    const campaigns = JSON.parse(store.getItem('campaigns') || '[]');
    const campaign = campaigns.find((c) => c.id === activeId) || {};
    const guidelines = toGuidelinesView(campaign, legacy);
    return {
      success: true,
      guidelines,
      brandName: campaign.brandName || '',
      domain: campaign.domain || '',
      description: campaign.description || '',
      tone: campaign.tone || '',
      audience: campaign.audience || '',
      disallowedTopics: campaign.disallowedTopics || '',
      sampleMessages: campaign.sampleMessages || '',
      affiliateLinks: campaign.affiliateLinks || '',
      brandGuidelines: campaign.brandGuidelines || {},
    };
  });

  ipcMain.handle('save-brand-guidelines', (event, payload) => {
    const activeId = store.getItem('activeCampaignId') || 'default';
    const campaigns = JSON.parse(store.getItem('campaigns') || '[]');
    const idx = campaigns.findIndex((c) => c.id === activeId);
    if (idx < 0) return { success: false, error: 'No active campaign' };

    const rules = payload?.rules || payload?.contentRules;
    const samples = payload?.samples || payload?.samplePosts;
    const doList = Array.isArray(rules)
      ? rules.join('\n')
      : (payload?.brandGuidelines?.doList || payload?.doList || campaigns[idx].brandGuidelines?.doList || '');
    const dontList = Array.isArray(payload?.forbiddenWords)
      ? payload.forbiddenWords.join(', ')
      : (payload?.brandGuidelines?.dontList || payload?.dontList || '');
    const sampleMessages = Array.isArray(samples)
      ? samples.join('\n---\n')
      : (payload?.sampleMessages || campaigns[idx].sampleMessages || '');
    const disallowedTopics = Array.isArray(payload?.forbiddenWords)
      ? payload.forbiddenWords.join(', ')
      : (payload?.disallowedTopics || campaigns[idx].disallowedTopics || dontList);

    campaigns[idx] = {
      ...campaigns[idx],
      brandName: payload?.brandName ?? campaigns[idx].brandName,
      domain: payload?.domain ?? campaigns[idx].domain,
      description: payload?.description ?? payload?.voice ?? campaigns[idx].description,
      tone: payload?.tone ?? payload?.voice ?? campaigns[idx].tone,
      audience: payload?.audience ?? campaigns[idx].audience,
      brandGuidelines: {
        ...(campaigns[idx].brandGuidelines || {}),
        ...(payload?.brandGuidelines || {}),
        doList,
        dontList: dontList || campaigns[idx].brandGuidelines?.dontList || '',
      },
      disallowedTopics,
      sampleMessages,
      affiliateLinks: payload?.affiliateLinks ?? campaigns[idx].affiliateLinks,
    };
    store.setItem('campaigns', JSON.stringify(campaigns));
    syncBrandGuidelinesStore(activeId, campaigns[idx]);
    return { success: true, campaign: campaigns[idx] };
  });
}

module.exports = { registerBrandGuidelinesHandlers };