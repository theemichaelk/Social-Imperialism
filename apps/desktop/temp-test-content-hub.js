const fs = require('fs');
const { execSync } = require('child_process');

let html = fs.readFileSync('content-hub.html', 'utf8');
let start = html.indexOf('<script>');
let end = html.lastIndexOf('</script>');

let jsBody = html.substring(start + 8, end);
fs.writeFileSync('temp-js.js', jsBody, 'utf8');

try {
    execSync('node -c temp-js.js');
    console.log('Syntax is completely valid. It must be a runtime issue.');
    
    // Now let's check for runtime issues by running it in a mock DOM via JSDOM
    const { JSDOM } = require('jsdom');
    const dom = new JSDOM(html, { runScripts: "dangerously" });
    console.log('JSDOM executed without fatal global crashes');
    
} catch(e) {
    console.error('JS ERROR');
    if(e.stderr) console.error(e.stderr.toString());
    else console.error(e.message);
}