const axios = require('axios');
const crypto = require('crypto');
const { fetchRealFeed } = require('./feedFetcher');
const { resolveKeys } = require('./keys');
const { engagePost } = require('./engagement');
const { publishPost } = require('./publisher');

const WEBHOOK_PORT = parseInt(process.env.WEBHOOK_PORT || '3847', 10);

const BUILTIN_TEMPLATES = {
  engagement: {
    id: 'engagement',
    name: 'Auto-Engagement Flow',
    builtin: true,
    nodes: [
      { id: 'node_1', type: 'trigger', title: 'Keyword Match', icon: 'fas fa-search', x: 1200, y: 1200, config: { platform: 'Any', match: 'Semantic' } },
      { id: 'node_2', type: 'condition', title: 'AI Sentiment Split', icon: 'fas fa-brain', x: 1200, y: 1350, config: { rule: 'Positive' } },
      { id: 'node_3', type: 'delay', title: 'Wait (Jitter)', icon: 'fas fa-clock', x: 1050, y: 1550, config: { delay: 15, jitter: 5 } },
      { id: 'node_4', type: 'action', title: 'AI Draft Reply', icon: 'fas fa-robot', x: 1050, y: 1700, config: { account: 'Auto', prompt: '' } },
      { id: 'node_5', type: 'action', title: 'Send Alert', icon: 'fas fa-bell', x: 1350, y: 1550, config: { account: 'Auto' } },
    ],
    edges: [
      { from: 'node_1', to: 'node_2', port: 'out' },
      { from: 'node_2', to: 'node_3', port: 'out-true' },
      { from: 'node_2', to: 'node_5', port: 'out-false' },
      { from: 'node_3', to: 'node_4', port: 'out' },
    ],
  },
  rss: {
    id: 'rss',
    name: 'RSS to Social Publisher',
    builtin: true,
    nodes: [
      { id: 'node_1', type: 'integration', title: 'RSS Feed Monitor', icon: 'fas fa-rss', x: 1200, y: 1200, config: { rss: '', freq: '1h' } },
      { id: 'node_2', type: 'action', title: 'AI Draft Reply', icon: 'fas fa-magic', x: 1200, y: 1400, config: { prompt: 'Summarize the blog post article and write an engaging social media post to promote it.', account: 'Auto' } },
      { id: 'node_3', type: 'action', title: 'Publish Content', icon: 'fas fa-paper-plane', x: 1200, y: 1600, config: { account: 'Auto' } },
    ],
    edges: [
      { from: 'node_1', to: 'node_2', port: 'out' },
      { from: 'node_2', to: 'node_3', port: 'out' },
    ],
  },
};

function loadJson(store, key, fallback) {
  try {
    const raw = store.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (e) {
    return fallback;
  }
}

function getActiveFlow(store) {
  return loadJson(store, 'activeAutomationFlow', null);
}

function saveActiveFlow(store, flow) {
  store.setItem('activeAutomationFlow', JSON.stringify(flow));
}

function getCustomTemplates(store) {
  return loadJson(store, 'automationTemplates', []);
}

function saveCustomTemplate(store, template) {
  const templates = getCustomTemplates(store);
  const idx = templates.findIndex((t) => t.name === template.name);
  if (idx >= 0) templates[idx] = template;
  else templates.push(template);
  store.setItem('automationTemplates', JSON.stringify(templates));
}

function listTemplates(store) {
  const custom = getCustomTemplates(store).map((t) => ({
    id: `custom_${t.name}`,
    name: `${t.name} (Custom)`,
    builtin: false,
  }));
  return [
    { id: 'engagement', name: 'Auto-Engagement Flow', builtin: true },
    { id: 'rss', name: 'RSS to Social Publisher', builtin: true },
    ...custom,
  ];
}

function getTemplateById(store, templateId) {
  if (BUILTIN_TEMPLATES[templateId]) return BUILTIN_TEMPLATES[templateId];
  if (templateId.startsWith('custom_')) {
    const name = templateId.replace('custom_', '');
    const t = getCustomTemplates(store).find((ct) => ct.name === name);
    if (t) return { ...t, id: templateId };
  }
  return null;
}

function buildAdjacency(nodes, edges) {
  const byId = {};
  nodes.forEach((n) => { byId[n.id] = n; });
  const outgoing = {};
  nodes.forEach((n) => { outgoing[n.id] = []; });
  edges.forEach((e) => {
    if (outgoing[e.from]) outgoing[e.from].push(e);
  });
  return { byId, outgoing };
}

function isTriggerNode(node) {
  return node.type === 'trigger' || node.type === 'integration';
}

function pushLog(store, entry) {
  const logs = loadJson(store, 'automationExecutionLog', []);
  logs.unshift({ ...entry, time: new Date().toISOString() });
  store.setItem('automationExecutionLog', JSON.stringify(logs.slice(0, 50)));
}

function pushWorkerTask(store, action, platform) {
  let tasks = loadJson(store, 'workerTasks', []);
  tasks.unshift({ time: new Date().toLocaleTimeString(), action, platform });
  store.setItem('workerTasks', JSON.stringify(tasks.slice(0, 15)));
}

function getWebhookMappings(store) {
  return loadJson(store, 'automationWebhooks', {});
}

function ensureWebhookId(store, nodeId) {
  const mappings = getWebhookMappings(store);
  if (mappings[nodeId]?.webhookId) return mappings[nodeId].webhookId;
  const webhookId = crypto.randomBytes(12).toString('hex');
  mappings[nodeId] = { webhookId, createdAt: new Date().toISOString() };
  store.setItem('automationWebhooks', JSON.stringify(mappings));
  return webhookId;
}

function getWebhookUrl(webhookId) {
  return `http://127.0.0.1:${WEBHOOK_PORT}/hook/${webhookId}`;
}

function queueWebhookPayload(store, webhookId, payload) {
  const queue = loadJson(store, 'webhookPayloadQueue', []);
  queue.push({ webhookId, payload, receivedAt: new Date().toISOString() });
  store.setItem('webhookPayloadQueue', JSON.stringify(queue.slice(-100)));
}

function getCampaign(store) {
  const activeCampaignId = store.getItem('activeCampaignId') || 'default';
  const campaigns = loadJson(store, 'campaigns', []);
  return campaigns.find((c) => c.id === activeCampaignId) || {
    brandName: 'Your Brand',
    audience: 'Your Audience',
    domain: '',
    description: '',
    tone: 'Professional',
  };
}

function getLinkedAccounts(store) {
  const activeCampaignId = store.getItem('activeCampaignId') || 'default';
  return loadJson(store, `linkedAccounts_${activeCampaignId}`, []);
}

function getKeywords(store) {
  const activeCampaignId = store.getItem('activeCampaignId') || 'default';
  return loadJson(store, 'keywords', [])
    .filter((k) => k.campaignId === activeCampaignId)
    .map((k) => k.term);
}

function freqToMs(freq) {
  if (freq === '15m') return 15 * 60 * 1000;
  if (freq === '1h') return 60 * 60 * 1000;
  if (freq === '5m') return 5 * 60 * 1000;
  if (freq === 'daily') return 24 * 60 * 60 * 1000;
  return 60 * 60 * 1000;
}

async function classifySentiment(generateAI, text, target) {
  const prompt = `Classify the sentiment/intent of this social post. Target for TRUE path: "${target}".
Post: "${text.substring(0, 500)}"
Reply with exactly one word: Positive, Negative, or Question.`;
  const result = (await generateAI(prompt)).trim().toLowerCase();
  if (target === 'Positive') return result.includes('positive');
  if (target === 'Negative') return result.includes('negative');
  if (target === 'Question') return result.includes('question');
  return result.includes(target.toLowerCase());
}

async function evaluateIfElse(generateAI, variable, context) {
  const prompt = `Evaluate if this condition is TRUE for the given context.
Condition: "${variable}"
Context post: "${(context.content || '').substring(0, 400)}"
Author: ${context.author || 'unknown'}
Platform: ${context.platform || 'unknown'}
Reply with only TRUE or FALSE.`;
  const result = (await generateAI(prompt)).trim().toUpperCase();
  return result.startsWith('TRUE');
}

async function curateRssItem(generateAI, rssUrl, campaign, targetPlatform = 'Facebook') {
  const res = await axios.get(rssUrl, { timeout: 12000 });
  const xml = res.data;
  const itemRegex = /<item[^>]*>([\s\S]*?)<\/item>/gi;
  let match;
  let item = null;
  while ((match = itemRegex.exec(xml)) && !item) {
    const itemXml = match[1];
    const title = ((itemXml.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [])[1] || 'Untitled')
      .replace(/<!\[CDATA\[|\]\]>/g, '').trim();
    const link = ((itemXml.match(/<link[^>]*>([\s\S]*?)<\/link>/i) || [])[1] || '').trim();
    const desc = ((itemXml.match(/<description[^>]*>([\s\S]*?)<\/description>/i) || [])[1] || '')
      .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/gi, '$1').replace(/<[^>]+>/g, '').substring(0, 300).trim();
    item = { title, link, description: desc };
  }
  if (!item) throw new Error(`No RSS items found at ${rssUrl}`);

  const curatePrompt = `Create an engaging ${targetPlatform} post for brand "${campaign.brandName}" based on:
Title: ${item.title}
Summary: ${item.description}
Link: ${item.link}
Return ONLY the post text with 2-3 hashtags.`;
  const content = (await generateAI(curatePrompt)).trim().substring(0, 500);
  return { content, title: item.title, link: item.link, platform: targetPlatform };
}

async function draftReply(generateAI, campaign, post, customPrompt) {
  const override = customPrompt ? `\nOverride instructions: ${customPrompt}\n` : '';
  const prompt = `Write a helpful on-brand reply (max 280 chars) for brand "${campaign.brandName}" to this ${post.platform} post.
Post by ${post.author}: "${post.content}"
${override}
Return ONLY the reply text.`;
  return generateAI(prompt);
}

function resolveAccount(linkedAccounts, accountSetting) {
  if (!accountSetting || accountSetting === 'Auto') return linkedAccounts[0] || null;
  return linkedAccounts.find((a) => a.id === accountSetting) || linkedAccounts[0] || null;
}

async function executeActionNode(node, context, deps) {
  const { store, generateAI, sendNotification, keys, campaign, linkedAccounts } = deps;
  const title = node.title;

  if (title.includes('Auto-Like') || title === 'Auto-Like Post') {
    if (!context.externalId && !context.postId) {
      pushLog(store, { node: title, status: 'skipped', reason: 'No post to like' });
      return context;
    }
    await engagePost(
      { action: 'like', platform: context.platform, externalId: context.externalId, postId: context.externalId },
      keys,
      linkedAccounts
    );
    pushWorkerTask(store, 'Auto-Liked post', context.platform);
    pushLog(store, { node: title, status: 'success', action: 'like', platform: context.platform });
    return context;
  }

  if (title.includes('Draft') || title.includes('Summarize') || title.includes('AI Draft')) {
    const replyText = await draftReply(generateAI, campaign, context, node.config?.prompt);
    context.generatedContent = replyText;
    context.replyContent = replyText;

    let history = loadJson(store, 'aiRepliesHistory', []);
    history.unshift({
      id: `flow_${Date.now()}`,
      originalPost: context.content,
      replyContent: replyText,
      platform: context.platform,
      externalId: context.externalId,
      url: context.url,
      timestamp: new Date().toISOString(),
      status: 'draft',
      source: 'automation-flow',
      replyMode: 'manual_approval',
      campaignId: store.getItem('activeCampaignId') || 'default',
    });
    store.setItem('aiRepliesHistory', JSON.stringify(history.slice(0, 200)));

    const count = parseInt(store.getItem('aiDraftsCount') || '0', 10) + 1;
    store.setItem('aiDraftsCount', String(count));
    pushWorkerTask(store, 'AI drafted reply via flow', context.platform);
    pushLog(store, { node: title, status: 'success', action: 'draft' });
    return context;
  }

  if (title.includes('Publish')) {
    const account = resolveAccount(linkedAccounts, node.config?.account);
    if (!account) {
      pushLog(store, { node: title, status: 'error', reason: 'No linked account — link one in Account Hub' });
      return context;
    }
    const content = context.generatedContent || context.content;
    if (!content) {
      pushLog(store, { node: title, status: 'error', reason: 'No content to publish' });
      return context;
    }
    await publishPost({
      accountId: account.id,
      platform: account.platform,
      content,
      hasMedia: !!context.mediaUrl,
      mediaUrl: context.mediaUrl,
    }, keys, linkedAccounts);
    pushWorkerTask(store, 'Published content via flow', account.platform);
    pushLog(store, { node: title, status: 'success', action: 'publish', platform: account.platform });
    return context;
  }

  if (title.includes('Send Alert') || title.includes('Alert')) {
    const msg = context.generatedContent
      ? `Draft: ${context.generatedContent}\n\nOriginal: ${(context.content || '').substring(0, 200)}`
      : (context.content || 'Automation flow alert').substring(0, 500);
    await sendNotification(`Flow Alert: ${title}`, `${context.platform || 'Multi'} | ${context.author || ''}\n${msg}`);
    pushWorkerTask(store, 'Sent flow alert notification', context.platform || 'Multi');
    pushLog(store, { node: title, status: 'success', action: 'alert' });
    return context;
  }

  return context;
}

async function walkFromNode(nodeId, portFilter, context, flow, deps, visited = new Set()) {
  const { nodes, edges } = flow;
  const { outgoing } = buildAdjacency(nodes, edges);
  const visitKey = `${nodeId}:${portFilter || 'any'}`;
  if (visited.has(visitKey)) return;
  visited.add(visitKey);

  const node = nodes.find((n) => n.id === nodeId);
  if (!node) return;

  let ctx = { ...context };

  if (node.type === 'delay') {
    const base = parseInt(node.config?.delay || 15, 10);
    const jitter = parseInt(node.config?.jitter || 0, 10);
    const waitMs = (base + (jitter ? Math.floor(Math.random() * jitter * 2) - jitter : 0)) * 60 * 1000;
    if (waitMs > 0 && waitMs < 120000) await new Promise((r) => setTimeout(r, Math.min(waitMs, 30000)));
    pushLog(deps.store, { node: node.title, status: 'success', action: 'delay', waitMs });
  } else if (node.type === 'condition') {
    let pass = false;
    if (node.title.includes('Sentiment')) {
      pass = await classifySentiment(deps.generateAI, ctx.content || '', node.config?.rule || 'Positive');
    } else {
      pass = await evaluateIfElse(deps.generateAI, node.config?.var || 'true', ctx);
    }
    const nextPort = pass ? 'out-true' : 'out-false';
    const nextEdges = (outgoing[nodeId] || []).filter((e) => e.port === nextPort);
    for (const edge of nextEdges) {
      await walkFromNode(edge.to, null, ctx, flow, deps, visited);
    }
    return;
  } else if (node.type === 'action') {
    ctx = await executeActionNode(node, ctx, deps);
  }

  const nextEdges = (outgoing[nodeId] || []).filter((e) => !portFilter || e.port === portFilter || portFilter === null);
  for (const edge of nextEdges) {
    if (node.type === 'condition') continue;
    await walkFromNode(edge.to, null, ctx, flow, deps, visited);
  }
}

async function runKeywordTrigger(flow, triggerNode, deps) {
  const { store, keys } = deps;
  const platform = triggerNode.config?.platform;
  const platformFilter = platform && platform !== 'Any' ? platform : null;
  let keywords = getKeywords(store);
  if (triggerNode.config?.keyword) keywords = [triggerNode.config.keyword];
  if (!keywords.length) keywords = [getCampaign(store).brandName || 'marketing'];

  const posts = await fetchRealFeed({
    keywords,
    filters: { platform: platformFilter || 'All' },
    keys,
    allowedPlatforms: new Set(platformFilter ? [platformFilter] : []),
  });

  const seen = new Set(loadJson(store, 'automationFlowSeenPosts', []));
  let processed = 0;

  for (const post of posts.slice(0, 5)) {
    const key = `${post.platform}:${post.externalId || post.url || post.content?.substring(0, 60)}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const context = {
      platform: post.platform,
      author: post.author,
      content: post.content,
      externalId: post.externalId,
      url: post.url,
      matchedKeyword: post.matchedKeyword,
    };

    await walkFromNode(triggerNode.id, 'out', context, flow, deps);
    processed++;
  }

  store.setItem('automationFlowSeenPosts', JSON.stringify(Array.from(seen).slice(-500)));
  return processed;
}

async function runRssTrigger(flow, triggerNode, deps) {
  const { store, generateAI } = deps;
  const rssUrl = triggerNode.config?.rss;
  if (!rssUrl) {
    pushLog(store, { node: triggerNode.title, status: 'error', reason: 'RSS URL not configured' });
    return 0;
  }

  const freq = triggerNode.config?.freq || '1h';
  const stateKey = `automationRssLastRun_${triggerNode.id}`;
  const lastRun = parseInt(store.getItem(stateKey) || '0', 10);
  if (Date.now() - lastRun < freqToMs(freq)) return 0;

  const campaign = getCampaign(store);
  const curated = await curateRssItem(generateAI, rssUrl, campaign);
  store.setItem(stateKey, String(Date.now()));

  const context = {
    platform: curated.platform,
    content: curated.content,
    generatedContent: curated.content,
    title: curated.title,
    url: curated.link,
  };

  await walkFromNode(triggerNode.id, 'out', context, flow, deps);
  pushWorkerTask(store, `RSS curated: ${curated.title}`, curated.platform);
  return 1;
}

async function runWebhookTrigger(flow, triggerNode, deps) {
  const { store } = deps;
  const mappings = getWebhookMappings(store);
  const webhookId = mappings[triggerNode.id]?.webhookId;
  if (!webhookId) return 0;

  const queue = loadJson(store, 'webhookPayloadQueue', []);
  const remaining = [];
  let processed = 0;

  for (const item of queue) {
    if (item.webhookId !== webhookId) {
      remaining.push(item);
      continue;
    }
    const payload = item.payload || {};
    const keyPath = triggerNode.config?.key || 'text';
    let content = payload;
    for (const part of keyPath.split('.')) {
      content = content?.[part];
    }
    if (!content) content = JSON.stringify(payload);

    const context = {
      platform: payload.platform || 'Webhook',
      author: payload.author || 'webhook',
      content: String(content),
      externalId: payload.id || payload.externalId,
      url: payload.url,
    };

    await walkFromNode(triggerNode.id, 'out', context, flow, deps);
    processed++;
  }

  store.setItem('webhookPayloadQueue', JSON.stringify(remaining));
  return processed;
}

async function runScheduledTrigger(flow, triggerNode, deps) {
  const { store } = deps;
  const schedule = triggerNode.config?.schedule || '15m';
  const stateKey = `automationScheduleLastRun_${triggerNode.id}`;
  const lastRun = parseInt(store.getItem(stateKey) || '0', 10);
  const interval = freqToMs(schedule);
  if (Date.now() - lastRun < interval) return 0;

  store.setItem(stateKey, String(Date.now()));
  const context = {
    platform: 'Scheduled',
    content: `Scheduled flow tick at ${new Date().toLocaleString()}`,
    author: 'scheduler',
  };
  await walkFromNode(triggerNode.id, 'out', context, flow, deps);
  pushWorkerTask(store, 'Scheduled flow executed', 'Multi');
  return 1;
}

function syncFlowToGlobalRules(store, flow) {
  const nodes = flow.nodes || [];
  const hasAutoLike = nodes.some((n) => n.title?.includes('Auto-Like'));
  const hasAutoReply = nodes.some((n) => n.title?.includes('Draft') || n.title?.includes('Reply'));
  const rssNode = nodes.find((n) => n.title?.includes('RSS'));
  const scheduleNode = nodes.find((n) => n.title?.includes('Scheduled'));

  const accountIds = nodes
    .filter((n) => n.type === 'action' && n.config?.account && n.config.account !== 'Auto')
    .map((n) => n.config.account);

  const existing = loadJson(store, 'autoRulesEngine', {});
  const merged = {
    ...existing,
    enabled: true,
    autoLike: hasAutoLike || existing.autoLike,
    autoReplyEnabled: hasAutoReply || existing.autoReplyEnabled,
    frequency: scheduleNode?.config?.schedule || rssNode?.config?.freq || existing.frequency || '15m',
    activeAccountIds: accountIds.length ? accountIds : existing.activeAccountIds,
    flowDeployed: true,
    flowId: flow.id,
  };
  store.setItem('autoRulesEngine', JSON.stringify(merged));

  if (rssNode?.config?.rss) {
    const autoContent = loadJson(store, 'autoContentSettings', { enabled: false, rssUrls: [], targetAccountIds: [], frequency: 'daily' });
    const urls = new Set(autoContent.rssUrls || []);
    urls.add(rssNode.config.rss);
    const freqMap = { '15m': 'realtime', '1h': 'hourly', daily: 'daily' };
    store.setItem('autoContentSettings', JSON.stringify({
      ...autoContent,
      enabled: true,
      rssUrls: Array.from(urls),
      frequency: freqMap[rssNode.config.freq] || autoContent.frequency || 'hourly',
      targetAccountIds: accountIds.length ? accountIds : autoContent.targetAccountIds,
    }));
  }
}

function validateFlow(flow) {
  const nodes = flow.nodes || [];
  const triggers = nodes.filter(isTriggerNode);
  if (!triggers.length) return { valid: false, error: 'Add at least one trigger or integration node.' };
  const rssNodes = nodes.filter((n) => n.title?.includes('RSS'));
  for (const n of rssNodes) {
    if (!n.config?.rss) return { valid: false, error: 'RSS Feed Monitor requires an RSS URL in node settings.' };
  }
  return { valid: true };
}

async function runDeployedAutomationFlow(deps) {
  const { store } = deps;
  const flow = getActiveFlow(store);
  if (!flow || flow.status !== 'active') return { processed: 0, skipped: true };

  const triggers = (flow.nodes || []).filter(isTriggerNode);
  let total = 0;

  for (const trigger of triggers) {
    try {
      if (trigger.title?.includes('Keyword')) {
        total += await runKeywordTrigger(flow, trigger, deps);
      } else if (trigger.title?.includes('RSS')) {
        total += await runRssTrigger(flow, trigger, deps);
      } else if (trigger.title?.includes('Webhook')) {
        total += await runWebhookTrigger(flow, trigger, deps);
      } else if (trigger.title?.includes('Scheduled')) {
        total += await runScheduledTrigger(flow, trigger, deps);
      } else if (trigger.title?.includes('Follower')) {
        total += await runKeywordTrigger(flow, { ...trigger, config: { ...trigger.config, keyword: 'new follower' } }, deps);
      }
    } catch (e) {
      pushLog(store, { node: trigger.title, status: 'error', reason: e.message });
      console.error('Automation trigger error:', e.message);
    }
  }

  flow.lastRunAt = new Date().toISOString();
  saveActiveFlow(store, flow);
  return { processed: total };
}

async function testAutomationFlow(deps, draftFlow) {
  const { store, keys } = deps;
  const flow = draftFlow || getActiveFlow(store);
  if (!flow || !flow.nodes?.length) return { success: false, error: 'No flow to test' };

  const validation = validateFlow(flow);
  if (!validation.valid) return { success: false, error: validation.error };

  const campaign = getCampaign(store);
  const linkedAccounts = getLinkedAccounts(store);
  const fullDeps = { ...deps, keys, campaign, linkedAccounts };

  const triggers = flow.nodes.filter(isTriggerNode);
  let total = 0;
  for (const trigger of triggers) {
    if (trigger.title?.includes('RSS') && trigger.config?.rss) {
      total += await runRssTrigger(flow, trigger, fullDeps);
    } else if (trigger.title?.includes('Webhook')) {
      queueWebhookPayload(store, ensureWebhookId(store, trigger.id), { text: 'Test webhook payload from Visual Builder', platform: 'Webhook' });
      total += await runWebhookTrigger(flow, trigger, fullDeps);
    } else {
      total += await runKeywordTrigger(flow, trigger, fullDeps);
    }
  }

  return { success: true, processed: total, message: `Test run completed — ${total} trigger(s) processed.` };
}

function deployFlow(store, flow) {
  const validation = validateFlow(flow);
  if (!validation.valid) return { success: false, error: validation.error };

  const deployed = {
    ...flow,
    id: flow.id || `flow_${Date.now()}`,
    status: 'active',
    deployedAt: new Date().toISOString(),
  };

  (deployed.nodes || []).forEach((n) => {
    if (n.title?.includes('Webhook')) ensureWebhookId(store, n.id);
  });

  saveActiveFlow(store, deployed);
  syncFlowToGlobalRules(store, deployed);
  pushLog(store, { node: 'Deploy', status: 'success', action: 'deploy', flowId: deployed.id });
  return { success: true, flow: deployed };
}

function undeployFlow(store) {
  const flow = getActiveFlow(store);
  if (!flow) return { success: true };
  flow.status = 'draft';
  saveActiveFlow(store, flow);
  const rules = loadJson(store, 'autoRulesEngine', {});
  rules.flowDeployed = false;
  store.setItem('autoRulesEngine', JSON.stringify(rules));
  return { success: true, flow };
}

function getAutomationStatus(store) {
  const flow = getActiveFlow(store);
  const logs = loadJson(store, 'automationExecutionLog', []);
  const workerRunning = store.getItem('workerRunningFlag') === 'true';
  return {
    status: flow?.status || 'draft',
    deployedAt: flow?.deployedAt,
    lastRunAt: flow?.lastRunAt,
    nodeCount: flow?.nodes?.length || 0,
    workerRunning,
    recentLogs: logs.slice(0, 8),
    webhookPort: WEBHOOK_PORT,
  };
}

module.exports = {
  BUILTIN_TEMPLATES,
  WEBHOOK_PORT,
  getActiveFlow,
  saveActiveFlow,
  listTemplates,
  getTemplateById,
  saveCustomTemplate,
  deployFlow,
  undeployFlow,
  validateFlow,
  runDeployedAutomationFlow,
  testAutomationFlow,
  getAutomationStatus,
  ensureWebhookId,
  getWebhookUrl,
  queueWebhookPayload,
  syncFlowToGlobalRules,
};