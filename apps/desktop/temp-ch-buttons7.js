const fs = require('fs');
let html = fs.readFileSync('content-hub.html', 'utf8');

// I need to use the single script block that is already executing in the page (where `switchTab` is)
// and wire the buttons there, rather than adding a new script tag that might be ignored.

const replacementJS = `
document.addEventListener('DOMContentLoaded', () => {
    // 1. Media Upload
    const mediaUploadBtn = document.querySelector('.fa-image')?.parentElement;
    if(mediaUploadBtn) {
        mediaUploadBtn.addEventListener('click', (e) => {
            e.preventDefault();
            const input = document.getElementById('mediaUpload');
            if(input) input.click();
        });
    }

    // 2. Enhance
    const enhanceBtn = document.getElementById('enhanceBtn');
    if(enhanceBtn) {
        enhanceBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            const text = document.getElementById('postContent').value;
            if(!text) return alert("Write some draft text first!");
            const oldHtml = enhanceBtn.innerHTML;
            enhanceBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Enhancing...';
            try {
              const enhanced = await ipcRenderer.invoke('generate-ai', "Rewrite and enhance this social media post draft to be highly engaging, adding relevant emojis and hashtags. Here is the draft: " + text);
              document.getElementById('postContent').value = enhanced;
            } catch(err) {
              alert("Failed to enhance: " + err.message);
            }
            enhanceBtn.innerHTML = oldHtml;
        });
    }

    // 3. Stock Photo
    const stockPhotoBtn = document.getElementById('stockPhotoBtn');
    if(stockPhotoBtn) {
        stockPhotoBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            const query = prompt("Enter a search term for a stock photo:");
            if(!query) return;
            const oldHtml = stockPhotoBtn.innerHTML;
            stockPhotoBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Searching...';
            try {
                const res = await ipcRenderer.invoke('search-stock-photo', query);
                if(res && res.success) {
                    document.getElementById('mediaUrl').value = res.imageUrl;
                    alert("Stock photo attached from " + res.source + "!");
                } else {
                    alert(res.error || "Failed to find image");
                }
            } catch(err) {
                alert("Search failed: " + err.message);
            }
            stockPhotoBtn.innerHTML = oldHtml;
        });
    }

    // 4. Generate Image
    const genImageBtn = document.getElementById('genImageBtn');
    if(genImageBtn) {
        genImageBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            const query = prompt("Describe the image you want AI to generate:");
            if(!query) return;
            const oldHtml = genImageBtn.innerHTML;
            genImageBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Generating...';
            try {
                const res = await ipcRenderer.invoke('generate-image', query);
                if(res && res.success) {
                    document.getElementById('mediaUrl').value = res.imageUrl;
                    alert("AI Image generated and attached!");
                } else {
                    alert(res.error || "Failed to generate image");
                }
            } catch(err) {
                alert("Generation failed: " + err.message);
            }
            genImageBtn.innerHTML = oldHtml;
        });
    }

    // 5. Publish
    const publishBtn = document.getElementById('publishBtn');
    if(publishBtn) {
        publishBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            const selectEl = document.getElementById('accountSelect');
            const selectedOption = selectEl.options[selectEl.selectedIndex];
            if(!selectedOption || !selectedOption.value) return alert('Select an account first.');
            
            const accountId = selectedOption.value;
            const platform = selectedOption.getAttribute('data-platform');
            const content = document.getElementById('postContent').value;
            const mediaUrl = document.getElementById('mediaUrl').value;
            const scheduleTime = document.getElementById('scheduleTime') ? document.getElementById('scheduleTime').value : null;
            
            if(!content && !mediaUrl) return alert('Add some text or media.');
            
            publishBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Publishing...';
            publishBtn.disabled = true;
            
            try {
               const res = await ipcRenderer.invoke('publish-post', { 
                 platform, accountId, content, hasMedia: !!mediaUrl, mediaUrl, scheduledDate: scheduleTime 
               });
               alert('Successfully published to ' + platform + '!');
               document.getElementById('postContent').value = '';
               document.getElementById('mediaUrl').value = '';
            } catch(err) {
               alert('Error: ' + err.message);
            }
            
            publishBtn.innerHTML = '<i class="fas fa-paper-plane"></i> Publish Now';
            publishBtn.disabled = false;
        });
    }
});
`;

// Inject into the main <script> tag right after the switchTab definition
if(html.includes('window.switchTab = function')) {
    html = html.replace('// Tab Switching Logic', replacementJS + '\n\n// Tab Switching Logic');
    fs.writeFileSync('content-hub.html', html, 'utf8');
    console.log('Injected raw event listeners directly into the main script block.');
} else {
    console.log('Could not find injection point');
}