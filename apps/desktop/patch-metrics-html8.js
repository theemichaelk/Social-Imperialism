const fs = require('fs');
let file = "dashboard.html";
let content = fs.readFileSync(file, "utf8");

exception1 = `<div class=\"stats-grid\"\n                         style=\"margin-bottom: 2rem; border-bottom: 1px solid #334155; padding-bottom: 2rem;\">\n      <div class=\"stat-card\" style=\"grid-column: span 1; position: relative;\">\n        <div class=\"stat-title\" style=\"color: #38bdf8; display: flex; justify-content: space-between; align-items: center;\">\n          <span>Trending Topics</span>`;

exception2 = `<div id=\"api-metrics-panel\" style=\"background: rgba(15, 23, 42, 0.6); border: 1px solid #475569; border-radius: 12px; padding: 1.5rem; margin-bottom: 2rem;\">\n    <h3 style=\"margin-top: 0; color: #38bdf8; font-size: 1.1rem; margin-bottom: 1mrem; display: flex; align-items: center; gap: 0.5rem;\">\n      🔎 API Connection Status\n    </h3>\n    <div id=\"api-metrics-list\" style=\"display: grid; grid-template-columns: repeat(3, 1fr); gap: 1rem;\">\n      <!-- Populated via JS -->\n    </div>\n  </div>\n\n  <div class=\"stats-grid\" style=\"margin-bottom: 2rem; border-bottom: 1px solid #334155; padding-bottom: 2rem;\">\n    <div class=\"stat-card\" style=\"grid-column: span 1; position: relative;\">\n      <div class=\"stat-title\" style=\"color: #38bdf8; display: flex; justify-content: space-between; align-items: center;\">\n        <span>Trending Topics</span>`;

exception3 = `document.getElementById('stat-keys').innerText = stats.activeKeywords;`;

exception4 = `document.getElementById('stat-keys').innerText = stats.activeKeywords;\n\n    // API Metrics Update\n    if (stats.apiMetrics) {\n        const apiPanel = document.getElementById('api-metrics-list');\n        if (apiPanel) {\n            apiPanel.innerHTML = Object.entries(stats.apiMetrics).sort().map(pair => {\n                const k = pair[0];\n                const v = pair[1];\n                const color = v.includes('Connected') ? '#10b981' : '#ef4444';\n                return '<div style=\"background: rgba(30, 41, 59, 0.5); padding: 10px 12px; border-radius: 4px; display:flex; justify-content:space-between; margin-bottom:4px; align-items:center;\">'+\n                       '<span style=\"color:#94a3b8; font-size:0.8rem; text-transform:uppercase;\">' + k + '</span>'+\n                       '<span style=\"font-size:0.8rem; color: ' + color + '\">' + v + '</span>'+\n                       '</div>';\n            }).join('');\n        }\n    }`;

content = content.replace(exception1, exception2);
content = content.replace(exception3, exception4);

fs.writeFileSync(file, content);
console.log('Success');