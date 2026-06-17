const fs = require('fs');
let html = fs.readFileSync('content-hub.html', 'utf8');

const newTabs = `
    <!-- Tabs -->
    <div class="tabs">
      <div class="tab active" onclick="switchTab('standard')"><i class="fas fa-pen"></i> Standard Post</div>
      <div class="tab" onclick="switchTab('media')"><i class="fas fa-video"></i> Video / Reel / Media</div>
      <div class="tab" onclick="switchTab('repurpose')"><i class="fas fa-recycle"></i> Repurpose Content</div>
      <div class="tab" onclick="switchTab('analytics')"><i class="fas fa-chart-line"></i> Post Analytics</div>
    </div>
`;
html = html.replace(/<div class="tabs">[\s\S]*?<\/div>/, newTabs);

const newRepurposeTab = `
    <!-- REPURPOSE CONTENT TAB -->
    <div id="repurpose-tab" class="tab-content">
      <div style="background: rgba(15, 23, 42, 0.5); padding: 1.5rem; border-radius: 8px; border: 1px solid #334155;">
        <h3 class="section-title"><i class="fab fa-youtube"></i> YouTube to Short-Form Video</h3>
        <p style="color: #94a3b8; font-size: 0.9rem; margin-bottom: 1rem;">Paste any YouTube URL. Our AI will download it, identify the best hooks, and cut it into TikTok/Reels/Shorts clips ready for scheduling.</p>
        <div style="display:flex; gap: 0.5rem; margin-bottom: 1rem;">
          <input type="text" class="input-field" id="ytUrlInput" style="margin-bottom:0;" placeholder="https://youtube.com/watch?v=...">
          <button class="primary-btn" onclick="processYouTubeUrl()"><i class="fas fa-cut"></i> Auto-Cut Video</button>
        </div>
        <div id="ytProcessingStatus" style="color: #38bdf8; display:none; margin-bottom: 1rem;"><i class="fas fa-spinner fa-spin"></i> Downloading and analyzing video structure...</div>
      </div>
      
      <div style="background: rgba(15, 23, 42, 0.5); padding: 1.5rem; border-radius: 8px; border: 1px solid #334155; margin-top: 1.5rem;">
        <h3 class="section-title"><i class="fas fa-file-alt"></i> Blog / PDF to LinkedIn Post / Carousel</h3>
        <p style="color: #94a3b8; font-size: 0.9rem; margin-bottom: 1rem;">Paste a blog URL or raw text/PDF content. The AI will format it into an engaging LinkedIn post or Carousel.</p>
        <textarea id="blogPdfInput" class="textarea-field" style="min-height: 100px;" placeholder="Paste Blog URL or raw text here..."></textarea>
        <div style="display:flex; gap: 1rem;">
          <button class="primary-btn" onclick="generateFromBlog('post')"><i class="fas fa-magic"></i> Generate Post</button>
          <button class="secondary-btn" onclick="generateFromBlog('carousel')" style="color: #a855f7; border-color: #a855f7;"><i class="fas fa-layer-group"></i> Create Carousel</button>
        </div>
      </div>
    </div>

    <!-- POST ANALYTICS TAB -->
    <div id="analytics-tab" class="tab-content">
      <div style="background: rgba(15, 23, 42, 0.5); padding: 1.5rem; border-radius: 8px; border: 1px solid #334155;">
        <h3 class="section-title"><i class="fas fa-chart-bar"></i> Detailed Post Insights</h3>
        <p style="color: #94a3b8; font-size: 0.9rem; margin-bottom: 1rem;">Track and measure your performance across all channels to optimize future content.</p>
        
        <table style="width: 100%; border-collapse: collapse; text-align: left; color: #cbd5e1; font-size: 0.9rem;">
          <tr style="border-bottom: 1px solid #475569;">
            <th style="padding: 10px;">Post Content</th>
            <th style="padding: 10px;">Platform</th>
            <th style="padding: 10px;">Impressions</th>
            <th style="padding: 10px;">Engagement Rate</th>
            <th style="padding: 10px;">Leads Gen</th>
          </tr>
          <tr style="border-bottom: 1px solid #334155; background: rgba(255,255,255,0.02);">
            <td style="padding: 10px;">The biggest mistake founders make...</td>
            <td style="padding: 10px; color:#0A66C2;">LinkedIn</td>
            <td style="padding: 10px; color:#34d399;">12,450</td>
            <td style="padding: 10px;">4.2%</td>
            <td style="padding: 10px;">+8</td>
          </tr>
          <tr style="border-bottom: 1px solid #334155;">
            <td style="padding: 10px;">New feature drop! Automate your...</td>
            <td style="padding: 10px; color:#38bdf8;">Twitter</td>
            <td style="padding: 10px;">8,200</td>
            <td style="padding: 10px;">2.1%</td>
            <td style="padding: 10px;">+2</td>
          </tr>
        </table>
      </div>
    </div>
`;

html = html.replace(/<!-- MEDIA TAB -->[\s\S]*?<\/div>\s*<!-- COMMENTS TAB -->/, '<!-- MEDIA TAB -->\n    <div id="media-tab" class="tab-content">\n      <div class="two-col">\n        <div>\n          <label>Social Account (Video/Reels)</label>\n          <select class="input-field" id="videoAccountSelect">\n            <option value="">Loading accounts...</option>\n          </select>\n        </div>\n        <div>\n          <label>Format Size</label>\n          <select class="input-field" id="videoFormatSelect">\n            <option value="9:16">Stories / Reels / Shorts (9:16)</option>\n            <option value="1:1">Square Video (1:1)</option>\n            <option value="16:9">Standard Video (16:9)</option>\n          </select>\n        </div>\n      </div>\n      \n      <input type="file" id="videoUploadFile" accept="video/*" style="display:none">\n      <div class="media-preview" id="videoDropzone" onclick="document.getElementById(\'videoUploadFile\').click()" style="height: 200px; display: flex; flex-direction: column; gap: 10px;">\n        <i class="fas fa-cloud-upload-alt fa-3x" id="videoIcon"></i>\n        <span id="videoUploadText">Drag &amp; Drop MP4/MOV or Click to Browse</span>\n        <video id="videoPreviewElement" style="display:none; max-height:150px; border-radius:4px;" controls></video>\n      </div>\n      \n      <div class="toolbar">\n        <button class="tool-btn generate" onclick="enhanceVideoCaption()"><i class="fas fa-magic"></i> AI Write Caption</button>\n      </div>\n\n      <textarea class="textarea-field" id="videoCaption" style="min-height: 120px;" placeholder="Write your highly engaging Reel/Video caption here..."></textarea>\n      \n      <input type="hidden" id="videoBase64Store">\n\n      <div class="action-row">\n        <div class="publishing-options">\n          <button class="secondary-btn" onclick="scheduleVideo()"><i class="fas fa-clock"></i> Schedule Video</button>\n        </div>\n        <button class="primary-btn" id="publishVideoBtn"><i class="fas fa-paper-plane"></i> Publish Video</button>\n      </div>\n    </div>\n\n' + newRepurposeTab);

// add tools to standard post tab
const newTools = `
      <div class="toolbar">
        <input type="file" id="mediaUpload" style="display:none" accept="image/*,video/*" onchange="window.social_api.handleMediaUpload(this)">
        <button class="tool-btn" id="btn-add-media" onclick="window.social_api.addMedia()"><i class="fas fa-image"></i> Add Media</button>
        <button class="tool-btn" id="btn-voice-note" onclick="recordVoiceNote()"><i class="fas fa-microphone"></i> Voice Note to Post</button>
        <button class="tool-btn generate" id="btn-gen-image" onclick="window.social_api.genImage()"><i class="fas fa-paint-brush"></i> Generate Image</button>
        <button class="tool-btn generate" id="btn-stock-photo" onclick="window.social_api.stockPhoto()"><i class="fas fa-camera"></i> Stock Photo</button>
        <button class="tool-btn generate" id="btn-enhance" onclick="window.social_api.enhance()"><i class="fas fa-magic"></i> Enhance</button>
        <button class="tool-btn generate" onclick="generateFromSwipeFile()"><i class="fas fa-lightbulb"></i> Use Swipe File</button>
      </div>
`;
html = html.replace(/<div class="toolbar">[\s\S]*?<\/div>/, newTools);

const newScripts = `
function processYouTubeUrl() {
    const url = document.getElementById('ytUrlInput').value;
    if(!url) return alert('Enter a YouTube URL');
    document.getElementById('ytProcessingStatus').style.display = 'block';
    setTimeout(() => {
        document.getElementById('ytProcessingStatus').style.display = 'none';
        alert('Simulated: Video downloaded, processed by AI, and split into 3 high-retention clips. Check the "Video / Reel / Media" tab to schedule them.');
    }, 2500);
}

function generateFromBlog(type) {
    const input = document.getElementById('blogPdfInput').value;
    if(!input) return alert('Enter URL or text');
    alert('Simulated: Converting source material into an optimized ' + type + ' using Gemini API...');
}

let isRecording = false;
function recordVoiceNote() {
    const btn = document.getElementById('btn-voice-note');
    if(!isRecording) {
        isRecording = true;
        btn.innerHTML = '<i class="fas fa-stop-circle" style="color:red;"></i> Recording... (Click to stop)';
        btn.style.borderColor = 'red';
    } else {
        isRecording = false;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Transcribing...';
        setTimeout(() => {
            btn.innerHTML = '<i class="fas fa-microphone"></i> Voice Note to Post';
            btn.style.borderColor = '#475569';
            document.getElementById('postContent').value = "Here's the AI formatted post derived from your raw audio thought. The system transcribed the audio and applied your brand tone perfectly.";
        }, 1500);
    }
}

function generateFromSwipeFile() {
    alert('Simulated: Opening Swipe File library to select a viral template framework...');
}
`;

html = html.replace(/window\.switchTab = function\(tabId\) \{/, newScripts + '\n\nwindow.switchTab = function(tabId) {');

fs.writeFileSync('content-hub.html', html, 'utf8');
console.log('Content Hub updated with new tools, Repurposing, and Analytics features.');