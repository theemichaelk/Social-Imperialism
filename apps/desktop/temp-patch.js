const fs = require('fs');
let idx = fs.readFileSync('index.js', 'utf8');

const newHandler = `
// Handle local media upload
ipcMain.handle('upload-local-media', async (event, filePath) => {
    try {
        const fs = require('fs');
        const path = require('path');
        const ext = path.extname(filePath).toLowerCase();
        let mimeType = 'image/jpeg';
        if (ext === '.png') mimeType = 'image/png';
        if (ext === '.gif') mimeType = 'image/gif';
        if (ext === '.mp4') mimeType = 'video/mp4';
        if (ext === '.mov') mimeType = 'video/quicktime';
        
        const data = fs.readFileSync(filePath);
        const base64 = 'data:' + mimeType + ';base64,' + data.toString('base64');
        return base64;
    } catch (e) {
        console.error('Error uploading local media:', e);
        return null;
    }
});
`;

if (!idx.includes('upload-local-media')) {
    idx += '\n' + newHandler + '\n';
    fs.writeFileSync('index.js', idx, 'utf8');
    console.log('Added upload-local-media to index.js');
} else {
    console.log('upload-local-media already exists');
}