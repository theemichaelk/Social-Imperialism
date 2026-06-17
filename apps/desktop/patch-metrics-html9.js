const fs = require('fs');
let file = "dashboard.html";
let content = fs.readFileSync(file, "utf8");

exception1 = `<div class=\"stats-grid\">\n    <div class=\"stat-card\">\n      <div class=\"stat-title\">Total Posts Published</div>`;

exception2 = `\n  <div id=\"api-metrics-panel\" style=\"background: rgba(15, 23, 42, 0.6); border: 1px solid #475569; border-radius: 12px; padding: 1.5rem; margin-bottom: 2rem;\">\n    <h3 style=\"margin-top: 0; color: #38bdf8; font-size: 1.1rem; margin-bottom: 1rem; display: flex; align-items: center; gap: 0.5rem;\">\n      🔎 API Connection Status\n    </h3>\n    <div id=\"api-metrics-list\" style=\"display: grid; grid-template-columns: repeat(3, 1fr); gap: 1rem;\">\n      <!-- Populated via JS -->\n    </div>\n  </div>\n\n  <div class=\"stats-grid\">\n    <div class=\"stat-card\">\n      <div class=\"stat-title\">Total Posts Published</div>`;

content = content.replace(exception1, exception2);

fs.writeFileSync(file, content);
console.log('Success');