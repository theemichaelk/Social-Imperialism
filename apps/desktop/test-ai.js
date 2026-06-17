require('dotenv').config();
const { GoogleGenerativeAI } = require('@google/generative-ai');

async function testEngine() {
    const aiKey = process.env.GEMINI_API_KEY;
    if (!aiKey) return console.error('No Gemini Key in env!');
    
    const genAI = new GoogleGenerativeAI(aiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

    const prompt = \`You are an expert Social Media Manager representing a brand.
Your goal is to reply to a social media post naturally and authentically.
Base your tone on the brand details, but prioritize any custom instructions below.

**Custom Override Instructions (CRITICAL):**
Focus on explaining our free trial and avoid hard selling.

**Brand Context:**
Brand Name: Social Imperialism
Keyword that triggered this: automation
**The Post to Reply To:**"I'm looking for a new CRM that actually has good automation. Any recommendations?"
\
Write a short, engaging reply (under 280 chars if possible). Do not include quotes around the reply.`;

    console.log('SENDING PROMPT:\n' + prompt);
    console.log('------------------------');
    
    try {
        const result = await model.generateContent(prompt);
        const response = await result.response;
        console.log('AI REPLY ENGINE OUTPUT:\n' + response.text());
    } catch(e) {
        console.error('AI Error:', e);
    }
}

testEngine();
