const SEED_TEMPLATES = [
  { id: 'promo-bold', label: 'Bold Promo', layout: 'headline-image-cta', slots: ['headline', 'image', 'body', 'cta'], gradient: ['#1e3a5f', '#2563eb'], accent: '#38bdf8' },
  { id: 'quote-card', label: 'Quote Card', layout: 'quote-overlay', slots: ['quote', 'attribution', 'image'], gradient: ['#312e81', '#6366f1'], accent: '#818cf8' },
  { id: 'edu-carousel', label: 'Educational Slide', layout: 'title-bullets', slots: ['headline', 'bullet1', 'bullet2', 'bullet3', 'image'], gradient: ['#134e4a', '#0d9488'], accent: '#2dd4bf' },
  { id: 'testimonial', label: 'Testimonial', layout: 'testimonial-image', slots: ['quote', 'name', 'image'], gradient: ['#0c4a6e', '#0284c7'], accent: '#7dd3fc' },
  { id: 'thought-leader', label: 'Thought Leadership', layout: 'text-only', slots: ['headline', 'body'], gradient: ['#1e293b', '#334155'], accent: '#94a3b8' },
];

function templatesKey(store) {
  const activeId = store.getItem('activeCampaignId') || 'default';
  return `designTemplates_${activeId}`;
}

function getUserTemplates(store) {
  try {
    return JSON.parse(store.getItem(templatesKey(store)) || '[]');
  } catch (e) {
    return [];
  }
}

function saveUserTemplates(store, templates) {
  store.setItem(templatesKey(store), JSON.stringify(templates));
}

function registerDesignStudioHandlers({ ipcMain, store, generateAI, generateImage }) {
  const { getLibrary } = require('./contentLibraryIpc');

  const channels = [
    'get-design-templates',
    'save-design-template',
    'delete-design-template',
    'render-design-post',
    'generate-from-library-assets',
  ];
  channels.forEach((ch) => {
    try { ipcMain.removeHandler(ch); } catch (e) { /* noop */ }
  });

  ipcMain.handle('get-design-templates', () => {
    const user = getUserTemplates(store);
    const seeds = SEED_TEMPLATES.map((t) => ({ ...t, builtin: true }));
    return { success: true, templates: [...user, ...seeds] };
  });

  ipcMain.handle('save-design-template', (event, payload = {}) => {
    const user = getUserTemplates(store);
    const idx = user.findIndex((t) => t.id === payload.id);
    const template = {
      id: payload.id || `tpl_${Date.now()}`,
      label: payload.label || 'Custom Template',
      layout: payload.layout || 'headline-image-cta',
      slots: payload.slots || ['headline', 'body', 'image'],
      fields: payload.fields || {},
      gradient: payload.gradient || ['#1e3a5f', '#2563eb'],
      accent: payload.accent || '#38bdf8',
      builtin: false,
      updatedAt: new Date().toISOString(),
    };
    if (idx >= 0) user[idx] = { ...user[idx], ...template };
    else user.unshift(template);
    saveUserTemplates(store, user.slice(0, 100));
    return { success: true, template };
  });

  ipcMain.handle('delete-design-template', (event, { id } = {}) => {
    const user = getUserTemplates(store).filter((t) => t.id !== id);
    saveUserTemplates(store, user);
    return { success: true };
  });

  ipcMain.handle('render-design-post', async (event, { templateId, fields = {}, assetIds = [] } = {}) => {
    const all = [...getUserTemplates(store), ...SEED_TEMPLATES];
    const template = all.find((t) => t.id === templateId);
    if (!template) return { success: false, error: 'Template not found' };

    const lib = getLibrary(store);
    const assets = assetIds.length
      ? lib.filter((a) => assetIds.includes(a.id))
      : lib.filter((a) => a.type === 'image').slice(0, 1);

    const imageUrl = fields.image || assets.find((a) => a.url)?.url || null;
    const headline = fields.headline || fields.quote || 'Your headline';
    const body = fields.body || fields.bullet1 || '';
    const captionParts = [headline, body, fields.cta, fields.attribution].filter(Boolean);

    let caption = captionParts.join('\n\n');
    if (generateAI && fields.useAiCaption !== false) {
      try {
        caption = await generateAI(
          `Write a social media caption using this design content. Headline: ${headline}. Body: ${body}. CTA: ${fields.cta || ''}. Keep on-brand, not generic. Include 3 hashtags.`,
        );
      } catch (e) { /* keep manual */ }
    }

    return {
      success: true,
      post: {
        id: `design_${Date.now()}`,
        type: 'image',
        templateId,
        headline,
        content: String(caption || '').trim(),
        mediaUrl: imageUrl,
        hasMedia: !!imageUrl,
        fields,
        assetIds: assets.map((a) => a.id),
        status: 'draft',
      },
    };
  });

  ipcMain.handle('generate-from-library-assets', async (event, payload = {}) => {
    const { assetIds = [], keywords = [], templateId, formatTemplateId, model, generateNewImage } = payload;

    if (formatTemplateId) {
      const { recreateFromFormatTemplate } = require('./imageFormatIntelligence');
      const topics = Array.isArray(keywords) ? keywords : String(keywords).split(/[,\n]+/).map((s) => s.trim()).filter(Boolean);
      const topic = topics[0] || 'brand content';
      const recreated = await recreateFromFormatTemplate({
        store,
        generateAI,
        generateImage,
        templateId: formatTemplateId,
        keyword: topic,
        generateNewImage: generateNewImage !== false,
      });
      if (!recreated.success) return recreated;
      return {
        success: true,
        items: [{ ...recreated.post, model: model || 'gemini' }],
        count: 1,
      };
    }

    const lib = getLibrary(store);
    const assets = lib.filter((a) => assetIds.includes(a.id));
    if (!assets.length && !keywords.length) {
      return { success: false, error: 'Select library assets or enter topics' };
    }

    const topics = Array.isArray(keywords) ? keywords : String(keywords).split(/[,\n]+/).map((s) => s.trim()).filter(Boolean);
    const copyAssets = assets.filter((a) => a.type === 'copy' || a.text);
    const imageAssets = assets.filter((a) => a.type === 'image' && a.url);
    const studiedAsset = imageAssets.find((a) => a.formatTemplateId);
    const context = copyAssets.map((a) => a.text).join('\n').slice(0, 1500);
    const topicStr = topics.join(', ') || 'brand content';

    if (studiedAsset?.formatTemplateId && generateImage) {
      const { recreateFromFormatTemplate } = require('./imageFormatIntelligence');
      const recreated = await recreateFromFormatTemplate({
        store,
        generateAI,
        generateImage,
        templateId: studiedAsset.formatTemplateId,
        keyword: topicStr,
        generateNewImage: generateNewImage !== false,
      });
      if (recreated.success) {
        return { success: true, items: [{ ...recreated.post, model: model || 'gemini' }], count: 1 };
      }
    }

    const analysisContext = imageAssets
      .filter((a) => a.imageAnalysis)
      .map((a) => `Image "${a.name}": ${a.imageAnalysis?.content?.whatItSays || ''} | Category: ${a.imageAnalysis?.category?.primary || ''} | Psychology: ${a.imageAnalysis?.psychology?.engagementStyle || ''}`)
      .join('\n');

    let caption = '';
    if (generateAI) {
      caption = await generateAI(
        `Create a social post caption from these library assets and topics.\nTopics: ${topicStr}\nLibrary copy:\n${context}\nStudied image formats:\n${analysisContext}\nUse brand voice. Include hashtags.`,
      );
    } else {
      caption = `${topicStr}\n\n${context}`.trim();
    }

    let imageUrl = imageAssets[0]?.url || null;
    const studied = imageAssets.find((a) => a.imageAnalysis?.recreationPrompt);
    if (studied?.imageAnalysis?.recreationPrompt && generateImage && generateNewImage !== false) {
      const imgRes = await generateImage(`${studied.imageAnalysis.recreationPrompt}. Topic: ${topicStr}`);
      if (imgRes?.imageUrl) imageUrl = imgRes.imageUrl;
    }

    const all = [...getUserTemplates(store), ...SEED_TEMPLATES];
    const template = all.find((t) => t.id === templateId) || SEED_TEMPLATES[0];

    return {
      success: true,
      items: [{
        id: `libgen_${Date.now()}`,
        type: imageUrl ? 'image' : 'post',
        templateId: template.id,
        content: String(caption).trim(),
        mediaUrl: imageUrl,
        hasMedia: !!imageUrl,
        keywords: topicStr,
        model: model || 'gemini',
        status: 'draft',
      }],
      count: 1,
    };
  });
}

module.exports = { registerDesignStudioHandlers, SEED_TEMPLATES };