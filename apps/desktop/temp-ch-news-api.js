const fs = require('fs');
let idx = fs.readFileSync('index.js', 'utf8');

const oldNews = `ipcMain.handle('get-live-news', async (event, query = "technology") => {
  return { articles: [
     { title: "Apple Announces New M4 Macs", source: "TechCrunch", url: "https://techcrunch.com", summary: "" },
     { title: "AI Agents on the Rise for Enterprises", source: "Wired", url: "https://wired.com", summary: "" },
     { title: "New Open-Source LLMs Beat Proprietary Models", source: "BleepingComputer", url: "https://bleepingcomputer.com", summary: "" },
     { title: "Markets Rally on Tech Earnings Reports", source: "CNBC", url: "https://cnbc.com", summary: "" }
  ] };
});`;

const newNews = `ipcMain.handle('get-live-news', async (event, query = "business") => {
  try {
      const newsKey = process.env.NEWS_API_KEY || getGlobalKey('newsApiKey');
      
      if (!newsKey) {
          // Fallback if no key provided
          return [
             { title: "Mock: Apple Announces New M4 Macs", source: "TechCrunch", url: "https://techcrunch.com", summary: "" },
             { title: "Mock: AI Agents on the Rise for Enterprises", source: "Wired", url: "https://wired.com", summary: "" },
             { title: "Mock: New Open-Source LLMs Beat Proprietary Models", source: "BleepingComputer", url: "https://bleepingcomputer.com", summary: "" },
             { title: "Mock: Markets Rally on Tech Earnings Reports", source: "CNBC", url: "https://cnbc.com", summary: "" }
          ];
      }
      
      const axios = require('axios');
      const res = await axios.get(\`https://newsapi.org/v2/top-headlines?category=\${query}&language=en&apiKey=\${newsKey}&pageSize=15\`);
      
      if (!res.data || !res.data.articles || res.data.articles.length === 0) {
         return [];
      }
      
      // Shuffle the array
      const shuffled = res.data.articles.sort(() => 0.5 - Math.random());
      
      // Select exactly 4
      const selected = shuffled.slice(0, 4);
      
      // Format to array of objects with title and url per PRD request
      return selected.map(a => ({
          title: a.title,
          url: a.url
      }));
  } catch(e) {
      console.error("News error:", e.message);
      return [];
  }
});`;

if (idx.includes(oldNews)) {
    idx = idx.replace(oldNews, newNews);
    fs.writeFileSync('index.js', idx, 'utf8');
    console.log('Successfully updated get-live-news to fetch actual APIs');
} else {
    console.log('Could not find exact mock function. Reverting to regex search');
    
    // Fallback regex
    const start = idx.indexOf("ipcMain.handle('get-live-news'");
    if (start > -1) {
        const end = idx.indexOf("});", start);
        idx = idx.substring(0, start) + newNews + idx.substring(end + 3);
        fs.writeFileSync('index.js', idx, 'utf8');
        console.log('Successfully updated get-live-news via regex');
    }
}