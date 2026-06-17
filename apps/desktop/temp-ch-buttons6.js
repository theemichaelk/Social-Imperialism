const fs = require('fs');
let html = fs.readFileSync('content-hub.html', 'utf8');

// The DOM element IS found (red border appeared), but inline onclick handlers must be blocked by Content Security Policy (CSP) in Electron.
// We need to attach event listeners programmatically within the JS block.

const newListenersScript = `
<script>
document.addEventListener('DOMContentLoaded', () => {
    // Media Upload
    const mediaUploadBtn = document.querySelector('button[onclick="document.getElementById(\\'mediaUpload\\').click()"]');
    if(mediaUploadBtn) {
        mediaUploadBtn.onclick = null; // clear inline
        mediaUploadBtn.addEventListener('click', () => {
            const input = document.getElementById('mediaUpload');
            if(input) input.click();
        });
    }

    // Enhance
    const enhanceBtn = document.getElementById('enhanceBtn');
    if(enhanceBtn) {
        enhanceBtn.onclick = null;
        enhanceBtn.addEventListener('click', async () => {
            const text = document.getElementById('postContent').value;
            if(!text) return alert("Write some draft text first!");
            enhanceBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Enhancing...';
            try {
              const enhanced = await require('electron').ipcRenderer.invoke('generate-ai', "Rewrite and enhance this social media post draft to be highly engaging, adding relevant emojis and hashtags. Here is the draft: " + text);
              document.getElementById('postContent').value = enhanced;
            } catch(e) {
              alert("Failed to enhance: " + e.message);
            }
            enhanceBtn.innerHTML = '<i class="fas fa-sparkles"></i> Enhance';
        });
    }

    // Stock Photo
    const stockPhotoBtn = document.getElementById('stockPhotoBtn');
    if(stockPhotoBtn) {
        stockPhotoBtn.onclick = null;
        stockPhotoBtn.addEventListener('click', async () => {
            const query = prompt("Enter a search term for a stock photo:");
            if(!query) return;
            stockPhotoBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Searching...';
            try {
                const res = await require('electron').ipcRenderer.invoke('search-stock-photo', query);
                if(res && res.success) {
                    document.getElementById('mediaUrl').value = res.imageUrl;
                    alert("Stock photo attached from " + res.source + "!");
                } else {
                    alert(res.error || "Failed to find image");
                }
            } catch(e) {
                alert("Search failed: " + e.message);
            }
            stockPhotoBtn.innerHTML = '<i class="fas fa-camera"></i> Stock Photo';
        });
    }

    // Generate Image
    const genImageBtn = document.getElementById('genImageBtn');
    if(genImageBtn) {
        genImageBtn.onclick = null;
        genImageBtn.addEventListener('click', async () => {
            const query = prompt("Describe the image you want AI to generate:");
            if(!query) return;
            genImageBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Generating...';
            try {
                const res = await require('electron').ipcRenderer.invoke('generate-image', query);
                if(res && res.success) {
                    document.getElementById('mediaUrl').value = res.imageUrl;
                    alert("AI Image generated and attached!");
                } else {
                    alert(res.error || "Failed to generate image");
                }
            } catch(e) {
                alert("Generation failed: " + e.message);
            }
            genImageBtn.innerHTML = '<i class="fas fa-magic"></i> Generate Image';
        });
    }

    // Publish
    const publishBtn = document.getElementById('publishBtn');
    if(publishBtn) {
        publishBtn.onclick = null;
        publishBtn.addEventListener('click', async () => {
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
               const res = await require('electron').ipcRenderer.invoke('publish-post', { 
                 platform, accountId, content, hasMedia: !!mediaUrl, mediaUrl, scheduledDate: scheduleTime 
               });
               alert('Successfully published to ' + platform + '!');
               document.getElementById('postContent').value = '';
               document.getElementById('mediaUrl').value = '';
            } catch(e) {
               alert('Error: ' + e.message);
            }
            
            publishBtn.innerHTML = '<i class="fas fa-paper-plane"></i> Publish Now';
            publishBtn.disabled = false;
        });
    }
});
</script>
`;

// remove the diagnostic block and append the new listener block right before </body>
html = html.replace(/<script>\s*window\.onerror = function[\s\S]*?<\/script>\s*<\/body>/, newListenersScript + '\n</body>');
if(!html.includes('Enhancing...')) {
    html = html.replace('</body>', newListenersScript + '\n</body>');
}
fs.writeFileSync('content-hub.html', html, 'utf8');
console.log('Appended DOMContentLoaded listeners for Content Hub buttons');