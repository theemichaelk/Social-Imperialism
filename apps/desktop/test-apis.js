require('dotenv').config();
const axios = require('axios');
const { GoogleGenAI } = require('@google/genai');

async function testGemini() {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return { status: 'SKIPPED', msg: 'Missing GEMINI_API_KEY' };
  try {
    const ai = new GoogleGenAI({ apiKey: key });
    await ai.models.generateContent({ model: 'gemini-3.1-pro-preview', contents: 'Say hello' });
    return { status: 'SUCCESS', msg: 'Connected' };
  } catch (e) {
    return { status: 'FAILED', msg: e.message };
  }
}

async function runTests() {
  console.log("Starting API Validation...");
  const results = {
    Gemini: await testGemini()
  };
  console.table(results);
}

runTests();