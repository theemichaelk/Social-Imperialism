const fs = require('fs');
const { execSync } = require('child_process');

const files = ['dashboard.html', 'history.html', 'keywords.html', 'rules.html', 'account-hub.html', 'content-hub.html', 'calendar.html', 'settings.html'];

for(const file of files) {
    if(!fs.existsSync(file)) continue;
    let content = fs.readFileSync(file, 'utf8');
    
    let start = content.indexOf('<script>');
    let end = content.indexOf('</script>');
    
    if (start > -1 && end > -1) {
        let scriptBlock = content.substring(start + 8, end);
        fs.writeFileSync('temp.js', scriptBlock, 'utf8');
        try {
            execSync('node -c temp.js');
        } catch(e) {
            console.error(`SYNTAX ERROR IN ${file}`);
            
            // Try auto-fixing literal \n and backticks
            let fixedScript = scriptBlock.replace(/\\n/g, '\n').replace(/\\u0060/g, '`');
            fs.writeFileSync('temp.js', fixedScript, 'utf8');
            try {
                execSync('node -c temp.js');
                console.log(`Successfully auto-fixed syntax in ${file}`);
                content = content.substring(0, start + 8) + '\n' + fixedScript + '\n' + content.substring(end);
                fs.writeFileSync(file, content, 'utf8');
            } catch(e2) {
                console.error(`COULD NOT AUTO-FIX ${file}`);
            }
        }
    }
}
console.log('Done checking syntax on all files.');