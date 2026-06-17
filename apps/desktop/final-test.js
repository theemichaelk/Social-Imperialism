const fs = require('fs');
const { execSync } = require('child_process');

const files = ['dashboard.html', 'history.html', 'keywords.html', 'rules.html', 'account-hub.html', 'content-hub.html', 'calendar.html', 'settings.html'];

for(const file of files) {
    if(!fs.existsSync(file)) continue;
    let content = fs.readFileSync(file, 'utf8');
    
    let start = content.indexOf('<script>');
    let end = content.lastIndexOf('</script>');
    
    if (start > -1 && end > -1) {
        let scriptBlock = content.substring(start + 8, end);
        fs.writeFileSync('temp.js', scriptBlock, 'utf8');
        try {
            execSync('node -c temp.js');
        } catch(e) {
            console.error(`SYNTAX ERROR IN ${file}`);
        }
    }
}
console.log('Done checking syntax on all files.');