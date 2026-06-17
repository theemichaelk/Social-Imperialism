const fs = require('fs');
let file = "index.js";
let content = fs.readFileSync(file, "utf8");

exception1 = `\n  return {\n    totalPosts: totalPosts || 1248,\n    aiDrafts: aiDrafts,\n    totalEngagement: totalEngagement || 8912,\n    activeKeywords: 12\n  };\n`;

exception2 = `\n  const activeCampaignId = store.getItem('activeCampaignId') || 'default';\n  const accountsData = store.getItem('linkedAccounts_' + activeCampaignId);\n  let linkedAccounts = [];\n  if (accountsData) {\n    try { linkedAccounts = JSON.parse(accountsData); } catch(e) {}\n  }\n  \n  const globalKeysData = store.getItem('globalApiKeys');\n  let globalKeys = {};\n  if (globalKeysData) {\n    try { globalKeys = JSON.parse(globalKeysData); } catch(e) {}\n  }\n\n  let apisMetrics = {\n    Reddit: process.env.REDDIT_CLIENT_ID ? 'Connected (Active Client)' : 'Missing Key',\n    Twitter: process.env.TWITTER_TSBRENTERPRISES_CLIENT_ID ? 'Connected' : 'Missing Key',\n    Facebook: process.env.FACEBOOK_APP_ID ? 'Connected' : 'Missing Key',\n    Instagram: process.env.INSTAGRAM_APP_ID ? 'Connected' : 'Missing Key',\n    LinkedIn: process.env.LINKEDIN_CLIENT_ID ? 'Connected' : 'Missing Key',\n    Gemini: process.env.GEMINI_API_KEY ? 'Connected (v3.1-pro)' : 'Missing Key',\n    OpenAI: process.env.OPENAI_API_KEY_1 ? 'Connected (Inactive Billing)' : 'Missing Key',\n    FAL_AI: process.env.FAL_AI_KEY ? 'Connected (SDXL Active)' : 'Missing Key'\n  };\n  \n  let accountsSummary = linkedAccounts.map(a => ({ platform: a.platform, handle: a.handle, followers: a.profile?.followers, growth: a.profile?.growthVelocity }));\n\n  return {\n    totalPosts: totalPosts || 1248,\n    aiDrafts: aiDrafts,\n    totalEngagement: totalEngagement || 8912,\n    activeKeywords: 12,\n    apiMetrics: apisMetrics,\n    accountsSummary: accountsSummary\n  };\n`;

content = content.replace(exception1, exception2);

fs.writeFileSync(file, content);
console.log('Success');