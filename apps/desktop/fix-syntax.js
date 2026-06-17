const fs = require('fs');
let html = fs.readFileSync('content-hub.html', 'utf8');

// The file has literal "\n" characters from a botched string replacement or PowerShell escaping issue.
// E.g. `<script>\nconst { ipcRenderer } = require('electron');`
// But instead of actual newline, it's a backslash followed by an n.

if(html.includes('\\nconst { ipcRenderer }')) {
    html = html.replace('\\nconst { ipcRenderer }', '\nconst { ipcRenderer }');
}
if(html.includes('loadAccounts());\\n// Brand')) {
    html = html.replace('loadAccounts());\\n// Brand', 'loadAccounts());\n// Brand');
}

// Just globally replace all literal `\n` characters with actual newlines if they are inside the script tag.
let start = html.indexOf('<script>');
let end = html.indexOf('</script>');
if (start > -1 && end > -1) {
    let scriptBlock = html.substring(start, end);
    let fixedScript = scriptBlock.replace(/\\n/g, '\n').replace(/\\u0060/g, '`');
    html = html.substring(0, start) + fixedScript + html.substring(end);
}

fs.writeFileSync('content-hub.html', html, 'utf8');
console.log('Fixed syntax escapes in content-hub.html');