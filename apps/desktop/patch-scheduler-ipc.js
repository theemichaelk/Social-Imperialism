const fs = require('fs');
let file = "index.js";
let content = fs.readFileSync(file, "utf8");

let newHandlers = `\nipcMain.handle('schedule-post', async (event, postData) => {\n  let scheduledPosts = [];\n  const data = store.getItem('scheduledPosts');\n  if(data) {\n    try { scheduledPosts = JSON.parse(data); } catch(e) {}\n  }\n  \n  const dateObj = new Date(postData.scheduleTime);\n  const newPost = {\n    id: 'sched_' + Date.now(),\n    platform: postData.platform,\n    accountId: postData.accountId,\n    content: postData.content,\n    mediaUrl: postData.mediaUrl,\n    rules: postData.rules || {},\n    timestamp: postData.scheduleTime,\n    dateIndex: dateObj.getDate()\n  };\n  \n  scheduledPosts.push(newPost);\n  store.setItem('scheduledPosts', JSON.stringify(scheduledPosts));\n  return { success: true, post: newPost };\n});\n\nipcMain.handle('get-scheduled-posts', (event) => {\n  const data = store.getItem('scheduledPosts');\n  if(!data) return [];\n  try { return JSON.parse(data); } catch(e) { return []; }\n});\n\nipcMain.handle('delete-scheduled-post', (event, id) => {\n  const data = store.getItem('scheduledPosts');\n  if(!data) return { success: false };\n  try {\n    let posts = JSON.parse(data);\n    posts = posts.filter(p => p.id !== id);\n    store.setItem('scheduledPosts', JSON.stringify(posts));\n    return { success: true };\n  } catch(e) { return { success: false }; }\n});\n`;

if(!content.includes('schedule-post')) {
  content = content.replace('// --- BACKGROUND WORKER LOGIC ---', newHandlers + '\n// --- BACKGROUND WORKER LOGIC ---');
  fs.writeFileSync(file, content);
}
