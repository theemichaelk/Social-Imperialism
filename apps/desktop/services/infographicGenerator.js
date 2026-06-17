/**
 * Infographic generator — Grok text analysis + Grok Imagine visuals.
 */
const grokBrowser = require('./grokBrowserAutomation');

function buildAnalysisPrompt(content, options = {}) {
  const topic = options.topic || content?.slice(0, 200) || 'the subject';
  return `You are a data visualization expert. Analyze this content and produce infographic copy.

CONTENT:
${content || topic}

Return:
1) A catchy infographic headline (max 12 words)
2) 4-6 bullet data insights with specific numbers or percentages where possible
3) A short caption for social media (max 280 chars)
4) Color palette suggestion (3 hex colors)
5) One-sentence visual layout description for an AI image generator

Format as plain text sections labeled HEADLINE, INSIGHTS, CAPTION, COLORS, VISUAL.`;
}

function buildImaginePrompt(content, analysisText, style = 'modern') {
  const visualHint = (analysisText || '').match(/VISUAL[:\s]+(.+)/i)?.[1] || '';
  const headline = (analysisText || '').match(/HEADLINE[:\s]+(.+)/i)?.[1] || content?.slice(0, 80) || 'Infographic';
  return `Professional ${style} infographic poster, 4:5 aspect ratio, clean typography, data charts and icons, high contrast, social media ready.
Topic: ${headline}
${visualHint}
Style: smart analysis dashboard, data-driven visual storytelling, precise labels, no watermark, no blurry text.`;
}

async function generateInfographic(store, userDataPath, payload = {}) {
  const content = payload.content || payload.topic || '';
  const style = payload.style || 'modern';
  const includeVideo = !!payload.includeVideo;

  const analysisPrompt = buildAnalysisPrompt(content, payload);
  const analysisResult = await grokBrowser.askGrokText(store, userDataPath, analysisPrompt, { newChat: true });
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