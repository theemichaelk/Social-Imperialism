const INTENT_LABELS = {
  mentions: 'Brand Mentions',
  affiliate: 'Affiliate Product',
  client: 'Client Brand',
  qa: 'Q&A Questions',
  competitor: 'Competitor Account/Page',
  partner: 'Partner Account/Page',
};

const INTENT_PROMPTS = {
  mentions: 'This keyword tracks brand mentions. Naturally include the brand name, domain, and key messages. Be helpful first; promote second.',
  affiliate: 'This keyword relates to affiliate products. Find opportunities to mention affiliate offers, USPs, and drive traffic/conversions without being spammy.',
  client: "This keyword tracks a client's brand. Respond professionally on their behalf; increase engagement and showcase proactive social management.",
  qa: 'This is a Q&A / question keyword. Provide authoritative, helpful answers. Position the brand as the expert. Suitable for blog distribution.',
  competitor: 'This keyword monitors competitor activity. Engage diplomatically only when it adds value; never disparage competitors.',
  partner: 'This keyword tracks partner accounts/pages. Engage positively to strengthen partnerships and co-marketing opportunities.',
};

function getKeywordFromStore(store, campaignId, matchedKeyword) {
  if (!store || !matchedKeyword) return null;
  try {
    const allKws = JSON.parse(store.getItem('keywords') || '[]');
    return allKws
      .filter((k) => k.campaignId === campaignId)
      .find((k) => k.term.toLowerCase() === matchedKeyword.toLowerCase()) || null;
  } catch (e) {
    return null;
  }
}

function buildBrandGuidelinesBlock(campaign = {}) {
  const g = campaign.brandGuidelines || {};
  const parts = [];
  if (campaign.disallowedTopics?.trim()) {
    parts.push(`DISALLOWED TOPICS (never discuss): ${campaign.disallowedTopics}`);
  }
  if (g.dontList?.trim()) parts.push(`DO NOT: ${g.dontList}`);
  if (g.doList?.trim()) parts.push(`DO: ${g.doList}`);
  const samples = campaign.sampleMessages || g.sampleMessages;
  if (samples?.trim()) {
    parts.push(`STYLE EXAMPLES (emulate this voice):\n${samples}`);
  }
  if (campaign.affiliateLinks?.trim()) {
    parts.push(`AFFILIATE LINKS / USPs (mention when relevant): ${campaign.affiliateLinks}`);
  }
  return parts.length ? `\nBrand Guidelines:\n${parts.join('\n')}\n` : '';
}

function buildKeywordOverrideBlock(keywordObj) {
  if (!keywordObj) return '';
  let block = '';
  const intent = keywordObj.intent || 'mentions';
  if (INTENT_PROMPTS[intent]) {
    block += `\nKEYWORD INTENT (${INTENT_LABELS[intent] || intent}): ${INTENT_PROMPTS[intent]}\n`;
  }
  if (keywordObj.customPrompt?.trim()) {
    block += `\nCRITICAL OVERRIDE FOR KEYWORD '${keywordObj.term}':\n${keywordObj.customPrompt}\nYou MUST follow the instructions above when writing this specific reply.\n`;
  }
  if (keywordObj.platforms?.length) {
    block += `Platforms tracked for this keyword: ${keywordObj.platforms.join(', ')}\n`;
  }
  return block;
}

function buildReplySystemPrompt(campaign, options = {}) {
  const { keywordObj, oneTimeOverride, rules } = options;
  const guidelines = buildBrandGuidelinesBlock(campaign);
  const kwBlock = buildKeywordOverrideBlock(keywordObj);
  const rulesPrompt = rules?.customRulePrompt?.trim()
    ? `\nProject Custom Rules: ${rules.customRulePrompt}\n`
    : '';

  let userOverride = '';
  if (oneTimeOverride?.trim()) {
    userOverride = `\nIMMEDIATE USER OVERRIDE (HIGHEST PRIORITY):\n${oneTimeOverride}\n`;
  }

  return `You are the AI Brain for Social Imperialism. Write a tailored social reply for this specific post.

Brand Profile:
- Brand Name: ${campaign.brandName || 'Unknown'}
- Website/Domain: ${campaign.domain || 'Unknown'}
- Description: ${campaign.description || 'General business'}
- Target Audience: ${campaign.audience || 'Everyone'}
- Tone of Voice: ${campaign.tone || 'Professional & Authoritative'}
${guidelines}${rulesPrompt}${kwBlock}${userOverride}
Requirements:
- CRITICAL BRAND REQUIREMENT: Naturally include the brand name "${campaign.brandName || 'your brand'}" and reference "${campaign.domain || 'your domain'}" or the primary CTA in every reply unless the user override explicitly forbids it.
- Naturally includes your brand and key messages — never post a generic reply that omits the brand when engaging on behalf of this project.
- Match the brand tone exactly.
- Respect all disallowed topics and guidelines.
- Keep replies concise and engagement-optimized (max ~280 chars unless platform needs more).
- Return ONLY the reply text — no quotes or labels.

Safety: No NSFW, violence, hate, spam, or deceptive content.`;
}

module.exports = {
  INTENT_LABELS,
  INTENT_PROMPTS,
  getKeywordFromStore,
  buildBrandGuidelinesBlock,
  buildKeywordOverrideBlock,
  buildReplySystemPrompt,
};