/**
 * Prompt Vault — reusable prompt templates per campaign.
 * Used by Content Hub, Grok, Keywords, Replies, Growth Lab, and brain workflows.
 */

const DEFAULT_SEED = [
  {
    id: 'pv_seed_linkedin_post',
    title: 'LinkedIn thought leadership post',
    body: 'Write a professional LinkedIn post about {{keyword}} for {{brandName}}. Lead with a specific insight for small business owners. Include one practical tip, avoid generic AI tone, end with a soft CTA to {{domain}}.',
    keywords: ['linkedin', 'post', 'thought leadership', 'small business'],
    feature: 'content-hub',
    platform: 'LinkedIn',
    tags: ['content', 'b2b'],
  },
  {
    id: 'pv_seed_reply_helpful',
    title: 'Helpful community reply (non-spam)',
    body: 'Draft a respectful, context-aware reply to this post about {{keyword}}. Add genuine value first. Mention {{brandName}} only if naturally relevant. No hard sell, no spam patterns.',
    keywords: ['reply', 'engagement', 'reddit', 'quora', 'community'],
    feature: 'replies',
    tags: ['engagement', 'aeo'],
  },
  {
    id: 'pv_seed_grok_imagine',
    title: 'Grok Imagine — social graphic',
    body: 'Bold social media graphic for {{keyword}}, on-brand for {{brandName}}, clean layout, high contrast, no cluttered text, professional marketing visual.',
    keywords: ['grok', 'imagine', 'image', 'thumbnail'],
    feature: 'grok',
    tags: ['visual'],
  },
  {
    id: 'pv_seed_keyword_monitor',
    title: 'Keyword monitor custom prompt',
    body: 'When {{keyword}} appears in social feeds, prioritize posts where we can add expert value about automation for small businesses. Draft replies that match {{tone}} tone for {{brandName}}.',
    keywords: ['keyword', 'monitor', 'automation'],
    feature: 'keywords',
    tags: ['discovery'],
  },
  {
    id: 'pv_seed_live_support',
    title: 'Live Support Growth Agent — troubleshooting',
    body: 'You are the Social Imperialism Live Support Growth Agent. Help the user with {{keyword}} for {{brandName}}. Be concise, actionable, and suggest the next click inside the product (Integrations, Calendar, AI Replies, Mission Control). If the request affects all accounts or global automation, note that THEE_MICHAEL approval is required. Tone: helpful growth partner, not robotic.',
    keywords: ['support', 'help', 'troubleshoot', 'THEE_MICHAEL', 'admin', 'connect platform', 'schedule', 'reply'],
    feature: 'support',
    tags: ['support', 'agent', 'growth'],
  },
  {
    id: 'pv_seed_guardian_gatekeeper',
    title: 'Guardian Gatekeeper — health alert response',
    body: 'You are the Social Imperialism Guardian and Self-Healing Gatekeeper. Diagnose {{keyword}} for {{brandName}} across modules, workers, APIs, and scheduling. Use current platform docs. Propose fixes only after sandbox Test A + Test B. Production changes require THEE_MICHAEL approval. Return: severity, module, summary, recommendedAction, sandbox results, approval status. Never expose private admin contact details.',
    keywords: ['guardian', 'gatekeeper', 'monitor', 'self-heal', 'linkedin scheduling', 'worker', 'api', 'sandbox'],
    feature: 'guardian',
    tags: ['guardian', 'ops', 'approval'],
  },
  {
    id: 'pv_seed_omni_brain',
    title: 'Omni-Brain — strategic workflow blueprint',
    body: 'You are the Social Imperialism Omni-Brain Strategic Workflow Planner. Turn this request about {{keyword}} into a chronological workflow for {{brandName}} (tone: {{tone}}). Return step-by-step modules: Setup Wizard, Keywords, Integrations, Browse Posts, Content Hub, AI Replies, Engagement Queue, Calendar, Analytics. Include success checks and required inputs. Mark THEE_MICHAEL approval if global automation or mass posting. Short, confident, no internal reasoning.',
    keywords: ['omni-brain', 'workflow', 'plan', 'campaign', 'schedule', 'discover', 'linkedin', 'reddit', 'create post'],
    feature: 'omni-brain',
    tags: ['planner', 'workflow', 'omni'],
  },
];

function vaultKey(store) {
  const id = store.getItem('activeCampaignId') || 'default';
  return `promptVault_${id}`;
}

function readVault(store) {
  try {
    return JSON.parse(store.getItem(vaultKey(store)) || '[]');
  } catch {
    return [];
  }
}

function writeVault(store, items) {
  store.setItem(vaultKey(store), JSON.stringify(items));
}

function getCampaignContext(store) {
  const activeId = store.getItem('activeCampaignId') || 'default';
  let campaigns = [];
  try { campaigns = JSON.parse(store.getItem('campaigns') || '[]'); } catch (e) {}
  const c = campaigns.find((x) => x.id === activeId) || campaigns[0] || {};
  return {
    campaignId: activeId,
    brandName: c.brandName || 'your brand',
    domain: c.domain || '',
    tone: c.tone || 'Professional',
  };
}

function applyContext(body, ctx, extra = {}) {
  return String(body || '')
    .replace(/\{\{brandName\}\}/gi, ctx.brandName)
    .replace(/\{\{domain\}\}/gi, ctx.domain)
    .replace(/\{\{tone\}\}/gi, ctx.tone)
    .replace(/\{\{keyword\}\}/gi, extra.keyword || extra.keywords?.[0] || 'your topic');
}

function searchItems(items, query) {
  const q = String(query || '').toLowerCase().trim();
  if (!q) return items;
  const terms = q.split(/[\s,]+/).filter(Boolean);
  return items.filter((item) => {
    const hay = [
      item.title,
      item.body,
      item.feature,
      item.platform,
      ...(item.keywords || []),
      ...(item.tags || []),
    ].join(' ').toLowerCase();
    return terms.every((t) => hay.includes(t));
  });
}

function ensureSeeded(store) {
  let items = readVault(store);
  if (items.length) return items;
  const now = new Date().toISOString();
  items = DEFAULT_SEED.map((s) => ({
    ...s,
    createdAt: now,
    updatedAt: now,
    usageCount: 0,
  }));
  writeVault(store, items);
  return items;
}

function normalizeItem(payload, existing) {
  const now = new Date().toISOString();
  const keywords = Array.isArray(payload.keywords)
    ? payload.keywords
    : String(payload.keywords || payload.keyword || '')
      .split(/[,;\n]+/).map((k) => k.trim()).filter(Boolean);
  return {
    id: payload.id || existing?.id || `pv_${Date.now()}`,
    title: String(payload.title || payload.name || keywords[0] || 'Untitled prompt').trim(),
    body: String(payload.body || payload.prompt || payload.text || '').trim(),
    keywords,
    feature: payload.feature || 'general',
    platform: payload.platform || '',
    tags: Array.isArray(payload.tags) ? payload.tags : [],
    createdAt: existing?.createdAt || now,
    updatedAt: now,
    usageCount: existing?.usageCount || 0,
  };
}

function registerPromptVaultHandlers(ipcMain, { store, generateAI }) {
  ipcMain.handle('get-prompt-vault', (event, payload = {}) => {
    const items = ensureSeeded(store);
    const filtered = searchItems(
      payload.feature ? items.filter((i) => i.feature === payload.feature || i.feature === 'general') : items,
      payload.query || payload.keyword,
    );
    return {
      prompts: filtered,
      total: items.length,
      campaignId: getCampaignContext(store).campaignId,
    };
  });

  ipcMain.handle('search-prompt-vault', (event, payload = {}) => {
    const q = payload.query || payload.keyword || '';
    const items = readVault(store);
    const filtered = searchItems(
      payload.feature ? items.filter((i) => i.feature === payload.feature || i.feature === 'general') : items,
      q,
    );
    return { prompts: filtered, query: q, count: filtered.length };
  });

  ipcMain.handle('save-prompt-vault-item', (event, payload = {}) => {
    const items = readVault(store);
    const idx = items.findIndex((i) => i.id === payload.id);
    const item = normalizeItem(payload, idx >= 0 ? items[idx] : null);
    if (!item.body) return { success: false, error: 'Prompt body is required' };
    if (idx >= 0) items[idx] = item;
    else items.unshift(item);
    writeVault(store, items);
    return { success: true, prompt: item, prompts: items };
  });

  ipcMain.handle('create-prompt-vault-from-keyword', async (event, payload = {}) => {
    const keyword = String(payload.keyword || payload.query || '').trim();
    if (!keyword) return { success: false, error: 'Keyword is required' };
    const ctx = getCampaignContext(store);
    const feature = payload.feature || 'general';
    const metaPrompt = `Create a reusable Social Imperialism prompt template for the keyword "${keyword}".
Feature context: ${feature}. Brand: ${ctx.brandName}. Tone: ${ctx.tone}.
Return JSON only: { "title": "short name", "body": "full prompt with {{keyword}} {{brandName}} {{domain}} {{tone}} placeholders", "keywords": ["${keyword}", ...], "tags": ["..."] }`;
    try {
      const text = await generateAI(metaPrompt);
      const match = text.match(/\{[\s\S]*\}/);
      const parsed = match ? JSON.parse(match[0]) : {};
      const item = normalizeItem({
        ...parsed,
        keyword,
        keywords: parsed.keywords || [keyword],
        feature,
        title: parsed.title || `${keyword} — ${feature}`,
        body: parsed.body || `Write on-brand content about {{keyword}} for {{brandName}} in a {{tone}} voice.`,
      });
      const items = readVault(store);
      items.unshift(item);
      writeVault(store, items);
      return { success: true, prompt: item };
    } catch (e) {
      const item = normalizeItem({
        title: `${keyword} template`,
        body: `Create {{tone}} content about {{keyword}} for {{brandName}}. Focus on practical value for the target audience. CTA: {{domain}}`,
        keywords: [keyword],
        feature,
      });
      const items = readVault(store);
      items.unshift(item);
      writeVault(store, items);
      return { success: true, prompt: item, fallback: true, error: e.message };
    }
  });

  ipcMain.handle('load-prompt-vault-item', (event, payload = {}) => {
    const id = payload.id;
    if (!id) return { success: false, error: 'Prompt id required' };
    const items = readVault(store);
    const idx = items.findIndex((i) => i.id === id);
    if (idx < 0) return { success: false, error: 'Prompt not found' };
    const ctx = getCampaignContext(store);
    const raw = items[idx];
    raw.usageCount = (raw.usageCount || 0) + 1;
    raw.updatedAt = new Date().toISOString();
    items[idx] = raw;
    writeVault(store, items);
    const resolved = applyContext(raw.body, ctx, payload);
    return {
      success: true,
      prompt: raw,
      text: resolved,
      resolvedBody: resolved,
    };
  });

  ipcMain.handle('delete-prompt-vault-item', (event, payload = {}) => {
    const id = typeof payload === 'string' ? payload : payload?.id;
    if (!id) return { success: false, error: 'Prompt id required' };
    const items = readVault(store).filter((i) => i.id !== id);
    writeVault(store, items);
    return { success: true, prompts: items };
  });

  ipcMain.handle('export-prompt-vault', (event, payload = {}) => {
    let items = readVault(store);
    if (payload.feature) items = items.filter((i) => i.feature === payload.feature);
    if (payload.query || payload.keyword) items = searchItems(items, payload.query || payload.keyword);
    const ctx = getCampaignContext(store);
    return {
      success: true,
      exportedAt: new Date().toISOString(),
      campaignId: ctx.campaignId,
      brandName: ctx.brandName,
      count: items.length,
      prompts: items,
    };
  });
}

module.exports = {
  registerPromptVaultHandlers,
  readVault,
  searchItems,
  applyContext,
  getCampaignContext,
};