const fs = require('fs');
let file = "dashboard.html";
let content = fs.readFileSync(file, "utf8");

content = content.replace(
  '<div class=\"stat-title\" style=\"color: #38bdf8;\">Trending Tech News</div>',
  '<div class=\"stat-title\" style=\"color: #38bdf8;\">Trending News</div>'
);

content = content.replace(
  'news.articles.slice(0, 3).forEach(article => {',
  'news.articles.slice(0, 4).forEach(article => {'
);

content = content.replace(
  'onclick=\"require(\'electron\').shell.openExternal(\'' + article.url + '\')\"',
  'onclick=\"ipcRenderer.invoke(\'open-ai-research\', \' + article.url + '\')\"'
);

fs.writeFileSync(file, content);
console.log('Success');