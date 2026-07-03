/**
 * THEE_MICHAEL Brand Research Orchestrator
 * Pulls live web + SEO intelligence → fills Setup Wizard → propagates to all modules
 */
const { invoke } = require('@si/core');
const { buildIntelligenceBrief, resolveProjectKeys } = require('../seo/seoIntelligenceEngine');
const { appendLearning } = require('@si/core/src/selfHealJournal');
const { createPrismaStore } = require('@si/core');

function normalizeDomain(raw) {
  return String(raw || '').trim().replace(/^https?:\/\//i, '').replace(/\/$/, '').split('/')[0];
}

function buildTargetUrl(domain) {
  const d = normalizeDomain(domain);
  return d ? `https://${d}` : 'https://www.socialimperialism.com';
}

async function ensureActiveCampaign(store, projectId, brand = {}) {
  const campaigns = JSON.parse(store.getItem('campaigns') || '[]');
  let id = store.getItem('activeCampaignId') || projectId;
  let idx = campaigns.findIndex((c) => c.id === id);
  if (idx < 0) {
    const entry = {
      id: projectId,
      brandName: brand.brandName || '',
      domain: normalizeDomain(brand.domain),
      description: brand.description || '',
      tone: brand.tone || 'Professional',
      audience: brand.audience || '',
      status: 'Active',
    };
    campaigns.unshift(entry);
    store.setItem('campaigns', JSON.stringify(campaigns));
    store.setItem('activeCampaignId', projectId);
    return entry;
  }
  campaigns[idx] = {
    ...campaigns[idx],
    brandName: brand.brandName || campaigns[idx].brandName,
    domain: normalizeDomain(brand.domain) || campaigns[idx].domain,
    tone: brand.tone || campaigns[idx].tone,
    audience: brand.audience || campaigns[idx].audience,
  };
  store.setItem('campaigns', JSON.stringify(campaigns));
  await store.flush();
  return campaigns[idx];
}

function parseAudienceFromSummary(text) {
  const m = String(text || '').match(/(?:audience|target(?:ing)?|for)\s*[:\-]?\s*([^.!\n]{10,120})/i);
  return m ? m[1].trim() : '';
}

function buildModuleFlow(brand, keywords, seoBrief) {
  return [
    { module: 'Brand', href: '/brand', data: 'Voice, tone, guidelines', status: brand?.brandName ? 'ready' : 'pending' },
    { module: 'Keywords', href: '/keywords', data: `${keywords.length} terms`, status: keywords.length ? 'ready' : 'pending' },
    { module: 'SEO Tools', href: '/seo-tools', data: seoBrief?.keyword || 'SERP research', status: seoBrief?.liveData ? 'live' : 'framework' },
    { module: 'AI Replies', href: '/history', data: 'Global custom prompt', status: 'wired' },
    { module: 'Content Hub', href: '/content-hub', data: 'Brand-aware drafts', status: 'wired' },
    { module: 'Campaign Command', href: '/campaign-manager', data: brand?.domain || 'target URL', status: brand?.domain ? 'ready' : 'pending' },
    { module: 'Integrations', href: '/integrations', data: 'OAuth + API keys', status: 'connect' },
    { module: 'Imperialism Brain', href: '/support', data: 'Live THEE_MICHAEL guidance', status: 'active' },
  ];
}

async function researchBrandFromDomain(projectId, organizationId, input = {}) {
  const domain = normalizeDomain(input.domain);
  if (!domain) throw new Error('Domain is required for brand research');

  const store = await createPrismaStore({ projectId, organizationId });
  const keys = await resolveProjectKeys(projectId, organizationId);
  const targetUrl = buildTargetUrl(domain);

  await ensureActiveCampaign(store, projectId, {
    brandName: input.brandName,
    domain,
    tone: input.tone,
  });

  const steps = [];
  let seedResult = null;
  let keywordTerms = [];
  let seoBrief = null;
  let globalPrompt = null;
  let verifiedCampaign = null;

  try {
    seedResult = await invoke({
      projectId,
      organizationId,
      channel: 'seed-brand-from-website',
      args: [{ url: domain }],
    });
    steps.push({ step: 'seed-brand-from-website', ok: !!seedResult?.success, title: seedResult?.title });
  } catch (e) {
    steps.push({ step: 'seed-brand-from-website', ok: false, error: e.message });
  }

  const campaign = seedResult?.campaign || (await invoke({
    projectId,
    organizationId,
    channel: 'get-active-campaign',
    args: [],
  }));

  const brand = {
    brandName: campaign?.brandName || input.brandName || seedResult?.title || domain,
    domain: campaign?.domain || domain,
    description: campaign?.description || '',
    tone: campaign?.tone || input.tone || 'Professional',
    audience: campaign?.audience || parseAudienceFromSummary(campaign?.description) || '',
    disallowedTopics: campaign?.disallowedTopics || '',
    sampleMessages: campaign?.sampleMessages || '',
    affiliateLinks: campaign?.affiliateLinks || '',
  };

  try {
    seoBrief = await buildIntelligenceBrief(`${brand.brandName} ${domain} brand SEO`, {
      keys,
      invoke,
      projectId,
      organizationId,
    });
    steps.push({ step: 'seo-intelligence', ok: true, intents: seoBrief.intents });
  } catch (e) {
    steps.push({ step: 'seo-intelligence', ok: false, error: e.message });
  }

  try {
    const kw = await invoke({
      projectId,
      organizationId,
      channel: 'generate-keywords',
      args: [brand],
    });
    keywordTerms = Array.isArray(kw) ? kw : (kw?.keywords || []);
    steps.push({ step: 'generate-keywords', ok: keywordTerms.length > 0, count: keywordTerms.length });
  } catch (e) {
    steps.push({ step: 'generate-keywords', ok: false, error: e.message });
  }

  if (seoBrief?.recommendations?.length) {
    const seoKw = seoBrief.recommendations
      .filter((r) => r.framework === 'Research' || r.category === 'SEO')
      .flatMap(() => keywordTerms);
    keywordTerms = [...new Set([...keywordTerms, ...seoKw])].slice(0, 12);
  }

  try {
    const promptRes = await invoke({
      projectId,
      organizationId,
      channel: 'generate-global-custom-prompt',
      args: [],
    });
    globalPrompt = promptRes?.prompt || promptRes || '';
    steps.push({ step: 'generate-global-custom-prompt', ok: !!globalPrompt });
  } catch (e) {
    steps.push({ step: 'generate-global-custom-prompt', ok: false, error: e.message });
  }

  try {
    const existing = await invoke({
      projectId,
      organizationId,
      channel: 'list-verified-campaigns',
      args: [{}],
    });
    const campaigns = existing?.campaigns || [];
    const match = campaigns.find((c) => (c.targetUrl || '').includes(domain));
    if (match) {
      verifiedCampaign = match;
    } else {
      const created = await invoke({
        projectId,
        organizationId,
        channel: 'create-verified-campaign',
        args: [{
          name: brand.brandName,
          targetUrl,
          projectId,
        }],
      });
      verifiedCampaign = created?.campaign || null;
    }
    steps.push({ step: 'verified-campaign', ok: !!verifiedCampaign });
  } catch (e) {
    steps.push({ step: 'verified-campaign', ok: false, error: e.message });
  }

  const platforms = ['Twitter', 'LinkedIn', 'Reddit', 'Facebook'];
  const keywords = keywordTerms.map((term) => ({ term, platforms }));

  const monitors = keywordTerms.slice(0, 3).map((term, i) => ({
    id: `mon_research_${Date.now()}_${i}`,
    term,
    platform: 'All',
    type: 'keyword',
    target: term,
    added: new Date().toISOString(),
  }));

  try {
    await appendLearning(store, {
      topic: 'brand-research',
      insight: `Researched ${domain} — ${keywordTerms.length} keywords, SEO intents: ${(seoBrief?.intents || []).join(', ')}`,
      source: 'onboarding',
    });
    await store.flush();
  } catch { /* optional */ }

  const recommendations = [
    { step: 2, action: 'Connect APIs in Integrations — SerpAPI unlocks live SEO pulse', href: '/integrations?tab=connections' },
    { step: 3, action: `Save ${keywords.length} researched keywords to Keywords monitor`, href: '/keywords' },
    { step: 4, action: 'Run feed preview to validate discovery', href: '/onboarding' },
    { step: 5, action: 'Review global AI reply prompt in AI Replies', href: '/history' },
    { action: 'Open Campaign Command with your brand target URL', href: '/campaign-manager?tab=nodes' },
  ];

  return {
    success: true,
    brand,
    keywords,
    suggestedKeywords: keywordTerms,
    platforms,
    globalPrompt: String(globalPrompt || ''),
    monitors,
    seoBrief: seoBrief ? {
      intents: seoBrief.intents,
      keyword: seoBrief.keyword,
      recommendations: seoBrief.recommendations,
      liveData: seoBrief.liveData,
      pulse: seoBrief.pulse,
    } : null,
    verifiedCampaign,
    moduleFlow: buildModuleFlow(brand, keywords, seoBrief),
    steps,
    recommendations,
    targetUrl,
    researchedAt: new Date().toISOString(),
  };
}

async function propagateBrandToModules(projectId, organizationId, brand = {}) {
  const domain = normalizeDomain(brand.domain);
  const targetUrl = buildTargetUrl(domain);
  const results = [];

  try {
    const camps = await invoke({
      projectId,
      organizationId,
      channel: 'get-settings',
      args: [],
    });
    const id = projectId;
    const entry = {
      id,
      ...brand,
      domain,
      status: 'Active',
    };
    const list = Array.isArray(camps) ? camps.filter((c) => c.id !== id) : [];
    await invoke({
      projectId,
      organizationId,
      channel: 'save-settings',
      args: [[entry, ...list]],
    });
    await invoke({ projectId, organizationId, channel: 'set-active-campaign', args: [id] });
    results.push({ module: 'campaigns', ok: true });
  } catch (e) {
    results.push({ module: 'campaigns', ok: false, error: e.message });
  }

  try {
    const existing = await invoke({
      projectId,
      organizationId,
      channel: 'list-verified-campaigns',
      args: [{}],
    });
    const has = (existing?.campaigns || []).some((c) => (c.targetUrl || '').includes(domain));
    if (!has && domain) {
      await invoke({
        projectId,
        organizationId,
        channel: 'create-verified-campaign',
        args: [{ name: brand.brandName || domain, targetUrl, projectId }],
      });
    }
    results.push({ module: 'campaign-manager', ok: true, targetUrl });
  } catch (e) {
    results.push({ module: 'campaign-manager', ok: false, error: e.message });
  }

  return { success: true, results, targetUrl };
}

module.exports = {
  researchBrandFromDomain,
  propagateBrandToModules,
  normalizeDomain,
  buildTargetUrl,
  buildModuleFlow,
};