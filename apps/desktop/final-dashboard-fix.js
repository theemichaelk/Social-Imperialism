const fs = require('fs');
const { execSync } = require('child_process');

function fixHtml(file) {
    let html = fs.readFileSync(file, 'utf8');
    
    // There should be exactly two script blocks:
    // 1. <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
    // 2. <script> ... </script>
    
    // Check if the source import got merged into the main block
    if(html.includes('<script src="https://cdn.jsdelivr.net/npm/chart.js">\nconst { ipcRenderer }')) {
        html = html.replace('<script src="https://cdn.jsdelivr.net/npm/chart.js">\nconst { ipcRenderer }', '<script src="https://cdn.jsdelivr.net/npm/chart.js"></script>\n<script>\nconst { ipcRenderer }');
        fs.writeFileSync(file, html, 'utf8');
        console.log(`Fixed merged source script tag in ${file}`);
    }
}

fixHtml('dashboard.html');
fixHtml('history.html');