const fs = require('fs');
let file = "index.js";
let content = fs.readFileSync(file, "utf8");

let oldHandler = `ipcMain.handle('get-ai-replies', (event) => {\n  const data = store.getItem('aiRepliesHistory');\n  if(!data) return [];\n  try { return JSON.parse(data); } catch(e) { return []; }\n});`;

let newHandler = `ipcMain.handle('get-ai-replies', (event, campaignId = null) => {\n  const data = store.getItem('aiRepliesHistory');\n  if(!data) return [];\n  try {\n    const history = JSON.parse(data);\n    if(campaignId) {\n      return history.filter(p => p.campaignId === campaignId);\n    }\n    return history;\n  } catch(e) { return []; }\n});`;

content = content.replace(oldHandler, newHandler);

fs.writeFileSync(file, content);
console.log('Success');