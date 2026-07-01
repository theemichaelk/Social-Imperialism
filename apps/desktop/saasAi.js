/**
 * Standalone AI generation for SaaS (extracted from index.js).
 */
require('dotenv').config();
const axios = require('axios');
const { resolveKeys } = require('./services/keys');

let latestModelName = 'gemini-2.0-flash';

/** SaaS margin protection — downshift premium models per THEE_MICHAEL protocol */
const SAAS_MODEL_DOWNSCALE = {
  'anthropic/claude-3.5-sonnet': 'anthropic/claude-3-haiku',
  'anthropic/claude-3-opus': 'anthropic/claude-3-haiku',
  'openai/gpt-4o': 'openai/gpt-4o-mini',
  'openai/gpt-4': 'openai/gpt-4o-mini',
  'openai-direct': 'openai/gpt-4o-mini',
};

function resolveSaasModel(modelId) {
  const id = modelId || 'gemini';
  if (id === 'gemini' || id === 'grok-browser') return id;
  return SAAS_MODEL_DOWNSCALE[id] || id;
}

function createAiEngine(store) {
  const getGlobalKey = (key) => {
    try {
      const keys = JSON.parse(store.getItem('globalApiKeys') || '{}');
      return keys[key];
    } catch (e) { return null; }
  };

  async function generateAI(prompt) {
    let brandContext = '';
    try {
      const activeCampaignId = store.getItem('activeCampaignId');
      const campsData = store.getItem('campaigns');
      if (campsData && activeCampaignId) {
        const camps = JSON.parse(campsData);
        const camp = camps.find((c) => c.id === activeCampaignId);
        if (camp) {
          brandContext = `BRAND: ${camp.brandName || ''} | ${camp.domain || ''} | ${camp.description || ''} | Tone: ${camp.tone || 'professional'}\n`;
        }
      }
    } catch (e) { /* ignore */ }

    const finalPrompt = brandContext + '\n\n' + prompt;
    const keys = resolveKeys(JSON.parse(store.getItem('globalApiKeys') || '{}'));
    const openrouterKey = keys.openrouter || process.env.OPENROUTER_API_KEY;
    const geminiKey = keys.gemini || process.env.GEMINI_API_KEY;

    if (openrouterKey) {
      try {
        const res = await axios.post('https://openrouter.ai/api/v1/chat/completions', {
          model: 'openai/gpt-4o-mini',
          messages: [{ role: 'user', content: finalPrompt }],
        }, {
          headers: {
            Authorization: `Bearer ${openrouterKey}`,
            'Content-Type': 'application/json',
            'HTTP-Referer': 'https://socialimperialism.app',
            'X-Title': 'Social Imperialism SaaS',
          },
          timeout: 60000,
        });
        return res.data.choices[0].message.content;
      } catch (e) {
        console.error('OpenRouter error:', e.message);
      }
    }

    if (!geminiKey) throw new Error('No AI API key configured.');
    const models = [...new Set([latestModelName, 'gemini-2.0-flash', 'gemini-1.5-flash'])];
    for (const model of models) {
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiKey}`;
        const res = await axios.post(url, {
          contents: [{ parts: [{ text: finalPrompt }] }],
        }, { timeout: 60000 });
        const text = res.data?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (text) { latestModelName = model; return text; }
      } catch (e) {
        console.warn(`Gemini ${model}:`, e.message);
      }
    }
    throw new Error('AI generation failed');
  }

  async function generateAIVision(imageUrl, prompt) {
    let brandContext = '';
    try {
      const activeCampaignId = store.getItem('activeCampaignId');
      const campsData = store.getItem('campaigns');
      if (campsData && activeCampaignId) {
        const camps = JSON.parse(campsData);
        const camp = camps.find((c) => c.id === activeCampaignId);
        if (camp) {
          brandContext = `BRAND: ${camp.brandName || ''} | Tone: ${camp.tone || 'professional'}\n`;
        }
      }
    } catch (e) { /* ignore */ }

    const finalPrompt = brandContext + prompt;
    const keys = resolveKeys(JSON.parse(store.getItem('globalApiKeys') || '{}'));
    const openrouterKey = keys.openrouter || process.env.OPENROUTER_API_KEY;
    const geminiKey = keys.gemini || process.env.GEMINI_API_KEY;

    if (openrouterKey) {
      try {
        const res = await axios.post('https://openrouter.ai/api/v1/chat/completions', {
          model: 'openai/gpt-4o-mini',
          messages: [{
            role: 'user',
            content: [
              { type: 'text', text: finalPrompt },
              { type: 'image_url', image_url: { url: imageUrl } },
            ],
          }],
        }, {
          headers: {
            Authorization: `Bearer ${openrouterKey}`,
            'Content-Type': 'application/json',
            'HTTP-Referer': 'https://socialimperialism.app',
            'X-Title': 'Social Imperialism SaaS',
          },
          timeout: 90000,
        });
        return res.data.choices[0].message.content;
      } catch (e) {
        console.error('OpenRouter vision error:', e.message);
      }
    }

    if (!geminiKey) throw new Error('No AI API key configured for vision.');
    const match = String(imageUrl).match(/^data:([^;]+);base64,(.+)$/);
    if (!match) throw new Error('Vision requires a data URL image (upload to library first).');
    const mime = match[1];
    const data = match[2];
    const models = ['gemini-2.0-flash', 'gemini-1.5-flash'];
    for (const model of models) {
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiKey}`;
        const res = await axios.post(url, {
          contents: [{
            parts: [
              { text: finalPrompt },
              { inline_data: { mime_type: mime, data } },
            ],
          }],
        }, { timeout: 90000 });
        const text = res.data?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (text) return text;
      } catch (e) {
        console.warn(`Gemini vision ${model}:`, e.message);
      }
    }
    throw new Error('Vision analysis failed');
  }

  async function generateAIWithModel(prompt, modelId = 'gemini') {
    const resolved = resolveSaasModel(modelId);
    if (resolved === 'grok-browser') {
      throw new Error('Grok browser automation is only available in the desktop app.');
    }

    let brandContext = '';
    try {
      const activeCampaignId = store.getItem('activeCampaignId');
      const campsData = store.getItem('campaigns');
      if (campsData && activeCampaignId) {
        const camps = JSON.parse(campsData);
        const camp = camps.find((c) => c.id === activeCampaignId);
        if (camp) {
          brandContext = `BRAND: ${camp.brandName || ''} | ${camp.domain || ''} | Tone: ${camp.tone || 'professional'}\n`;
        }
      }
    } catch (e) { /* ignore */ }

    const finalPrompt = brandContext + prompt;
    const keys = resolveKeys(JSON.parse(store.getItem('globalApiKeys') || '{}'));
    const geminiKey = keys.gemini || process.env.GEMINI_API_KEY;
    const openaiKey = keys.openai || process.env.OPENAI_API_KEY;
    const openrouterKey = keys.openrouter || process.env.OPENROUTER_API_KEY;

    if (resolved === 'openai-direct' && openaiKey) {
      const res = await axios.post('https://api.openai.com/v1/chat/completions', {
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: finalPrompt }],
      }, { headers: { Authorization: `Bearer ${openaiKey}`, 'Content-Type': 'application/json' }, timeout: 60000 });
      return res.data.choices[0].message.content;
    }

    if (resolved.includes('/') && openrouterKey) {
      const res = await axios.post('https://openrouter.ai/api/v1/chat/completions', {
        model: resolved,
        messages: [{ role: 'user', content: finalPrompt }],
      }, {
        headers: {
          Authorization: `Bearer ${openrouterKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://socialimperialism.app',
          'X-Title': 'Social Imperialism SaaS',
        },
        timeout: 60000,
      });
      return res.data.choices[0].message.content;
    }

    if (openrouterKey && resolved !== 'gemini') {
      const res = await axios.post('https://openrouter.ai/api/v1/chat/completions', {
        model: resolved || 'openai/gpt-4o-mini',
        messages: [{ role: 'user', content: finalPrompt }],
      }, {
        headers: {
          Authorization: `Bearer ${openrouterKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://socialimperialism.app',
          'X-Title': 'Social Imperialism SaaS',
        },
        timeout: 60000,
      });
      return res.data.choices[0].message.content;
    }

    return generateAI(prompt);
  }

  return { generateAI, generateAIVision, generateAIWithModel };
}

module.exports = { createAiEngine };