const fs = require('fs');
let idx = fs.readFileSync('index.js', 'utf8');

const s1 = idx.indexOf('ipcMain.handle(\'generate-image\', async (event, prompt) => {');
const s2 = idx.indexOf('});', s1);

if (s1 > -1 && s2 > -1) {
    const newFal = `ipcMain.handle('generate-image', async (event, prompt) => {
    try {
        let falKey = process.env.FAL_KEY;
        const globalKeysData = store.getItem('globalApiKeys');
        if (globalKeysData) {
            try { 
                const globalKeys = JSON.parse(globalKeysData); 
                if (globalKeys.falKey) falKey = globalKeys.falKey;
            } catch(e) {}
        }
        
        if (!falKey) {
            console.log('No FAL Key found, returning mock image');
            return { success: true, imageUrl: \`https://via.placeholder.com/800x600?text=\${encodeURIComponent("FAL API Key Missing")}\` };
        }
        
        const axios = require('axios');
        const response = await axios.post('https://fal.run/fal-ai/fast-sdxl', {
            prompt: prompt,
            num_images: 1,
            image_size: "square_hd",
            num_inference_steps: 4
        }, {
            headers: {
                "Authorization": \`Key \${falKey}\`,
                "Content-Type": "application/json"
            }
        });
        
        if (response.data && response.data.images && response.data.images.length > 0) {
            return { success: true, imageUrl: response.data.images[0].url };
        }
        
        return { success: false, error: 'No image returned from FAL API' };
    } catch(e) {
        console.error("FAL AI Error:", e.response ? e.response.data : e.message);
        return { success: false, error: e.message };
    }
});`;

    idx = idx.substring(0, s1) + newFal + idx.substring(s2 + 3);
    fs.writeFileSync('index.js', idx, 'utf8');
    console.log('FAL API Updated');
} else {
    console.log('Could not find fal api block');
}