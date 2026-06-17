const fs = require('fs');
let indexJs = fs.readFileSync('index.js', 'utf8');

// Also need to include social media API connection statuses in the dashboard
const replaceBlock2 = `
  const apiMetrics = {
      'Google Gemini': 'Disconnected',
      'OpenAI': 'Disconnected',
      'FAL Image AI': 'Disconnected',
      'DomDetailer': 'Disconnected',
      'Twitter API': 'Disconnected',
      'LinkedIn API': 'Disconnected',
      'Meta API': 'Disconnected'
  };

  const globalKeysData = store.getItem('globalApiKeys');
  if (globalKeysData) {
      try {
          const keys = JSON.parse(globalKeysData);
          if(keys.gemini) apiMetrics['Google Gemini'] = 'Connected';
          if(keys.openai) apiMetrics['OpenAI'] = 'Connected';
          if(keys.falKey) apiMetrics['FAL Image AI'] = 'Connected';
          if(keys.domDetailer) apiMetrics['DomDetailer'] = 'Connected';
          if(keys.twId) apiMetrics['Twitter API'] = 'Connected';
          if(keys.liId) apiMetrics['LinkedIn API'] = 'Connected';
          if(keys.fbId) apiMetrics['Meta API'] = 'Connected';
      } catch(e) {}
  }
  
  if (process.env.GEMINI_API_KEY) apiMetrics['Google Gemini'] = 'Connected';
  if (process.env.OPENAI_API_KEY_1) apiMetrics['OpenAI'] = 'Connected';
  if (process.env.FAL_KEY) apiMetrics['FAL Image AI'] = 'Connected';
  if (process.env.TWITTER_CLIENT_ID || process.env.TWITTER_THE_TECH_LAUNCHER_API_KEY) apiMetrics['Twitter API'] = 'Connected';

  return {
`;

indexJs = indexJs.replace(/const apiMetrics = \{[\s\S]*?return \{/, replaceBlock2);

fs.writeFileSync('index.js', indexJs, 'utf8');
console.log('Added social media APIs to metrics.');