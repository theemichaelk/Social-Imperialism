const fs = require('fs');
let file = "index.js";
let content = fs.readFileSync(file, "utf8");

// Change default latest model name
content = content.replace(/let latestModelName = \"gemini-1\\.5-pro\"; \/\/ fallback/g, `let latestModelName = "gemini-3.1-pro-preview"; // fallback`);

fs.writeFileSync(file, content);
console.log('Success');