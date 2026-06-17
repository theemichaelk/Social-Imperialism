const fs = require('fs');
let html = fs.readFileSync('content-hub.html', 'utf8');

// I am rewriting the script block handling the buttons so it's a completely self-contained window object literal,
// avoiding any node module scoping issues or DOMContentLoaded async timing problems.
// We will assign these directly to `window.social_api` object and call them via inline onclicks.

const newScript = `
<script>
// Expose the API explicitly to window for inline onclick usage
window.social_api = {
    addMedia: function() {
        document.getElementById('mediaUpload').click();
    },
    
    handleMediaUpload: async function(fileInput) {
        const file = fileInput.files[0];
        if(!file) return;
        try {
            const { ipcRenderer } = require('electron');
            const base64 = await ipcRenderer.invoke('upload-local-media', file.path);
            if(base64) document.getElementById('mediaUrl').value = base64;
        } catch(err) { alert(err.message); }
    },

    enhance: async function() {
        const text = document.getElementById('postContent').value;
        if(!text) return alert("Write some draft text first!");
        document.getElementById('btn-enhance').innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
        try {
            const { ipcRenderer } = require('electron');
            const enhanced = await ipcRenderer.invoke('generate-ai', "Enhance this: " + text);
            document.getElementById('postContent').value = enhanced;
        } catch(err) { alert(err.message); }
        document.getElementById('btn-enhance').innerHTML = '<i class="fas fa-magic"></i> Enhance';
    },

    stockPhoto: async function() {
        const query = prompt("Stock photo search term:");
        if(!query) return;
        document.getElementById('btn-stock-photo').innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
        try {
            const { ipcRenderer } = require('electron');
            const res = await ipcRenderer.invoke('search-stock-photo', query);
            if(res && res.success) document.getElementById('mediaUrl').value = res.imageUrl;
            else alert(res.error || "Failed");
        } catch(err) { alert(err.message); }
        document.getElementById('btn-stock-photo').innerHTML = '<i class="fas fa-camera"></i> Stock Photo';
    },

    genImage: async function() {
        const query = prompt("Generate image prompt:");
        if(!query) return;
        document.getElementById('btn-gen-image').innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
        try {
            const { ipcRenderer } = require('electron');
            const res = await ipcRenderer.invoke('generate-image', query);
            if(res && res.success) document.getElementById('mediaUrl').value = res.imageUrl;
            else alert(res.error || "Failed");
        } catch(err) { alert(err.message); }
        document.getElementById('btn-gen-image').innerHTML = '<i class="fas fa-paint-brush"></i> Generate Image';
    },

    publish: async function() {
        const selectEl = document.getElementById('accountSelect');
        const selectedOption = selectEl.options[selectEl.selectedIndex];
        if(!selectedOption || !selectedOption.value) return alert('Select an account first.');
        
        const accountId = selectedOption.value;
        const platform = selectedOption.getAttribute('data-platform');
        const content = document.getElementById('postContent').value;
        const mediaUrl = document.getElementById('mediaUrl').value;
        const scheduleTime = document.getElementById('scheduleTime') ? document.getElementById('scheduleTime').value : null;
        
        if(!content && !mediaUrl) return alert('Add text or media.');
        
        const btn = document.getElementById('btn-publish-post');
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Publishing...';
        btn.disabled = true;
        
        try {
            const { ipcRenderer } = require('electron');
            await ipcRenderer.invoke('publish-post', { 
                platform, accountId, content, hasMedia: !!mediaUrl, mediaUrl, scheduledDate: scheduleTime 
            });
            alert('Successfully published to ' + platform + '!');
            document.getElementById('postContent').value = '';
            document.getElementById('mediaUrl').value = '';
        } catch(err) {
            alert('Error: ' + err.message);
        }
        
        btn.innerHTML = '<i class="fas fa-paper-plane"></i> Publish Now';
        btn.disabled = false;
    }
};
</script>
`;

// Replace buttons to use the new object literal API
let newToolbar = `
      <div class="toolbar">
        <input type="file" id="mediaUpload" style="display:none" accept="image/*,video/*" onchange="window.social_api.handleMediaUpload(this)">
        <button class="tool-btn" id="btn-add-media" onclick="window.social_api.addMedia()"><i class="fas fa-image"></i> Add Media</button>
        <button class="tool-btn generate" id="btn-gen-image" onclick="window.social_api.genImage()"><i class="fas fa-paint-brush"></i> Generate Image</button>
        <button class="tool-btn generate" id="btn-stock-photo" onclick="window.social_api.stockPhoto()"><i class="fas fa-camera"></i> Stock Photo</button>
        <button class="tool-btn generate" id="btn-enhance" onclick="window.social_api.enhance()"><i class="fas fa-magic"></i> Enhance</button>
      </div>

      <textarea class="textarea-field" id="postContent" placeholder="Draft your content here. The AI Brain will analyze it against brand guidelines before publishing..."></textarea>
      
      ` + newScript + `
`;

// 1. Replace the old toolbar block completely
const startBlock = html.indexOf('<div class="toolbar">');
const endBlock = html.indexOf('</script>', startBlock) + 9;

if(startBlock > -1 && endBlock > -1) {
    html = html.substring(0, startBlock) + newToolbar + html.substring(endBlock);
}

// 2. Replace the publish button
const pubOld = '<button class="primary-btn" id="btn-publish-post"><i class="fas fa-paper-plane"></i> Publish Now</button>';
const pubNew = '<button class="primary-btn" id="btn-publish-post" onclick="window.social_api.publish()"><i class="fas fa-paper-plane"></i> Publish Now</button>';

html = html.replace(pubOld, pubNew);
html = html.replace(/<script>[\s\S]*?btn-publish-post[\s\S]*?<\/script>/, '');

fs.writeFileSync('content-hub.html', html, 'utf8');
console.log('Fixed Content Hub Buttons via window.social_api');