const fs = require('fs');
let h = fs.readFileSync('history.html', 'utf8');

const extractStart = h.indexOf('<div style="margin-bottom: 2rem;">\n<div class="feed-section">');
const extractEnd = h.indexOf('<div class="charts-grid">');
let feedBlock = h.substring(extractStart, extractEnd);

h = h.substring(0, extractStart) + h.substring(extractEnd);

const hcStart = h.indexOf('<div id="history-container">');
const hcEnd = h.indexOf('</div>\n\n  </div>\n</div>\n<script>'); 
if(hcStart > -1 && hcEnd > -1) {
  h = h.substring(0, hcStart) + feedBlock + '\n</div>\n</div>\n<script>' + h.substring(hcEnd + 33);
}

h = h.replace('<h1>Reply History & Approvals</h1>', '<h1>Command Center & AI Replies Hub</h1>');

fs.writeFileSync('history.html', h, 'utf8');
console.log('Layout updated.');