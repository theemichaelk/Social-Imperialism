const fs = require('fs');
function fixTags(file) {
    let html = fs.readFileSync(file, 'utf8');
    
    // Completely remove chart.js script so there's only one script tag
    if (html.includes('<script src="https://cdn.jsdelivr.net/npm/chart.js"></script>')) {
        html = html.replace('<script src="https://cdn.jsdelivr.net/npm/chart.js"></script>', '');
    }

    let startIdx = html.indexOf('<script>');
    let endIdx = html.lastIndexOf('</script>');
    
    if (startIdx === -1 || endIdx === -1) return;

    let jsBody = html.substring(startIdx + 8, endIdx);
    
    // Clear out any internal script tags completely
    jsBody = jsBody.replace(/<\/?script[^>]*>/g, '');
    
    let newHtml = html.substring(0, startIdx) + '<script src="https://cdn.jsdelivr.net/npm/chart.js"></script>\n<script>\n' + jsBody + '\n</script>' + html.substring(endIdx + 9);
    
    // Also clean up any double </body> resulting from multiple script replacements
    newHtml = newHtml.replace(/<\/body>\s*<\/body>/g, '</body>');
    newHtml = newHtml.replace(/<\/html>\s*<\/html>/g, '</html>');
    
    fs.writeFileSync(file, newHtml, 'utf8');
}
fixTags('dashboard.html');
fixTags('history.html');
console.log('Fixed script boundaries manually.');