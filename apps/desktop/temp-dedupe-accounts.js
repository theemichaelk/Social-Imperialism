const fs = require('fs');
let indexJs = fs.readFileSync('index.js', 'utf8');

// There are two declarations of ipcMain.handle('get-available-accounts'
// Let's find the second one and remove the first one, or merge them.

// First, let's find the first handler block
const firstHandlerRegex = /ipcMain\.handle\('get-available-accounts', async \(event, payload\) => \{[\s\S]*?let platform = payload\.platform;[\s\S]*?return \[.*?\];\s*\n\}\);/m;

// Since the second one has the 'credentials' param and the multi-select logic,
// let's remove the first basic one if we can identify it securely.
if (indexJs.match(firstHandlerRegex)) {
    indexJs = indexJs.replace(firstHandlerRegex, '');
    fs.writeFileSync('index.js', indexJs, 'utf8');
    console.log("Removed duplicate handler successfully.");
} else {
    // Let's try a broader matching approach to delete the second one
    console.log("Could not find exact first handler. Trying fallback...");
    
    // We can count occurrences
    let parts = indexJs.split("ipcMain.handle('get-available-accounts'");
    if (parts.length > 2) {
        console.log(`Found ${parts.length - 1} handlers.`);
        // We will manually reconstruct it without the old one
        
        // Remove the block containing payload.platform
        const oldBlockRegex = /ipcMain\.handle\('get-available-accounts', async \(event, payload\) => \{[\s\S]*?username = payload\.username;[\s\S]*?\}\);/m;
        if (indexJs.match(oldBlockRegex)) {
            indexJs = indexJs.replace(oldBlockRegex, '');
            fs.writeFileSync('index.js', indexJs, 'utf8');
            console.log("Removed the older payload-based handler.");
        } else {
            console.log("Could not isolate and delete duplicate. Manual inspection needed.");
        }
    }
}