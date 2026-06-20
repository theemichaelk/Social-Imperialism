/**
 * Infographic generator — Grok text analysis + Grok Imagine visuals.
 */
const grokBrowser = require('./grokBrowserAutomation');
const { buildGrokPrompt } = require('./grokPromptBuilder');

function buildAnalysisPrompt(store, campaign, content, options = {}) {
  const built = buildGrokPrompt({
    store,
    campaign,
    content: content || options.topic || '',
    taskType: 'infographic',
    pageId: options.pageId,
    keywordTerm: options.keyword,
    platform: options.platform,
  });
  return built;
}

function buildImaginePrompt(content, analysisText, style = 'modern') {
  const visualHint = (analysisText || '').match(/VISUAL[:\s]+(.+)/i)?.[1] || '';
  const headline = (analysisText || '').match(/HEADLINE[:\s]+(.+)/i)?.[1] || content?.slice(0, 80) || 'Infographic';
  return `Professional ${style} infographic poster, 4:5 aspect ratio, clean typography, data charts and icons, high contrast, social media ready.
Topic: ${headline}
${visualHint}
Style: smart analysis dashboard, data-driven visual storytelling, precise labels, no watermark, no blurry text.`;
}

async function generateInfographic(store, userDataPath, payload = {}, getCampaignFn) {
  const content = payload.content || payload.topic || '';
  const style = payload.style || 'modern';
  const includeVideo = !!payload.includeVideo;

  let campaign = {};
  if (typeof getCampaignFn === 'function') {
    campaign = getCampaignFn(store) || {};
  } else {
    try {
      const activeId = store.getItem('activeCampaignId') || 'default';
      campaign = JSON.parse(store.getItem('campaigns') || '[]').find((c) => c.id === activeId) || {};
    } catch (e) {}
  }

  const built = buildAnalysisPrompt(store, campaign, content, payload);
  const analysisResult = await grokBrowser.askGrokText(store, userDataPath, built.prompt, {
    newChat: true,
    meta: {
      primaryKeyword: built.primaryKeyword,
      matchedKeywords: built.matchedKeywords,
      taskType: built.taskType,
    },
  });
  const analysisText = analysisResult.text || '';

  const imaginePrompt = buildImaginePrompt(content, analysisText, style);
  const imagineResult = await grokBrowser.generateGrokImagine(store, userDataPath, imaginePrompt);

  let videoAsset = null;
  if (includeVideo && imagineResult.success) {
    const videoPrompt = `${imaginePrompt} Short motion graphic loop, subtle animation, professional marketing video clip.`;
    const vidResult = await grokBrowser.generateGrokImagine(store, userDataPath, videoPrompt);
    videoAsset = vidResult.primaryAsset || null;
  }

  const caption = (analysisText.match(/CAPTION[:\s]+([\s\S]*?)(?=COLORS|VISUAL|$)/i)?.[1] || '').trim();
  const headline = (analysisText.match(/HEADLINE[:\s]+(.+)/i)?.[1] || '').trim();

  return {
    success: imagineResult.success !== false,
    analysis: analysisText,
    headline,
    caption,
    postText: [headline, caption].filter(Boolean).join('\n\n'),
    imageAsset: imagineResult.primaryAsset || null,
    imageAssets: imagineResult.assets || [],
    videoAsset,
    imaginePrompt,
    analysisPrompt,
    engine: 'grok-browser',
  };
}

module.exports = {
  buildAnalysisPrompt,
  buildImaginePrompt,
  generateInfographic,
};