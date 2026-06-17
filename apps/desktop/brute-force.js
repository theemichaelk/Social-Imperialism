const fs = require('fs');
const { execSync } = require('child_process');

function bruteForce(file) {
    let content = fs.readFileSync(file, 'utf8');
    
    // There are literal "</script>" strings hidden inside JS strings, 
    // such as: document.write('</script>') or similar, causing the parser to fail.
    // The previous script check was using `.indexOf('<script>')` which is flawed.
    
    let ipcIndex = content.indexOf('const { ipcRenderer } = require(\'electron\');');
    if (ipcIndex === -1) return;
    
    let scriptStart = content.lastIndexOf('<script>', ipcIndex);
    let scriptEnd = content.indexOf('</body>', ipcIndex);
    if(scriptEnd === -1) scriptEnd = content.indexOf('</html>', ipcIndex);
    if(scriptEnd === -1) scriptEnd = content.length;
    
    let jsCode = content.substring(scriptStart + 8, scriptEnd);
    
    // Find all </script> in jsCode and replace them if they are inside strings,
    // or just remove them if they are stray HTML tags
    jsBodyLines = jsCode.split('\n');
    let cleanLines = [];
    for(let l of jsBodyLines) {
        if(l.trim() === '</script>') continue; // Skip stray tags
        if(l.trim() === '<script>') continue;
        cleanLines.push(l);
    }
    
    jsCode = cleanLines.join('\n');
    
    // verify syntax
    fs.writeFileSync('temp.js', jsCode, 'utf8');
    try {
        execSync('node -c temp.js');
        console.log(`Brute Force Valid Syntax for ${file}`);
        
        let newContent = content.substring(0, scriptStart) + '<script>\n' + jsCode + '\n</script>\n</body>\n</html>';
        fs.writeFileSync(file, newContent, 'utf8');
    } catch(e) {
        console.error(`Still failing for ${file}`);
        console.log(e.stderr.toString());
    }
}

bruteForce('dashboard.html');
bruteForce('history.html');