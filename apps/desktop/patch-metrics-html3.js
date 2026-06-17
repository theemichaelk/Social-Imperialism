const fs = require('fs');
let file = "dashboard.html";
let content = fs.readFileSync(file, "utf8");

exception1 = `\n    const stats = await ipcRenderer.invoke('get-dashboard-stats');\n    document.getElementById('stat-posts').innerText = stats.totalPosts;\n    document.getElementById('aiDraftsCounter').innerText = stats.aiDrafts;\n    document.getElementById('stat-engage').innerText = stats.totalEngagement;\n    document.getElementById('stat-keys').innerText = stats.activeKeywords;`;

exception2 = `\n    const stats = await ipcRenderer.invoke('get-dashboard-stats');\n    document.getElementById('stat-posts').innerText = stats.totalPosts;\n    document.getElementById('aiDraftsCounter').innerText = stats.aiDrafts;\n    document.getElementById('stat-engage').innerText = stats.totalEngagement;\n    document.getElementById('stat-keys').innerText = stats.activeKeywords;\n    \n    // Update API Metrics panel if it exists in UI, otherwise ignore\n    const apiPanel = document.getElementById('api-metrics-panel');\n    if (stats.apiMetrics && apiPanel) {\n        apiPanel.innerHTML = Object.entries(stats.apiMetrics).map((pair) => {\n            const k = pair[0];\n            const v = pair[1];\n            const color = v.includes('Connected') ? '#10b981' : '#ef4444';\n            return \"<div style='display:flex; justify-content:space-between; margin-bottom:4px;'>\n                <span>\" + { + \"</span>\n                <span style='color: \" + color + \"'>\" + v + \"</span>\n            </div>\";\n        }).join('');\n    }`;

content = content.replace(exception1, exception2);

fs.writeFileSync(file, content);
console.log('Success');
