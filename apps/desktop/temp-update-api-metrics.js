const fs = require('fs');

let indexJs = fs.readFileSync('index.js', 'utf8');

// I need to update get-dashboard-stats in index.js to actually check the API keys
// instead of returning mocked or undefined data for apiMetrics.

const replaceBlock = `
  const aiDraftsData = store.getItem('aiDraftsCount');
  if (aiDraftsData) {
    try { aiDrafts = parseInt(aiDraftsData); } catch(e) {}
  } else {
    aiDrafts = 342; // default mock if not set
  }

  // Evaluate real API Keys status
  const apiMetrics = {
      'Google Gemini': 'Disconnected',
      'OpenAI': 'Disconnected',
      'FAL Image AI': 'Disconnected',
      'NewsAPI': 'Disconnected',
      'DomDetailer': 'Disconnected',
      'Pexels/Flickr': 'Disconnected'
  };

  const globalKeysData = store.getItem('globalApiKeys');
  if (globalKeysData) {
      try {
          const keys = JSON.parse(globalKeysData);
          if(keys.gemini) apiMetrics['Google Gemini'] = 'Connected';
          if(keys.openai) apiMetrics['OpenAI'] = 'Connected';
          if(keys.falKey) apiMetrics['FAL Image AI'] = 'Connected';
          if(keys.domDetailer) apiMetrics['DomDetailer'] = 'Connected';
          if(keys.pexelsKey || keys.flickrKey || keys.pixabayKey) apiMetrics['Pexels/Flickr'] = 'Connected';
      } catch(e) {}
  }
  
  if (process.env.GEMINI_API_KEY) apiMetrics['Google Gemini'] = 'Connected';
  if (process.env.OPENAI_API_KEY_1) apiMetrics['OpenAI'] = 'Connected';
  if (process.env.FAL_KEY) apiMetrics['FAL Image AI'] = 'Connected';
  if (process.env.NEWS_API_KEY) apiMetrics['NewsAPI'] = 'Connected';

  return {
    totalPosts: totalPosts || 1248, // fallback to mock if empty
    aiDrafts: aiDrafts,
    totalEngagement: totalEngagement || 8912, // fallback to mock if empty
    activeKeywords: 12,
    apiMetrics: apiMetrics
  };
`;

indexJs = indexJs.replace(/const aiDraftsData = store\.getItem\('aiDraftsCount'\);[\s\S]*?activeKeywords: 12\n  \};/, replaceBlock);

fs.writeFileSync('index.js', indexJs, 'utf8');
console.log('Updated get-dashboard-stats to include real apiMetrics.');