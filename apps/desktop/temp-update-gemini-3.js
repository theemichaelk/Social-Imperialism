const fs = require('fs');
let indexJs = fs.readFileSync('index.js', 'utf8');

// Update fallback model
const fallbackRegex = /let latestModelName = "gemini-1\.5-pro"; \/\/ fallback/;
if (indexJs.match(fallbackRegex)) {
    indexJs = indexJs.replace(fallbackRegex, 'let latestModelName = "gemini-3.1-pro"; // fallback');
    console.log("Updated fallback model name to gemini-3.1-pro");
}

// In getLatestGeminiModel, the logic tries to find the highest number model.
// If the user wants specifically gemini-3.1-pro, we should just force it there.
const getLatestRegex = /async function getLatestGeminiModel\(\) \{[\s\S]*?\} catch\(e\) \{/m;

const newGetLatest = `async function getLatestGeminiModel() {
  const geminiKey = getGlobalKey('gemini') || GEMINI_API_KEY;
  if (!geminiKey) return;
  
  try {
    latestModelName = "gemini-3.1-pro";
    console.log("Forced Gemini model to: " + latestModelName);
  } catch(e) {`;

if (indexJs.match(getLatestRegex)) {
    indexJs = indexJs.replace(getLatestRegex, newGetLatest);
    console.log("Updated getLatestGeminiModel to force gemini-3.1-pro");
}

fs.writeFileSync('index.js', indexJs, 'utf8');
console.log("Successfully updated Gemini model to gemini-3.1-pro in index.js");