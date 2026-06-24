/**
 * Imperial template styles → content types, Grok media strategy, and generation prompts.
 */

const IMPERIAL_TEMPLATE_IDS = [
  'promotional-design',
  'promotional-ai-image',
  'educational-carousel',
  'promotional-video',
  'educational-design',
  'quote-ai-image',
  'national-day-carousel',
  'national-day-design',
  'photo-highlight',
  'testimonial-ai-image',
  'thought-leadership',
  'thread',
];

const TEMPLATE_SPECS = {
  'promotional-design': {
    id: 'promotional-design',
    label: 'Promotional Design',
    contentType: 'post',
    grokText: true,
    grokVisual: false,
    prompt: (kw, v) => `Write a bold promotional social post with branded layout cues in the copy (headline + offer + CTA). Keywords: ${kw}. Variant ${v + 1}. Short paragraphs, hashtags at end.`,
  },
  'promotional-ai-image': {
    id: 'promotional-ai-image',
    label: 'Promotional AI Image',
    contentType: 'image',
    grokText: true,
    grokVisual: true,
    visualPrompt: (kw, text) => `Eye-catching promotional social image for ${kw}. Conversion-focused visual, bold typography zone, vibrant brand colors. ${(text || '').slice(0, 100)}`,
    prompt: (kw, v) => `Write short conversion copy + image art direction for a promotional AI image post. Keywords: ${kw}. Variant ${v + 1}. Hook in first line.`,
  },
  'educational-carousel': {
    id: 'educational-carousel',
    label: 'Educational Carousel',
    contentType: 'carousel',
    grokText: true,
    grokVisual: true,
    visualPrompt: (kw) => `Carousel cover slide — educational tips about ${kw}. Clean layout, numbered slide 1, modern social design.`,
    prompt: (kw, v) => `Create a 4-slide educational carousel script: Slide 1 hook, Slides 2-4 tips, final CTA. Keywords: ${kw}. Variant ${v + 1}. Label each slide.`,
  },
  'promotional-video': {
    id: 'promotional-video',
    label: 'Promotional Video',
    contentType: 'video',
    grokText: true,
    grokVisual: true,
    grokVideo: true,
    visualPrompt: (kw) => `Cinematic promotional video opening frame about ${kw}. Vertical 9:16, dynamic motion-ready scene.`,
    prompt: (kw, v) => `Write a viral reel/video script (hook + 3 beats + CTA) and caption. Keywords: ${kw}. Variant ${v + 1}. Under 60 seconds spoken.`,
  },
  'educational-design': {
    id: 'educational-design',
    label: 'Educational Design',
    contentType: 'infographic',
    grokText: true,
    grokVisual: true,
    grokInfographic: true,
    prompt: (kw, v) => `Create infographic copy: headline, 5 data bullets, caption. Keywords: ${kw}. Variant ${v + 1}.`,
  },
  'quote-ai-image': {
    id: 'quote-ai-image',
    label: 'Quote AI Image',
    contentType: 'image',
    grokText: true,
    grokVisual: true,
    visualPrompt: (kw, text) => `Elegant quote card image. Authority quote style. Keywords: ${kw}. ${(text || '').slice(0, 80)}`,
    prompt: (kw, v) => `Write an authority quote post: the quote, attribution line, and 1-line context. Keywords: ${kw}. Variant ${v + 1}.`,
  },
  'national-day-carousel': {
    id: 'national-day-carousel',
    label: 'National Day Carousel',
    contentType: 'carousel',
    grokText: true,
    grokVisual: true,
    visualPrompt: (kw) => `National day / awareness carousel cover. Timely, celebratory design for ${kw}.`,
    prompt: (kw, v) => `Create a national day / awareness carousel (4 slides) tied to keywords: ${kw}. Variant ${v + 1}.`,
  },
  'national-day-design': {
    id: 'national-day-design',
    label: 'National Day Design',
    contentType: 'image',
    grokText: true,
    grokVisual: true,
    visualPrompt: (kw) => `Single-image national day observance post visual for ${kw}. Seasonal, respectful, on-brand.`,
    prompt: (kw, v) => `Write copy for a national day / seasonal single-image post. Keywords: ${kw}. Variant ${v + 1}.`,
  },
  'photo-highlight': {
    id: 'photo-highlight',
    label: 'Photo Highlight',
    contentType: 'image',
    grokText: true,
    grokVisual: true,
    visualPrompt: (kw) => `Lifestyle behind-the-scenes photo highlight for ${kw}. Authentic, warm lighting, social-ready.`,
    prompt: (kw, v) => `Write a lifestyle / BTS photo highlight caption. Keywords: ${kw}. Variant ${v + 1}. Conversational.`,
  },
  'testimonial-ai-image': {
    id: 'testimonial-ai-image',
    label: 'Testimonial AI Image',
    contentType: 'image',
    grokText: true,
    grokVisual: true,
    visualPrompt: (kw, text) => `Social proof testimonial card with quote overlay. Keywords: ${kw}. ${(text || '').slice(0, 60)}`,
    prompt: (kw, v) => `Write a testimonial post: customer quote, name/role placeholder, social proof angle. Keywords: ${kw}. Variant ${v + 1}.`,
  },
  'thought-leadership': {
    id: 'thought-leadership',
    label: 'Thought Leadership',
    contentType: 'post',
    grokText: true,
    grokVisual: false,
    prompt: (kw, v) => `Write a thought leadership LinkedIn-style insight post. Keywords: ${kw}. Variant ${v + 1}. Professional but human, no buzzword soup.`,
  },
  thread: {
    id: 'thread',
    label: 'Thread / X',
    contentType: 'thread',
    grokText: true,
    grokVisual: false,
    prompt: (kw, v) => `Write a 5-part numbered thread for X/Twitter about: ${kw}. Variant ${v + 1}. Each tweet under 280 chars.`,
  },
};

function getTemplateSpec(templateId) {
  return TEMPLATE_SPECS[templateId] || TEMPLATE_SPECS['promotional-design'];
}

function templateIdsToContentTypes(templateIds) {
  const types = new Set();
  (templateIds || []).forEach((id) => {
    const spec = getTemplateSpec(id);
    if (spec) types.add(spec.contentType);
  });
  return [...types];
}

module.exports = {
  IMPERIAL_TEMPLATE_IDS,
  TEMPLATE_SPECS,
  getTemplateSpec,
  templateIdsToContentTypes,
};