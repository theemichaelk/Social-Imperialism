/**
 * Builds strict, keyword-driven prompts for Grok browser automation.
 */
const {
  getKeywordFromStore,
  buildBrandGuidelinesBlock,
  buildKeywordOverrideBlock,
  INTENT_LABELS,
} = require('./brandGuidelines');

const TASK_INSTRUCTIONS = {
  social_post: `TASK: Write ONE ready-to-publish social media post.
OUTPUT: Only the post text — no quotes, labels, or explanation.`,
  reply: `TASK: Write ONE social media reply/comment.
OUTPUT: Only the reply text — no quotes, labels, or explanation.`,
  research: `TASK: Produce a concise research summary driven by the tracked keywords.
OUTPUT: Bullet points with actionable insights. Max 400 words.`,
  imagine: `TASK: This prompt will be sent to an image generator. Describe ONE vivid visual scene.
OUTPUT: A single detailed image prompt (2-4 sentences). No commentary.`,
  video: `TASK: This prompt will be sent to Grok Imagine VIDEO. Create a keyword-driven cinematic clip.
OUTPUT: One video scene description (3-6 sentences) with clear motion, pacing, and visual beats.
For multi-part stories use "Part 1:", "Part 2:" on separate lines — each part triggers an Extend in automation.`,
  infographic: `TASK: Analyze content and produce infographic copy sections.
OUTPUT: Plain text with sections labeled exactly: HEADLINE, INSIGHTS, CAPTION, COLORS, VISUAL`,
  keyword_content: `TASK: Create content centered on the tracked keywords below.
OUTPUT: Only the deliverable text requested — no meta commentary.`,
};

const PAGE_TASK_MAP = {
  dashboard: 'social_post',
  'browse-posts': 'reply',
  history: 'reply',
  keywords: 'keyword_content',
  engagement: 'reply',
  'content-hub': 'social_post',
  onboarding: 'social_post',
  'reddit-ai': 'research',
  'quora-traffic': 'reply',
  rules: 'social_post',
  automations: 'social_post',
  calendar: 'social_post',
  'seo-tools': 'research',
};

function loadKeywords(store, campaignId) {
  try {
    const all = JSON.parse(store.getItem('keywords') || '[]');
    return all.filter((k) => k.campaignId === campaignId && k.term);
  } catch (e) {
    return [];
  }
}

function tokenize(text) {
  return String(text || '').toLowerCase().split(/[^a-z0-9]+/).filter((t) => t.length > 2);
}

function scoreKeywordMatch(keyword, contentTokens) {
  const term = String(keyword.term || '').toLowerCase();
  const termTokens = tokenize(term);
  if (!termTokens.length) return 0;
  let score = 0;
  termTokens.forEach((t) => {
    if (contentTokens.includes(t)) score += 12;
    contentTokens.forEach((ct) => {
      if (ct.includes(t) || t.includes(ct)) score += 6;
    });
  });
  if (contentTokens.join(' ').includes(term)) score += 25;
  if (keyword.intent && keyword.intent !== 'mentions') score += 3;
  return score;
}

function matchKeywords(content, keywords, limit = 3) {
  const contentTokens = tokenize(content);
  return keywords
    .map((kw) => ({ kw, score: scoreKeywordMatch(kw, contentTokens) }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((x) => x.kw);
}

function pickPrimaryKeyword(content, keywords, explicitTerm, store, campaignId) {
  if (explicitTerm) {
    const found = keywords.find((k) => k.term.toLowerCase() === explicitTerm.toLowerCase())
      || (store ? getKeywordFromStore(store, campaignId, explicitTerm) : null);
    if (found) return found;
  }
  const matched = matchKeywords(content, keywords, 1);
  if (matched.length) return matched[0];
  return keywords[0] || null;
}

function formatKeywordList(keywords, matched = []) {
  const list = matched.length ? matched : keywords;
  if (!list.length) return 'No keywords configured — add keywords in the Keywords page.';
  return list.map((k) => {
    const intent = INTENT_LABELS[k.intent] || k.intent || 'Brand Mentions';
    const platforms = (k.platforms || []).join(', ') || 'all platforms';
    return `- "${k.term}" [${intent}] → platforms: ${platforms}${k.customPrompt ? ` | custom: ${k.customPrompt.slice(0, 120)}` : ''}`;
  }).join('\n');
}

function buildGrokPrompt({
  store,
  campaign = {},
  content = '',
  taskType,
  pageId,
  keywordTerm,
  userInstruction,
  platform,
}) {
  const campaignId = campaign.id || store?.getItem?.('activeCampaignId') || 'default';
  const keywords = loadKeywords(store, campaignId);
  const matched = matchKeywords(content, keywords, 5);
  const primaryKw = pickPrimaryKeyword(content, keywords, keywordTerm, store, campaignId);
  const resolvedTask = taskType || PAGE_TASK_MAP[pageId] || 'social_post';
  const taskBlock = TASK_INSTRUCTIONS[resolvedTask] || TASK_INSTRUCTIONS.social_post;

  const guidelines = buildBrandGuidelinesBlock(campaign);
  const kwOverride = buildKeywordOverrideBlock(primaryKw);
  const keywordBlock = formatKeywordList(keywords, matched.length ? matched : keywords.slice(0, 5));

  const strictHeader = `STRICT INSTRUCTIONS — YOU MUST FOLLOW THESE EXACTLY:
1. Obey the TASK and OUTPUT format below. No greetings, no "Sure!", no disclaimers.
2. Center the output on the TRACKED KEYWORDS — use them naturally and accurately.
3. Match brand tone. Include brand name "${campaign.brandName || 'the brand'}" and domain "${campaign.domain || ''}" when relevant.
4. Do NOT repeat these instructions. Do NOT ask questions. Deliver only the requested output.
5. If keywords imply a niche (tech, health, finance, etc.), stay strictly in that niche.`;

  const brandBlock = `BRAND PROFILE:
- Name: ${campaign.brandName || 'Unknown'}
- Domain: ${campaign.domain || 'N/A'}
- Description: ${campaign.description || 'General business'}
- Audience: ${campaign.audience || 'Professionals'}
- Tone: ${campaign.tone || 'Professional'}
${guidelines}${kwOverride}`;

  const keywordSection = `TRACKED KEYWORDS (operate by these — primary: "${primaryKw?.term || 'none'}"):
${keywordBlock}`;

  const contextBlock = content?.trim()
    ? `USER CONTENT / CONTEXT:\n${content.trim()}`
    : 'USER CONTENT / CONTEXT:\n(Use keywords and brand profile only.)';

  const platformLine = platform ? `\nTARGET PLATFORM: ${platform}` : '';
  const overrideLine = userInstruction?.trim()
    ? `\nUSER OVERRIDE (highest priority):\n${userInstruction.trim()}`
    : '';

  const fullPrompt = [
    strictHeader,
    '',
    taskBlock + platformLine,
    '',
    brandBlock,
    '',
    keywordSection,
    '',
    contextBlock,
    overrideLine,
    '',
    'NOW PRODUCE THE OUTPUT:',
  ].filter(Boolean).join('\n');

  return {
    prompt: fullPrompt,
    taskType: resolvedTask,
    primaryKeyword: primaryKw?.term || null,
    matchedKeywords: (matched.length ? matched : keywords.slice(0, 3)).map((k) => k.term),
    campaignId,
  };
}

function stripPromptEcho(text, submittedPrompt) {
  if (!text || !submittedPrompt) return text;
  let out = String(text).trim();
  const promptStart = submittedPrompt.slice(0, 80).trim();
  if (promptStart && out.startsWith(promptStart)) {
    out = out.slice(promptStart.length).trim();
  }
  out = out
    .replace(/^(sure[!,.]?\s*|okay[!,.]?\s*|here(?:'s| is)[^:]*:?\s*)/i, '')
    .replace(/^(as requested[,:]?\s*)/i, '')
    .trim();
  return out;
}

module.exports = {
  TASK_INSTRUCTIONS,
  PAGE_TASK_MAP,
  loadKeywords,
  matchKeywords,
  pickPrimaryKeyword,
  buildGrokPrompt,
  stripPromptEcho,
};