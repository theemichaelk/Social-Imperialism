const fs = require('fs');
let file = "dashboard.html";
let content = fs.readFileSync(file, 'utf8');

// Fix Trending News title and click behavior
const oldNewsTitle = '<div class="stat-title" style="color: #38bdf8;">Trending News</div>';
const nextNewsTitle = '<div class="stat-title" style="color: #38bdf8;">Trending News</div>';

const oldCode = `ipcRenderer.invoke('get-live-news', 'technology').then(news => {\n      const nDiv = document.getElementById('live-news');\n      if (news.error) {\n        nDiv.innerHTML = \`<span style="color:#ef4444">News Feed Offline: ${news.error}</span>\`;\n      } else if (news.articles && news.articles.length > 0) {\n        let html = '<ul style="list-style:none; padding:0; margin:0; display:flex; flex-direction:column; gap:12px;">';\n        news.articles.slice(0, 4).forEach(article => {\n          html += \`\n          <li style="border-bottom: 1px solid rgba(51, 65, 85, 0.5); padding-bottom: 8px;">\n            <a href="#" onclick="ipcRenderer.invoke('open-ai-research', '${article.url}')" style="color:#38bdf8; text-decoration:none; font-weight:bold; font-size:0.95rem; transition:color 0.2s; display:block; margin-bottom:4px;">${article.title}</a> \n            <span style="font-size:0.85rem; color:#cbd5e1; display:block; line-height:1.4;">${article.summary}</span>\n            <span style="font-size:0.75rem; color:#64748b; margin-top:4px; display:block;">Source: ${article.source}</span>\n          </li>`;\n        });\n        html += '</ul>';\n        nDiv.innerHTML = html;\n      } else {\n        nDiv.innerHTML = 'No trending news found.';\n      }\n    })`;

fs.writeFileSync(file, content.evaluated);\nconsole.log('Patched dashboard news');
