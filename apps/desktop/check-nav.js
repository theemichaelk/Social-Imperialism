const fs = require('fs');
const files = ['dashboard.html', 'history.html', 'keywords.html', 'rules.html', 'account-hub.html', 'content-hub.html', 'calendar.html', 'settings.html'];

for(const file of files) {
    if(!fs.existsSync(file)) {
        console.log(file, 'DOES NOT EXIST');
        continue;
    }
    const content = fs.readFileSync(file, 'utf8');
    const linksMatches = content.match(/<a href="([^"]+)"[^>]*>.*?<\/a>/g) || [];
    
    // check for bad script tags
    const badScripts = content.match(/<script[^>]*>[^<]*<\/script>/g) || [];
    const missingClosingScript = content.split('<script>').length !== content.split('</script>').length;
    
    console.log(`\n--- ${file} ---`);
    console.log('Nav Links: ', linksMatches.filter(l => l.includes('nav-link')).map(l => l.match(/href="([^"]+)"/)[1]).join(', '));
    console.log('Missing Closing Script Tag:', missingClosingScript);
    if(content.includes('globalKeys is not defined')) console.log('Contains globalKeys error text');
    if(content.includes('SyntaxError')) console.log('Contains syntax error text');
}