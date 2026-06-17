const fs = require('fs');
let html = fs.readFileSync('content-hub.html', 'utf8');

// There is a rogue `);` or something near the end of the file.
// Let's strip it out safely.

try {
    let jsBody = html.substring(html.indexOf('<script>') + 8, html.lastIndexOf('</script>'));
    
    // We'll write to temp to find the line
    let lines = jsBody.split('\n');
    let lineToPrint = '';
    for(let i=360; i<380; i++) {
        if(lines[i]) lineToPrint += `${i+1}: ${lines[i]}\n`;
    }
    console.log(lineToPrint);
} catch(e) { console.error(e); }