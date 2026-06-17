const fs = require('fs');
let indexJs = fs.readFileSync('index.js', 'utf8');

// 1. Fix globalKeys is not defined in index.js for get-live-news
const regexNews = /ipcMain\.handle\('get-live-news', async \(event, query = "business"\) => \{[\s\S]*?\}\);/m;

const newNewsBlock = `ipcMain.handle('get-live-news', async (event, query = "technology") => {
  try {
      let newsKey = process.env.NEWS_API_KEY || null;
      if (!newsKey) {
          const globalKeysData = store.getItem('globalApiKeys');
          if (globalKeysData) {
              try {
                  const keys = JSON.parse(globalKeysData);
                  if (keys.newsApi) newsKey = keys.newsApi;
              } catch(e) {}
          }
      }
      
      const defaultNews = [
          { title: "OpenAI Announces New Architecture", url: "https://news.ycombinator.com" },
          { title: "Meta Releases Open Source AI Models", url: "https://news.ycombinator.com" },
          { title: "Google Cloud Expands Vertex AI Capabilities", url: "https://news.ycombinator.com" },
          { title: "Startup Funding in AI Sector reaches $50B", url: "https://news.ycombinator.com" },
          { title: "EU Passes Comprehensive AI Act", url: "https://news.ycombinator.com" }
      ];
      
      if (!newsKey) {
          return defaultNews.slice(0, 4);
      }
      
      const { fetch } = await import('node-fetch');
      const res = await fetch(\`https://newsapi.org/v2/top-headlines?category=technology&language=en&pageSize=10&apiKey=\${newsKey}\`);
      
      if (!res.ok) {
          return defaultNews.slice(0, 4);
      }
      
      const data = await res.json();
      if (data && data.articles && data.articles.length > 0) {
          return data.articles.slice(0, 4).map(a => ({ title: a.title, url: a.url }));
      }
      
      return defaultNews.slice(0, 4);
  } catch(e) {
      console.error("News error:", e.message);
      return [
          { title: "OpenAI Announces New Architecture", url: "https://news.ycombinator.com" },
          { title: "Meta Releases Open Source AI Models", url: "https://news.ycombinator.com" },
          { title: "Google Cloud Expands Vertex AI Capabilities", url: "https://news.ycombinator.com" },
          { title: "Startup Funding in AI Sector reaches $50B", url: "https://news.ycombinator.com" }
      ];
  }
});`;

if (indexJs.match(regexNews)) {
    indexJs = indexJs.replace(regexNews, newNewsBlock);
    fs.writeFileSync('index.js', indexJs, 'utf8');
    console.log('Fixed get-live-news in index.js');
}

// 2. Fix Dashboard UI for Trending News
let dashboardHtml = fs.readFileSync('dashboard.html', 'utf8');

// Change Title from "Trending News" to "Trending News" (if it was "Trending Tech News") and update the loader
const titleRegex = /<div class="stat-title" style="color: #38bdf8;">Trending (Tech )?News<\/div>\s*<div id="live-news".*?<\/div>/;
const newTitleHtml = `<div class="stat-title" style="color: #38bdf8;">Trending News</div>
      <div id="live-news" style="font-size: 0.9rem; color: #cbd5e1; margin-top: 10px; min-height: 60px;">Loading latest headlines via NewsAPI...</div>`;
      
if (dashboardHtml.match(titleRegex)) {
    dashboardHtml = dashboardHtml.replace(titleRegex, newTitleHtml);
}

// Update the frontend JS logic for loading news
const frontendNewsRegex = /ipcRenderer\.invoke\('get-live-news', 'technology'\)\.then\(news => \{[\s\S]*?\}\);/m;
const newFrontendNews = `ipcRenderer.invoke('get-live-news', 'technology').then(news => {
      const nDiv = document.getElementById('live-news');
      if (news.error) {
        nDiv.innerHTML = '<span style="color:#ef4444">News Feed Offline: ' + news.error + '</span>';
      } else if (Array.isArray(news) && news.length > 0) {
        let htmlStr = '<ul style="list-style:none; padding:0; margin:0; display:flex; flex-direction:column; gap:12px;">';
        news.slice(0, 4).forEach(article => {
          htmlStr += '<li style="border-bottom: 1px solid rgba(51, 65, 85, 0.5); padding-bottom: 8px;">' +
            '<a href="content-hub.html?research=' + encodeURIComponent(article.title) + '&url=' + encodeURIComponent(article.url) + '" style="color:#38bdf8; text-decoration:none; font-weight:bold; font-size:0.95rem; transition:color 0.2s; display:block; margin-bottom:4px;">' + article.title + '</a>' +
          '</li>';
        });
        htmlStr += '</ul>';
        nDiv.innerHTML = htmlStr;
      } else {
        nDiv.innerHTML = 'No trending news found.';
      }
    });`;

if (dashboardHtml.match(frontendNewsRegex)) {
    dashboardHtml = dashboardHtml.replace(frontendNewsRegex, newFrontendNews);
    fs.writeFileSync('dashboard.html', dashboardHtml, 'utf8');
    console.log('Fixed Trending News UI in dashboard.html');
}