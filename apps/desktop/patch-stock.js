const fs = require('fs');
let idx = fs.readFileSync('index.js', 'utf8');

const oldStock = `// Search Stock Photos (Pexels / Pixabay / Flickr)
ipcMain.handle('search-stock-photo', async (event, query) => {
  return { success: true, imageUrl: \`https://source.unsplash.com/800x600/?\${encodeURIComponent(query)}\`, source: 'Unsplash Mock' };
});`;

const newStock = `// Search Stock Photos (Pexels / Pixabay / Flickr)
ipcMain.handle('search-stock-photo', async (event, query) => {
    try {
        const pexelsKey = getGlobalKey('pexels') || process.env.PEXELS_API_KEY;
        if (!pexelsKey) {
            // Fallback to Unsplash source API if no key
            return { success: true, imageUrl: \`https://source.unsplash.com/800x600/?\${encodeURIComponent(query)}\`, source: 'Unsplash (No Key)' };
        }
        
        const axios = require('axios');
        const res = await axios.get(\`https://api.pexels.com/v1/search?query=\${encodeURIComponent(query)}&per_page=1\`, {
            headers: { Authorization: pexelsKey }
        });
        
        if (res.data && res.data.photos && res.data.photos.length > 0) {
            return { success: true, imageUrl: res.data.photos[0].src.large, source: 'Pexels' };
        }
        
        return { success: false, error: 'No photos found for that query' };
    } catch(e) {
        console.error('Stock Photo API Error:', e.message);
        return { success: false, error: e.message };
    }
});`;

if(idx.includes(oldStock)) {
    idx = idx.replace(oldStock, newStock);
    fs.writeFileSync('index.js', idx, 'utf8');
    console.log('Stock API Updated');
} else {
    console.log('Stock API signature not found or already updated');
}