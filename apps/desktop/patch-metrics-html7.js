const fs = require('fs');
let file = "dashboard.html";
let content = fs.readFileSync(file, "utf8");

exception1 = `<div class=\"stats-grid\">\n    <div class=\"stat-card\">\n      <div class=\"stat-title\">Total Posts Published</div>\n      <div class=\"stat-value\" id=\"stat-posts\">0</div>\n    </div>`;

exception2 = `<div id=\"api-metrics-panel\" style=\"background: rgba(15, 23, 42, 0.6); border: 1px solid #475569; border-radius: 12px; padding: 1.5rem; margin-bottom: 2rem;\">\n    <h3 style=\"margin-top: 0; color: #38bdf8; font-size: 1.1rem; margin-bottom: 1mrem; display: flex; align-items: center; gap: 0.5rem;\">\n      🔎 API Connection Status\n    </h3>\n    <div id=\"api-metrics-list\" style=\"display: grid; grid-template-columns: repeat(3, 1fr); gap: 1rem;\">\n      <!-- Populated via JS -->\n    </div>\n  </div>\n\n  <div class=\"stats-grid\">\n    <div class=\"stat-card\">\n      <div class=\"stat-title\">Total Posts Published</div>\n      <div class=\"stat-value\" id=\"stat-posts\">0</div>\n    </div>`;

exception3 = `    if (stats.apiMetrics) {\n        const apiPanel = document.getElementById('api-metrics-panel');\n        if (apiPanel) {\n            apiPanel.innerHTML = Object.entries(stats.apiMetrics).map(pair => {\n                const k = pair[0];\n                const v = pair[1];\n                const color = v.includes('Connected') ? '#10b981' : '#ef4444';\n                return '<div style=\"display:flex; justify-content:space-between; margin-bottom:4px;\">'+\n                       '<span>' + k + '</span>'+\n                       '<span style=\"color: ' + color + '\">' + v + '</span>'+\n                       '</div>';\n            }).join('');\n        }\n    }`;

exception4 = `    const apiPanel = document.getElementById('api-metrics-list');\n    if (apiPanel) {\n        apiPanel.innerHTML = Object.entries(stats.apiMetrics).sort().map(pair => {\n            const k = pair[0];\n            const v = pair[1];\n            const color = v.includes('Connected') ? '#10b981' : '#ef4444';\n            return '<div style=\"background: rgba(30, 41, 59, 0.5); padding: 10px 12px; border-radius: 4px; display:flex; justify-content:space-between; margin-bottom:4px; align-items:center;\">'+\n                   '<span style=\"color:#94a3b8; font-size:0.8rem; text-transform:uppercase;\">' + k + '</span>'+\n                   '<span style=\"font-size:0.8rem; color: ' + color + '\">' + v + '</span>'+\n                   '</div>';\n        }).join('');\n    }`;

content = content.replace(exception1, exception2);
content = content.replace(exception3, exception4);

fs.writeFileSync(file, content);
console.log('Success');