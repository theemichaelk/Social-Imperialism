const fs = require('fs');
let file = "index.js";
let content = fs.readFileSync(file, "utf8");

// Fix getGlobalKey() to just return env variables instead
content = content.replace(/function getGlobalKey\\(keyName\\) {[\\S\\s]*?}/g, `function getGlobalKey(keyName) {\n  const keyMap = {\n    'domDetailer': process.env.DOMDETAILER_API_KEY || 'ERCHSWC16KHS6',\n    "gemini": process.env.GEMINI_API_KEY,\n    "openai": process.env.OPENAI_API_KEY11,\n    "falKey": process.env.FAL_KIEY,\n    "pexelsKey": process.env.PEXELS_API_KEY,\n    "pixabayKey": process.env.PIXABAY_API_KEY,\n    "flickrKey": process.env.FLICKR_API_KEY,\n    "slackWebhook": process.env.SLACK_WEBHOOK,\n    "discordWebhook": process.env.DISCORD_WEBHOOK,\n    "ytId": process.env.YOUTUBE_CLIENT_ID,\n    "twId": process.env.TWITTER_TSBRENTERPRISES_CLIENT_ID,\n    "liId": process.env.LINKEDIN_CLIENT_ID,\n    "fbId": process.env.META_APP_ID,\n    "tkId": process.env.TIKTOK_CLIENT_KEY,\n    "rdId": process.env.REDDIT_CLIENT_ID\n  };\n  return keyMap[keyName] || "";\n}`);

fs.writeFileSync(file, content);
console.log('Success');