const fs = require('fs');

function sanitizeFile(filename) {
    let html = fs.readFileSync(filename, 'utf8');

    // 1. Remove ALL <script> tags and everything between them EXCEPT Chart.js
    let hasChartJs = html.includes('https://cdn.jsdelivr.net/npm/chart.js');
    
    // We will extract just the content between the FIRST <script> and LAST </script> 
    // that actually contains the JS code.
    const ipcMatch = html.indexOf('const { ipcRenderer }');
    if (ipcMatch === -1) return; // No IPC renderer found

    const firstScriptBeforeIpc = html.lastIndexOf('<script>', ipcMatch);
    let lastScriptEnd = html.lastIndexOf('</script>');
    
    // If the last script end is right before </body>, we good. Let's find body end.
    const bodyEnd = html.indexOf('</body>');
    if (bodyEnd > -1 && lastScriptEnd > bodyEnd) {
        lastScriptEnd = html.lastIndexOf('</script>', bodyEnd);
    }

    let jsContent = html.substring(firstScriptBeforeIpc + 8, lastScriptEnd);
    
    // Strip any internal script tags that got caught in the middle
    jsContent = jsContent.replace(/<\/?script[^>]*>/g, '\n');

    let newHtml = html.substring(0, firstScriptBeforeIpc);
    if(hasChartJs && !newHtml.includes('chart.js')) {
        newHtml += '<script src="https://cdn.jsdelivr.net/npm/chart.js"></script>\n';
    }
    
    newHtml += '<script>\n' + jsContent + '\n</script>\n</body>\n</html>';
    fs.writeFileSync(filename, newHtml, 'utf8');
    console.log(`Sanitized ${filename}`);
}

sanitizeFile('dashboard.html');
sanitizeFile('history.html');