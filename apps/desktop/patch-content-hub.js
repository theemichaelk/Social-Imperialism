const fs = require('fs');
let html = fs.readFileSync('content-hub.html', 'utf8');

// Replace "Add Media" button with file picker
const addMediaOld = `<button class="tool-btn" onclick="document.getElementById('mediaUrl').focus()"><i class="fas fa-image"></i> Add Media</button>`;
const addMediaNew = `
        <input type="file" id="mediaUpload" style="display:none" accept="image/*,video/*">
        <button class="tool-btn" onclick="document.getElementById('mediaUpload').click()"><i class="fas fa-image"></i> Add Media</button>
`;

if(html.includes(addMediaOld)) {
    html = html.replace(addMediaOld, addMediaNew);
}

// Add File Upload Logic to JS
const jsUploadLogic = `
document.getElementById('mediaUpload').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if(!file) return;
    document.getElementById('mediaUrl').value = "Uploading: " + file.name + "...";
    try {
        const filePath = file.path; // Available in Electron
        const base64 = await ipcRenderer.invoke('upload-local-media', filePath);
        if(base64) {
            document.getElementById('mediaUrl').value = base64;
            alert('Media attached successfully!');
        } else {
            document.getElementById('mediaUrl').value = "";
            alert('Failed to attach media.');
        }
    } catch(err) {
        document.getElementById('mediaUrl').value = "";
        alert('Upload Error: ' + err.message);
    }
});
`;

if(!html.includes('mediaUpload\').addEventListener')) {
    html = html.replace('// Toolbar Actions', jsUploadLogic + '\n// Toolbar Actions');
}

fs.writeFileSync('content-hub.html', html, 'utf8');
console.log('Patched Add Media in Content Hub');