/**
 * THEE_MICHAEL Brand Research Orchestrator
 * Pulls live web + SEO intelligence → fills Setup Wizard → propagates to all modules
 */
const { invoke } = require('@si/core');
const { buildIntelligenceBrief, resolveProjectKeys } = require('../seo/seoIntelligenceEngine');
const { appendLearning } = require('@si/core/src/selfHealJournal');
const { createPrismaStore } = require('@si/core');

/** Canonical sidebar modules — ids align with apps/web/src/lib/nav.ts */
const CANONICAL_MODULES = [
  { section: 'Mission Control', module: 'Dashboard', href: '/dashboard', hint: 'Pulse & act now' },
  { section: 'Mission Control', module: 'Browse Posts', href: '/browse-posts', hint: 'Find conversations' },
  { section: 'Create & Publish', module: 'Setup Wizard', href: '/onboarding', hint: 'Go-live checklist' },
  { section: 'Create & Publish', module: 'Create', href: '/content-hub', hint: 'Draft & publish' },
  { section: 'Create & Publish', module: 'Library', href: '/content-library', hint: 'Reuse assets' },
  { section: 'Create & Publish', module: 'Design Studio', href: '/design-studio', hint: 'Visual posts' },
  { section: 'Create & Publish', module: 'Brand', href: '/brand', hint: 'Voice & rules' },
  { section: 'Create & Publish', module: 'Calendar', href: '/calendar', hint: 'Schedule runway' },
  { section: 'Create & Publish', module: 'Scheduler', href: '/scheduler', hint: 'Background runs' },
  { section: 'Discovery & Replies', module: 'Prompt Vault', href: '/prompt-vault', hint: 'Saved prompts' },
  { section: 'Discovery & Replies', module: 'Engagement', href: '/engagement', hint: 'Warm profiles' },
  { section: 'Discovery & Replies', module: 'AI Replies', href: '/history', hint: 'Approve drafts' },
  { section: 'Discovery & Replies', module: 'Keywords', href: '/keywords', hint: 'Monitor topics' },
  { section: 'Discovery & Replies', module: 'SEO Tools', href: '/seo-tools', hint: 'Research wins' },
  { section: 'Growth Labs', module: 'Growth Lab', href: '/reddit-ai', hint: 'Reddit modules' },
  { section: 'Growth Labs', module: 'Quora Ops', href: '/quora-traffic', hint: 'Answer & traffic' },
  { section: 'Automation', module: 'Automations', href: '/automations', hint: 'Visual flows' },
  { section: 'Automation', module: 'Auto-Rules', href: '/rules', hint: 'Keyword triggers' },
  { section: 'Accounts', module: 'Accounts', href: '/account-hub', hint: 'Connect & health' },
  { section: 'Accounts', module: 'Acct Creator', href: '/account-creator', hint: 'New profiles' },
  { section: 'System', module: 'Campaign Command', href: '/campaign-manager', hint: 'Verified nodes' },
  { section: 'System', module: 'Imperialism Brain', href: '/support', hint: 'Live support' },
  { section: 'System', module: 'Integrations', href: '/integrations', hint: 'APIs & OAuth' },
  { section: 'System', module: 'Settings', href: '/settings', hint: 'API keys & billing' },
];

function normalizeDomain(raw) {
  return String(raw || '').trim().replace(/^https?:\/\//i, '').replace(/\/$/, '').split('/')[0];
}

function buildTargetUrl(domain) {
  const d = normalizeDomain(domain);
  return d ? `https://${d}` : 'https://www.socialimperialism.com';
}

async function ensureActiveCampaign(store, projectId, brand = {}) {
  const campaigns = JSON.parse(store.getItem('campaigns') || '[]');
  const id = store.getItem('activeCampaignId') || projectId;
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
    description: brand.description || campaigns[idx].description,
  };
  store.setItem('campaigns', JSON.stringify(campaigns));
  await store.flush();
  return campaigns[idx];
}

function parseAudienceFromSummary(text) {
  const m = String(text || '').match(/(?:audience|target(?:ing)?|for)\s*[:\-]?\s*([^.!\n]{10,120})/i);
  return m ? m[1].trim() : '';
}

function resolveModuleData(module, ctx) {
  const { brand, keywords, seoBrief, globalPrompt, monitors, platforms, apiConnected } = ctx;
  const map = {
    Dashboard: { data: brand?.brandName ? `${brand.brandName} pulse` : 'Awaiting brand', status: brand?.brandName ? 'ready' : 'pending' },
    'Browse Posts': { data: keywords.length ? `${keywords.length} keyword feeds` : 'Discovery idle', status: keywords.length ? 'ready' : 'pending' },
    'Setup Wizard': { data: brand?.domain || 'Enter domain', status: brand?.domain ? 'ready' : 'pending' },
    Create: { data: brand?.tone ? `${brand.tone} voice` : 'Brand-aware drafts', status: brand?.brandName ? 'wired' : 'pending' },
    Library: { data: brand?.domain ? `Seeded from ${brand.domain}` : 'Import assets', status: brand?.domain ? 'wired' : 'pending' },
    'Design Studio': { data: brand?.brandName || 'Visual templates', status: brand?.brandName ? 'wired' : 'pending' },
    Brand: { data: brand?.brandName || 'Voice & rules', status: brand?.brandName ? 'ready' : 'pending' },
    Calendar: { data: 'Schedule runway', status: keywords.length ? 'wired' : 'pending' },
    Scheduler: { data: 'Background runs', status: 'wired' },
    'Prompt Vault': { data: keywords.length ? `${Math.min(keywords.length, 3)} templates` : 'Saved prompts', status: keywords.length ? 'ready' : 'pending' },
    Engagement: { data: 'Warm profiles', status: brand?.audience ? 'wired' : 'pending' },
    'AI Replies': { data: globalPrompt ? 'Global prompt set' : 'Approve drafts', status: globalPrompt ? 'ready' : 'wired' },
    Keywords: { data: `${keywords.length} terms`, status: keywords.length ? 'ready' : 'pending' },
    'SEO Tools': { data: seoBrief?.keyword || (seoBrief?.liveData ? 'Live SERP' : 'SERP research'), status: seoBrief?.liveData ? 'live' : (seoBrief ? 'framework' : 'pending') },
    'Growth Lab': { data: brand?.domain ? `Reddit · ${brand.domain}` : 'Reddit modules', status: brand?.domain ? 'wired' : 'pending' },
    'Quora Ops': { data: brand?.description ? 'Answer & traffic' : 'Quora idle', status: brand?.description ? 'wired' : 'pending' },
    Automations: { data: 'Visual flows', status: keywords.length ? 'wired' : 'pending' },
    'Auto-Rules': { data: monitors.length ? `${monitors.length} monitors` : 'Keyword triggers', status: monitors.length ? 'ready' : 'pending' },
    Accounts: { data: 'Connect & health', status: 'connect' },
    'Acct Creator': { data: 'New profiles', status: 'connect' },
    'Campaign Command': { data: brand?.domain || 'target URL', status: brand?.domain ? 'ready' : 'pending' },
    'Imperialism Brain': { data: 'Live support', status: 'active' },
    Integrations: { data: apiConnected >= 5 ? `${apiConnected} APIs live` : 'OAuth + API keys', status: apiConnected >= 5 ? 'ready' : 'connect' },
    Settings: { data: 'API keys & billing', status: 'wired' },
  };
  const entry = map[module] || { data: '—', status: 'pending' };
  return { ...entry, platforms: platforms?.length ? platforms.join(', ') : undefined };
}

function buildModuleFlow(brand, keywords, seoBrief, extras = {}) {
  const ctx = {
    brand,
    keywords: keywords || [],
    seoBrief,
    globalPrompt: extras.globalPrompt,
    monitors: extras.monitors || [],
    platforms: extras.platforms || [],
    apiConnected: extras.apiConnected || 0,
  };
  return CANONICAL_MODULES.map((m) => {
    const resolved = resolveModuleData(m.module, ctx);
    return {
      section: m.section,
      module: m.module,
      href: m.href,
      hint: m.hint,
      data: resolved.data,
      status: resolved.status,
    };
  });
}

async function persistResearchToModules(projectId, organizationId, payload = {}) {
  const {
    brand = {},
    keywords = [],
    monitors = [],
    globalPrompt = '',
    platforms = ['Twitter', 'LinkedIn', 'Reddit', 'Facebook'],
    persistKeywords = true,
    persistMonitors = true,
    persistPromptVault = true,
  } = payload;

  const domain = normalizeDomain(brand.domain);
  const targetUrl = buildTargetUrl(domain);
  const results = [];

  const saveResult = async (module, fn) => {
    try {
      const detail = await fn();
      results.push({ module, ok: true, ...detail });
    } catch (e) {
      results.push({ module, ok: false, error: e.message });
    }
  };

  await saveResult('Brand', async () => {
    const camps = await invoke({ projectId, organizationId, channel: 'get-settings', args: [] });
    const id = projectId;
    const entry = {
      id,
      ...brand,
      domain,
      status: 'Active',
      globalCustomPrompt: globalPrompt || brand.globalCustomPrompt || '',
    };
    const list = Array.isArray(camps) ? camps.filter((c) => c.id !== id) : [];
    await invoke({ projectId, organizationId, channel: 'save-settings', args: [[entry, ...list]] });
    await invoke({ projectId, organizationId, channel: 'set-active-campaign', args: [id] });
    await invoke({
      projectId,
      organizationId,
      channel: 'save-brand-guidelines',
      args: [{
        disallowedTopics: brand.disallowedTopics,
        sampleMessages: brand.sampleMessages,
        affiliateLinks: brand.affiliateLinks,
      }],
    });
    return { targetUrl };
  });

  if (persistKeywords && keywords.length) {
    await saveResult('Keywords', async () => {
      await invoke({
        projectId,
        organizationId,
        channel: 'save-keywords',
        args: [{
          merge: true,
          keywords: keywords.map((k) => ({
            term: k.term || k,
            platforms: k.platforms?.length ? k.platforms : platforms,
          })),
        }],
      });
      return { count: keywords.length };
    });
  }

  if (persistMonitors && monitors.length) {
    await saveResult('Auto-Rules', async () => {
      const existing = await invoke({ projectId, organizationId, channel: 'get-watched-monitors', args: [] });
      const current = Array.isArray(existing) ? existing : [];
      const terms = new Set(current.map((m) => String(m.term || '').toLowerCase()));
      const merged = [
        ...monitors.filter((m) => !terms.has(String(m.term || '').toLowerCase())),
        ...current,
      ].slice(0, 20);
      await invoke({ projectId, organizationId, channel: 'save-watched-monitors', args: [merged] });
      return { count: merged.length };
    });
  }

  if (globalPrompt) {
    await saveResult('AI Replies', async () => {
      const rules = await invoke({ projectId, organizationId, channel: 'get-auto-rules', args: [] }).catch(() => ({}));
      await invoke({
        projectId,
        organizationId,
        channel: 'save-auto-rules',
        args: [{
          ...(rules || {}),
          customRulePrompt: globalPrompt,
          realTimeMonitoringEnabled: true,
          beFirstDelay: true,
        }],
      });
      return {};
    });
  }

  if (persistPromptVault && (globalPrompt || keywords.length)) {
    await saveResult('Prompt Vault', async () => {
      const vaultCount = [];
      if (globalPrompt) {
        await invoke({
          projectId,
          organizationId,
          channel: 'save-prompt-vault-item',
          args: [{
            title: `${brand.brandName || domain} — Global Reply Voice`,
            body: globalPrompt,
            keywords: keywords.slice(0, 5).map((k) => k.term || k),
            tags: ['onboarding', 'brand-research', 'ai-replies'],
            feature: 'ai-replies',
          }],
        });
        vaultCount.push('global');
      }
      for (const kw of keywords.slice(0, 2)) {
        const term = kw.term || kw;
        if (!term) continue;
        await invoke({
          projectId,
          organizationId,
          channel: 'create-prompt-vault-from-keyword',
          args: [{ keyword: term, feature: 'discovery' }],
        }).catch(() => null);
        vaultCount.push(term);
      }
      return { templates: vaultCount.length };
    });
  }

  await saveResult('Campaign Command', async () => {
    const existing = await invoke({ projectId, organizationId, channel: 'list-verified-campaigns', args: [{}] });
    const has = (existing?.campaigns || []).some((c) => (c.targetUrl || '').includes(domain));
    if (!has && domain) {
      await invoke({
        projectId,
        organizationId,
        channel: 'create-verified-campaign',
        args: [{ name: brand.brandName || domain, targetUrl, projectId }],
      });
    }
    return { targetUrl };
  });

  return { success: true, results, targetUrl };
}

async function getOnboardingModuleContext(projectId, organizationId) {
  let setup = {};
  let apiConnected = 0;
  try {
    setup = await invoke({ projectId, organizationId, channel: 'get-setup-status', args: [] }) || {};
    apiConnected = Object.values(setup.apiMetrics || {}).filter((v) => v === 'Connected').length;
  } catch { /* optional */ }

  const brand = setup.campaign || {};
  const keywords = setup.keywords || [];
  let monitors = [];
  try {
    monitors = await invoke({ projectId, organizationId, channel: 'get-watched-monitors', args: [] }) || [];
  } catch { /* optional */ }

  const moduleFlow = buildModuleFlow(
    brand,
    keywords,
    null,
    {
      globalPrompt: brand.globalCustomPrompt,
      monitors: Array.isArray(monitors) ? monitors : [],
      apiConnected,
    },
  );

  const readyCount = moduleFlow.filter((m) => ['ready', 'live', 'wired', 'active'].includes(m.status)).length;

  return {
    success: true,
    brand,
    setup,
    moduleFlow,
    readyCount,
    totalModules: moduleFlow.length,
    targetUrl: buildTargetUrl(brand.domain),
  };
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
  let apiConnected = 0;

  try {
    const status = await invoke({ projectId, organizationId, channel: 'get-setup-status', args: [] });
    apiConnected = Object.values(status?.apiMetrics || {}).filter((v) => v === 'Connected').length;
  } catch { /* optional */ }

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
    sampleMessages: campaign?.sampleMessages || campaign?.description || '',
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
    const rawKw = Array.isArray(kw) ? kw : (kw?.keywords || []);
    const { normalizeKeywordTerms } = require('../../../apps/desktop/services/keywordResearch');
    keywordTerms = normalizeKeywordTerms(rawKw);
    steps.push({ step: 'generate-keywords', ok: keywordTerms.length > 0, count: keywordTerms.length });
  } catch (e) {
    steps.push({ step: 'generate-keywords', ok: false, error: e.message });
  }

  if (seoBrief?.recommendations?.length) {
    keywordTerms = [...new Set(keywordTerms)].slice(0, 12);
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

  const persistResult = await persistResearchToModules(projectId, organizationId, {
    brand,
    keywords,
    monitors,
    globalPrompt: String(globalPrompt || ''),
    platforms,
    persistKeywords: input.persist !== false,
    persistMonitors: input.persist !== false,
    persistPromptVault: input.persist !== false,
  });
  steps.push({ step: 'propagate-modules', ok: persistResult.success, modules: persistResult.results?.length });

  try {
    await appendLearning(store, {
      topic: 'brand-research',
      insight: `Researched ${domain} — ${keywordTerms.length} keywords wired to ${persistResult.results?.filter((r) => r.ok).length || 0} modules`,
      source: 'onboarding',
    });
    await store.flush();
  } catch { /* optional */ }

  const recommendations = [
    { step: 1, action: `Brand profile saved for ${brand.brandName}`, href: '/brand' },
    { step: 2, action: 'Connect APIs in Integrations — SerpAPI unlocks live SEO pulse', href: '/integrations?tab=connections' },
    { step: 3, action: `Review ${keywords.length} researched keywords`, href: '/keywords' },
    { step: 4, action: 'Run feed preview to validate discovery', href: '/onboarding' },
    { step: 5, action: 'Review global AI reply prompt', href: '/history' },
    { action: 'Open Campaign Command with verified target URL', href: '/campaign-manager?tab=nodes' },
    { action: 'Prompt Vault templates seeded from research', href: '/prompt-vault' },
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
    moduleFlow: buildModuleFlow(brand, keywords, seoBrief, { globalPrompt, monitors, platforms, apiConnected }),
    propagation: persistResult,
    steps,
    recommendations,
    targetUrl,
    researchedAt: new Date().toISOString(),
  };
}

async function propagateBrandToModules(projectId, organizationId, payload = {}) {
  const brand = payload.brand || payload;
  return persistResearchToModules(projectId, organizationId, {
    brand,
    keywords: payload.keywords || [],
    monitors: payload.monitors || [],
    globalPrompt: payload.globalPrompt || '',
    platforms: payload.platforms || ['Twitter', 'LinkedIn', 'Reddit', 'Facebook'],
    persistKeywords: payload.persistKeywords !== false && (payload.keywords?.length > 0),
    persistMonitors: payload.persistMonitors !== false && (payload.monitors?.length > 0),
    persistPromptVault: payload.persistPromptVault !== false,
  });
}

module.exports = {
  researchBrandFromDomain,
  propagateBrandToModules,
  persistResearchToModules,
  getOnboardingModuleContext,
  normalizeDomain,
  buildTargetUrl,
  buildModuleFlow,
  CANONICAL_MODULES,
};