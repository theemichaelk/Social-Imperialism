const fs = require('fs');
let html = fs.readFileSync('dashboard.html', 'utf8');

// There are multiple script blocks inside dashboard.html, separated by bad </script> <script> pairs that break things.
// We just need to find all script blocks, merge them cleanly into ONE script block, and remove any inner <script> tags.

// Extract chart.js link specifically
let cleanHtml = html;
if (cleanHtml.includes('<script src="https://cdn.jsdelivr.net/npm/chart.js"></script>')) {
    cleanHtml = cleanHtml.replace('<script src="https://cdn.jsdelivr.net/npm/chart.js"></script>', '[[CHART_JS_LINK]]');
}

// Extract all raw script text
let allScriptText = '';
const scriptRegex = /<script>([\s\S]*?)<\/script>/g;
let match;
while ((match = scriptRegex.exec(cleanHtml)) !== null) {
    allScriptText += match[1] + '\n';
}

// Remove all script blocks from HTML body
cleanHtml = cleanHtml.replace(scriptRegex, '');

// Re-inject script properly before </body>
const finalScriptBlock = `
<script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
<script>
${allScriptText}
</script>
</body>
`;

cleanHtml = cleanHtml.replace('[[CHART_JS_LINK]]', ''); // clean up placeholder if it was left
cleanHtml = cleanHtml.replace('</body>', finalScriptBlock);

fs.writeFileSync('dashboard.html', cleanHtml, 'utf8');
console.log('Cleaned and merged all scripts in dashboard.html');

let hist = fs.readFileSync('history.html', 'utf8');
let histHtml = hist;
if (histHtml.includes('<script src="https://cdn.jsdelivr.net/npm/chart.js"></script>')) {
    histHtml = histHtml.replace('<script src="https://cdn.jsdelivr.net/npm/chart.js"></script>', '[[CHART_JS_LINK]]');
}
let allHistText = '';
while ((match = scriptRegex.exec(histHtml)) !== null) {
    allHistText += match[1] + '\n';
}
histHtml = histHtml.replace(scriptRegex, '');
const finalHistBlock = `
<script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
<script>
${allHistText}
</script>
</body>
`;
histHtml = histHtml.replace('[[CHART_JS_LINK]]', '');
histHtml = histHtml.replace('</body>', finalHistBlock);

fs.writeFileSync('history.html', histHtml, 'utf8');
console.log('Cleaned and merged all scripts in history.html');