const fs = require('fs');
let file = "index.js";
let content = fs.readFileSync(file, "utf8");

// 1. Separate Meta App into Facebook & Instagram
content = content.replace(/\'fnId\': process.env.META_APP_ID,/g, `'fbId': process.env.FACEBOOK_APP_ID,\n    'igId': process.env.INSTAGRAM_APP_ID,`);

// 2. Update OAuth Urls
content = content.replace(/\\${globalKeys\\.fbId \\|\\| process\\.env\\.META_APP_ID}/g, '${globalKeys.fbId || process.env.FACEBOOK_APP_ID}');
content = content.replace(/\\${globalKeys\\.fbId \\|\\| process\\.env\\.META_APP_ID}/g, '${globalKeys.igId || process.env.INSTAGRAM_APP_ID}');

// 3. Fix Reddit Fallback logic in get-simulated-feed
content = content.replace(/console.error\\(\"Reddit fetch failed: \", e.message\\);/g, `console.error("Reddit fetch failed: ", e.message);\n            console.log("Falling back to AI Simulated Feed for Reddit.");`);

fs.writeFileSync(file, content);
console.log('Success');