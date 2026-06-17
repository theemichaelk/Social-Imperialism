const fs = require('fs');
const { execSync } = require('child_process');

function fixSyntax() {
    // 1. Fix dashboard.html (extra </script> before actual script)
    let dash = fs.readFileSync('dashboard.html', 'utf8');
    if(dash.includes('</script>\n<script>\nconst { ipcRenderer }')) {
        dash = dash.replace('</script>\n<script>\nconst { ipcRenderer }', '\nconst { ipcRenderer }');
        fs.writeFileSync('dashboard.html', dash, 'utf8');
        console.log('Fixed dashboard.html script tag issue');
    }

    // 2. Fix history.html
    let hist = fs.readFileSync('history.html', 'utf8');
    if(hist.includes('</script>\n<script>\nconst { ipcRenderer }')) {
        hist = hist.replace('</script>\n<script>\nconst { ipcRenderer }', '\nconst { ipcRenderer }');
        fs.writeFileSync('history.html', hist, 'utf8');
        console.log('Fixed history.html script tag issue');
    }

    // 3. Fix keywords.html await error
    let key = fs.readFileSync('keywords.html', 'utf8');
    if(key.includes('window.saveAutoRules = function() {')) {
        key = key.replace('window.saveAutoRules = function() {', 'window.saveAutoRules = async function() {');
        fs.writeFileSync('keywords.html', key, 'utf8');
        console.log('Fixed keywords.html await syntax error');
    }

    // 4. Fix account-hub.html \f (form feed) literal causing error: {n
    let acc = fs.readFileSync('account-hub.html', 'utf8');
    if(acc.includes('{n')) {
        acc = acc.replace('{n', '{\n');
        fs.writeFileSync('account-hub.html', acc, 'utf8');
        console.log('Fixed account-hub.html invalid control character');
    }
}

fixSyntax();