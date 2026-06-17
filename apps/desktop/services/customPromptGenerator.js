const brandGuidelines = require('./brandGuidelines');

function buildGlobalCustomPromptRequest(campaign, keywords = [], monitors = []) {
  const kwList = keywords.slice(0, 12).map((k) => {
    const plats = (k.platforms || []).join(', ') || 'All';
    const intent = k.intent || 'mentions';
    const extra = k.customPrompt ? ` — note: ${k.customPrompt}` : '';
    return `- "${k.term}" (${intent}, ${plats})${extra}`;
  }).join('\n');

  const watchList = monitors.slice(0, 8).map((m) =>
    `- ${m.type || m.target || 'keyword'}: "${m.term}" on ${m.platform || 'All'}`
  ).join('\n');

  const guidelines = brandGuidelines.buildBrandGuidelinesBlock(campaign);

  return `You are a senior brand strategist for Social Imperialism's AI reply engine.

Create a GLOBAL CUSTOM PROMPT that will guide ALL AI replies mentioning this brand across social platforms.

Brand Profile:
- Name: ${campaign.brandName || 'Unknown'}
- Domain: ${campaign.domain || 'unknown'}
- Description: ${campaign.description || 'N/A'}
- Audience: ${campaign.audience || 'General'}
- Tone: ${campaign.tone || 'professional'}
${guidelines}
Tracked Keywords:
${kwList || '(none yet — infer from brand description)'}

Be-First Monitors (reply fast when these appear):
${watchList || '(none yet)'}

Write ONE cohesive global custom prompt (4–8 bullet-style rules, plain text, no markdown headers) that:
1. Defines brand voice and how to naturally mention "${campaign.brandName || 'the brand'}" and "${campaign.domain || 'the domain'}"
2. Lists key messages, USPs, and affiliate/CTA guidance when relevant
3. Sets do/don't rules for tone, length, and promotional balance (helpful first, sales second)
4. Includes platform-agnostic reply etiquette (no spam, no competitor bashing)
5. References monitoring priorities if keywords/monitors were provided

Return ONLY the global custom prompt text — ready to paste into a settings field. No preamble.`;
}

module.exports = { buildGlobalCustomPromptRequest };