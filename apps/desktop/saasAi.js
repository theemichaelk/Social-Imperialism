/**
 * Standalone AI generation for SaaS (extracted from index.js).
 */
require('dotenv').config();
const axios = require('axios');
const { resolveKeys } = require('./services/keys');

let latestModelName = 'gemini-2.0-flash';

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

  return { generateAI };
}

module.exports = { createAiEngine };