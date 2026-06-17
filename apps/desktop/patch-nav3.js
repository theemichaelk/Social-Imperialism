const fs = require('fs');
const files = ['dashboard.html', 'history.html', 'keywords.html', 'account-hub.html', 'content-hub.html', 'calendar.html', 'settings.html'];

for(const file of files) {
    if(!fs.existsSync(file)) continue;
    let content = fs.readFileSync(file, 'utf8');
    
    // Auto-Rules link is missing from most pages. Let's add it right after Keywords.
    const searchHtml = `<a href="keywords.html" class="nav-link">Keywords</a>`;
    const searchHtmlActive = `<a href="keywords.html" class="nav-link active">Keywords</a>`;
    
    const insertHtml = `\n  <a href="rules.html" class="nav-link">Auto-Rules</a>`;
    
    if(content.includes(searchHtml) && !content.includes('href="rules.html"')) {
        content = content.replace(searchHtml, searchHtml + insertHtml);
        fs.writeFileSync(file, content, 'utf8');
        console.log(`Updated nav in ${file}`);
    } else if(content.includes(searchHtmlActive) && !content.includes('href="rules.html"')) {
        content = content.replace(searchHtmlActive, searchHtmlActive + insertHtml);
        fs.writeFileSync(file, content, 'utf8');
        console.log(`Updated nav in ${file}`);
    } else {
        console.log(`No change needed for ${file}`);
    }
}