const fs = require('fs');
let html = fs.readFileSync('content-hub.html', 'utf8');

// Replace Video Tab Placeholder with actual upload logic and selectors
const oldMediaTab = `    <!-- MEDIA TAB (Placeholder) -->
    <div id="media-tab" class="tab-content">
      <div class="media-preview">
        <span><i class="fas fa-cloud-upload-alt fa-2x"></i><br><br>Drag &amp; Drop MP4/MOV or Click to Browse</span>
      </div>
      <textarea class="textarea-field" style="min-height: 80px;" placeholder="Reel / Video Caption..."></textarea>
      <div class="action-row">
        <button class="primary-btn"><i class="fas fa-paper-plane"></i> Publish Video</button>
      </div>
    </div>`;

const newMediaTab = `    <!-- MEDIA TAB -->
    <div id="media-tab" class="tab-content">
      <div class="two-col">
        <div>
          <label>Social Account (Video/Reels)</label>
          <select class="input-field" id="videoAccountSelect">
            <option value="">Loading accounts...</option>
          </select>
        </div>
        <div>
          <label>Format Size</label>
          <select class="input-field" id="videoFormatSelect">
            <option value="9:16">Stories / Reels / Shorts (9:16)</option>
            <option value="1:1">Square Video (1:1)</option>
            <option value="16:9">Standard Video (16:9)</option>
          </select>
        </div>
      </div>
      
      <input type="file" id="videoUploadFile" accept="video/*" style="display:none">
      <div class="media-preview" id="videoDropzone" onclick="document.getElementById('videoUploadFile').click()" style="height: 200px; display: flex; flex-direction: column; gap: 10px;">
        <i class="fas fa-cloud-upload-alt fa-3x" id="videoIcon"></i>
        <span id="videoUploadText">Drag &amp; Drop MP4/MOV or Click to Browse</span>
        <video id="videoPreviewElement" style="display:none; max-height:150px; border-radius:4px;" controls></video>
      </div>
      
      <div class="toolbar">
        <button class="tool-btn generate" onclick="enhanceVideoCaption()"><i class="fas fa-magic"></i> AI Write Caption</button>
      </div>

      <textarea class="textarea-field" id="videoCaption" style="min-height: 120px;" placeholder="Write your highly engaging Reel/Video caption here..."></textarea>
      
      <input type="hidden" id="videoBase64Store">

      <div class="action-row">
        <div class="publishing-options">
          <button class="secondary-btn" onclick="scheduleVideo()"><i class="fas fa-clock"></i> Schedule Video</button>
        </div>
        <button class="primary-btn" id="publishVideoBtn"><i class="fas fa-paper-plane"></i> Publish Video</button>
      </div>
    </div>`;

if(html.includes('<!-- MEDIA TAB (Placeholder) -->')) {
    html = html.replace(oldMediaTab, newMediaTab);
    
    // Add logic
    const videoLogic = `
// Video Tab Logic
function cloneAccountsToVideoSelect() {
    const mainSelect = document.getElementById('accountSelect');
    const vidSelect = document.getElementById('videoAccountSelect');
    if(!vidSelect) return;
    vidSelect.innerHTML = mainSelect.innerHTML;
}
// We hook into loadAccounts to do this
const originalLoadAccounts = loadAccounts;
window.loadAccounts = async function() {
    await originalLoadAccounts();
    cloneAccountsToVideoSelect();
}

document.getElementById('videoUploadFile').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if(!file) return;
    
    document.getElementById('videoIcon').style.display = 'none';
    document.getElementById('videoUploadText').innerText = 'Processing video: ' + file.name;
    
    // Read local file as base64 for submission
    try {
        const base64 = await ipcRenderer.invoke('upload-local-media', file.path);
        if(base64) {
            document.getElementById('videoBase64Store').value = base64;
            document.getElementById('videoPreviewElement').src = base64;
            document.getElementById('videoPreviewElement').style.display = 'block';
            document.getElementById('videoUploadText').innerText = file.name + ' (Ready)';
        }
    } catch(err) {
        alert("Failed to load video: " + err.message);
    }
});

window.enhanceVideoCaption = async function() {
    const text = document.getElementById('videoCaption').value;
    if(!text) return alert("Write some draft text first!");
    document.getElementById('videoCaption').value = "AI is writing viral caption...";
    try {
      const enhanced = await ipcRenderer.invoke('generate-ai', "Rewrite this as a highly viral TikTok/Reels caption with great hooks and hashtags: " + text);
      document.getElementById('videoCaption').value = enhanced;
    } catch(e) {
      alert("Failed: " + e.message);
      document.getElementById('videoCaption').value = text;
    }
}

document.getElementById('publishVideoBtn').addEventListener('click', async () => {
  const selectEl = document.getElementById('videoAccountSelect');
  const selectedOption = selectEl.options[selectEl.selectedIndex];
  if(!selectedOption || !selectedOption.value) return alert('Select an account.');
  
  const accountId = selectedOption.value;
  const platform = selectedOption.getAttribute('data-platform');
  const content = document.getElementById('videoCaption').value;
  const base64Video = document.getElementById('videoBase64Store').value;
  
  if(!base64Video) return alert('Please attach a video first.');
  
  const btn = document.getElementById('publishVideoBtn');
  btn.innerText = "Publishing...";
  btn.disabled = true;
  
  try {
     await ipcRenderer.invoke('publish-post', { platform, accountId, content, hasMedia: true, mediaUrl: base64Video, isVideo: true });
     alert('Video Published Successfully via ' + platform + ' API!');
     document.getElementById('videoCaption').value = '';
     document.getElementById('videoBase64Store').value = '';
     document.getElementById('videoPreviewElement').style.display = 'none';
     document.getElementById('videoIcon').style.display = 'block';
     document.getElementById('videoUploadText').innerText = 'Drag & Drop MP4/MOV or Click to Browse';
  } catch(e) {
     alert('Error: ' + e.message);
  }
  
  btn.innerHTML = '<i class="fas fa-paper-plane"></i> Publish Video';
  btn.disabled = false;
});

window.scheduleVideo = async function() {
   alert('Scheduled Video added to Calendar Queue! (Simulated)');
}
`;
    
    // insert right before </script>
    html = html.replace('</script>', videoLogic + '\n</script>');
    fs.writeFileSync('content-hub.html', html, 'utf8');
    console.log('Video Tab successfully updated');
} else {
    console.log('Could not find placeholder media tab');
}