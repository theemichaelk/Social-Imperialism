const fs = require('fs');
const htmlFiles = ['dashboard.html', 'history.html', 'keywords.html', 'account-hub.html', 'settings.html'];

let newLinks = `<a href="content-hub.html" class="nav-link">Content Hub</a>\n  <a href="calendar.html" class="nav-link">Content Calendar</a>\n  <a href="settings.html"`;

for(let file of htmlFiles) {
  if(fs.existsSync(file)) {
    let content = fs.readFileSync(file, 'utf8');
    if(!content.includes('Content Hub')) {
      content = content.replace(/<a href="settings.html"/g, newLinks);
      fs.writeFileSync(file, content);
      console.log(`Patched ${file}`);
    } else {
      console.log(`Already patched ${file}`);
    }
  }
}