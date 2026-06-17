const fs = require('fs');
let idx = fs.readFileSync('index.js', 'utf8');

const s1 = idx.indexOf('ipcMain.handle(\'search-stock-photo\', async (event, query) => {');
const s2 = idx.indexOf('});', s1);

if (s1 > -1 && s2 > -1) {
    const newStock = `ipcMain.handle('search-stock-photo', async (event, query) => {
    try {
        let pexelsKey = process.env.PEXELS_API_KEY;
        const globalKeysData = store.getItem('globalApiKeys');
        if (globalKeysData) {
            try { 
                const globalKeys = JSON.parse(globalKeysData); 
                if (globalKeys.pexels) pexelsKey = globalKeys.pexels;
            } catch(e) {}
        }
        
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

    idx = idx.substring(0, s1) + newStock + idx.substring(s2 + 3);
    fs.writeFileSync('index.js', idx, 'utf8');
    console.log('Stock API Updated');
} else {
    console.log('Could not find stock api block');
}