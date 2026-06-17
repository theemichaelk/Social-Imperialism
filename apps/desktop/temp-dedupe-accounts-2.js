const fs = require('fs');
let indexJs = fs.readFileSync('index.js', 'utf8');

const duplicateUseSelectedRegex = /ipcMain\.handle\('use-selected-accounts', async \(event, accounts\) => \{[\s\S]*?\/\/ Add to linked accounts[\s\S]*?let linked = store\.getItem\('linkedAccounts'\) \|\| \[\];[\s\S]*?linked = \[\.\.\.linked, \.\.\.accounts\];[\s\S]*?store\.setItem\('linkedAccounts', linked\);[\s\S]*?return true;[\s\S]*?\}\);/m;

if (indexJs.match(duplicateUseSelectedRegex)) {
    indexJs = indexJs.replace(duplicateUseSelectedRegex, '');
    fs.writeFileSync('index.js', indexJs, 'utf8');
    console.log("Removed duplicate use-selected-accounts handler.");
} else {
    console.log("Could not find the duplicate use-selected-accounts handler.");
}