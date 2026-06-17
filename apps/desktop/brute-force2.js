const fs = require('fs');
const { execSync } = require('child_process');

function fixHtmlStrict(file) {
    let html = fs.readFileSync(file, 'utf8');
    
    // Some files might be missing 'const { ipcRenderer } = require("electron");' which was accidentally stripped.
    if (!html.includes('const { ipcRenderer } = require')) {
        let scriptStart = html.indexOf('<script>');
        if (scriptStart > -1) {
            html = html.substring(0, scriptStart + 8) + '\nconst { ipcRenderer } = require("electron");\n' + html.substring(scriptStart + 8);
        }
    }
    
    // There are also literal missing backticks in some files (e.g., content-hub.html) that broke when fixing \n
    if (file === 'content-hub.html') {
        html = html.replace(/localStorage.setItem\('ch`brandProfile'/g, "localStorage.setItem('ch_brandProfile'");
        html = html.replace(/localStorage.getItem\('ch`brandProfile'/g, "localStorage.getItem('ch_brandProfile'");
    }

    fs.writeFileSync(file, html, 'utf8');
    console.log('Fixed ' + file);
}

fixHtmlStrict('content-hub.html');