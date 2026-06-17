const fs = require('fs');

const extractedJs = fs.readFileSync('extracted.js', 'utf8');
const extractedHtml = fs.readFileSync('extracted.html', 'utf8');

let h = fs.readFileSync('history.html', 'utf8');

h = h.split('<div class="charts-grid">').join('<div style="margin-bottom: 2rem;">\n' + extractedHtml + '\n</div>\n\n<div class="charts-grid">');
h = h.split('// Load actual data').join(extractedJs + '\n\n// Load actual data');
h = h.split('// Setup Charts').join('async function loadTrendingTopics() { /* mocked */ }\n\n// Setup Charts');

fs.writeFileSync('history.html', h, 'utf8');
console.log('history.html patched successfully');