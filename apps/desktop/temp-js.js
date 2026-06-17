
const { ipcRenderer } = require('electron');

// Tab Switching Logic
window.switchTab = function(tabId) {
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
  
  event.currentTarget.classList.add('active');
  document.getElementById(tabId + '-tab').classList.add('active');
};

// Load Linked Accounts into the dropdown

async function loadAccounts() {
  const accounts = await ipcRenderer.invoke('get-linked-accounts');
  
  // 1. Main Standard Post Tab
  const select = document.getElementById('accountSelect');
  if(select) {
      select.innerHTML = '';
      if (accounts.length === 0) {
        let opt = document.createElement('option');
        opt.value = '';
        opt.innerText = 'No accounts linked (Go to Account Hub)';
        select.appendChild(opt);
      } else {
        accounts.forEach(a => {
            let opt = document.createElement('option');
            opt.value = a.id;
            opt.setAttribute('data-platform', a.platform); 
            opt.innerText = a.platform + ' - ' + a.handle;
            select.appendChild(opt);
        });
      }
  }

  // 2. Video Tab Select
  const vidSelect = document.getElementById('videoAccountSelect');
  if(vidSelect) {
      vidSelect.innerHTML = select ? select.innerHTML : '';
  }

  // 3. Comments Tab Select
  const cmtSelect = document.getElementById('commentsAccountSelect');
  if(cmtSelect) {
      cmtSelect.innerHTML = '<option value="">All Connected Accounts</option>';
      if(select && select.options.length > 0 && select.options[0].value !== '') {
          Array.from(select.options).forEach(opt => {
              if(opt.value) cmtSelect.appendChild(opt.cloneNode(true));
          });
      }
  }
}
document.addEventListener('DOMContentLoaded', () => loadAccounts());

// Brand & Keyword Logic
let currentKeywords = [];

function saveBrandProfile() {
    const profile = {
        name: document.getElementById('chBrandName').value,
        domain: document.getElementById('chBrandDomain').value,
        desc: document.getElementById('chBrandDesc').value,
        tone: document.getElementById('chBrandTone').value,
        audience: document.getElementById('chBrandAudience').value
    };
    localStorage.setItem('ch_brandProfile', JSON.stringify(profile));
    alert('Brand profile saved successfully!');
}

function loadBrandProfile() {
    try {
        const saved = localStorage.getItem('ch_brandProfile');
        if(saved) {
            const p = JSON.parse(saved);
            document.getElementById('chBrandName').value = p.name || '';
            document.getElementById('chBrandDomain').value = p.domain || '';
            document.getElementById('chBrandDesc').value = p.desc || '';
            document.getElementById('chBrandTone').value = p.tone || 'professional';
            document.getElementById('chBrandAudience').value = p.audience || '';
        }
    } catch(e){}
}

let pendingKeywords = ['Automation', 'Agency', 'Marketing', 'Sales', 'AI'];
async function suggestKeywords() {
    const desc = document.getElementById('chBrandDesc').value;
    const name = document.getElementById('chBrandName').value;
    if (!desc || !name) return alert('Please fill in Brand Name and Description first.');
    
    document.getElementById('keywordSuggestions').innerHTML = '<span style="color: #38bdf8;">Generating suggestions...</span>';
    
    try {
        const prompt = `Based on this brand: ` + name + ` - ` + desc + `. Suggest 5 relevant social media listening keywords as a comma-separated list.`;
        const res = await ipcRenderer.invoke('generate-ai', prompt);
        
        let kws = res.split(',').map(k => k.trim().replace(/^['"]|['"]$/g, '')).filter(k => k);
        let htmlStr = '';
        kws.forEach(k => {
            htmlStr += `<span style="background: #1e293b; border: 1px solid #38bdf8; padding: 0.25rem 0.75rem; border-radius: 999px; font-size: 0.85rem; cursor: pointer;" onclick="addKeywordToList(\"` + k + `\")">` + k + ` <i class="fas fa-plus" style="margin-left: 0.5rem;"></i></span>`;
        });
        document.getElementById('keywordSuggestions').innerHTML = htmlStr;
    } catch(e) {
        document.getElementById('keywordSuggestions').innerHTML = '<span style="color: #ef4444;">Failed to generate</span>';
    }
}

window.addManualKeyword = function() {
    const kw = document.getElementById('chManualKeyword').value.trim();
    if(kw) {
        addKeywordToList(kw);
        document.getElementById('chManualKeyword').value = '';
    }
}

window.addKeywordToList = function(kw) {
    if(currentKeywords.includes(kw)) return;
    currentKeywords.push(kw);
    renderPlatformKeywords();
}

function renderPlatformKeywords() {
    const container = document.getElementById('platformKeywordsList');
    if(currentKeywords.length === 0) {
        container.innerHTML = '<p style="color: #475569; text-align: center; margin: 0;">Add keywords to assign them to platforms.</p>';
        return;
    }
    
    let htmlStr = '';
    currentKeywords.forEach((kw, idx) => {
        htmlStr += `
        <div style="background: #0f172a; border: 1px solid #334155; padding: 0.75rem; border-radius: 6px; margin-bottom: 0.5rem;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
                <strong style="color: #f1f5f9;">` + kw + `</strong>
                <button onclick="removeKeyword(` + idx + `)" style="background: transparent; border: none; color: #ef4444; cursor: pointer;"><i class="fas fa-times"></i></button>
            </div>
            <div style="display: flex; gap: 1rem; font-size: 0.8rem; color: #94a3b8;">
                <label><input type="checkbox" checked> Twitter/X</label>
                <label><input type="checkbox" checked> LinkedIn</label>
                <label><input type="checkbox" checked> Facebook</label>
                <label><input type="checkbox"> Reddit</label>
                <label><input type="checkbox"> Instagram</label>
                <label><input type="checkbox"> TikTok</label>
                <label><input type="checkbox"> YouTube</label>
                <label><input type="checkbox"> Quora</label>
                <label><input type="checkbox"> Twitch</label>
                <label><input type="checkbox"> Snapchat</label>
                <label><input type="checkbox"> Pinterest</label>
                <label><input type="checkbox"> Discord</label>
                <label><input type="checkbox"> Telegram</label>
                <label><input type="checkbox"> WhatsApp</label>
            </div>
        </div>`;
    });
    container.innerHTML = htmlStr;
}

window.removeKeyword = function(idx) {
    currentKeywords.splice(idx, 1);
    renderPlatformKeywords();
}




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

// Toolbar Actions (Mock/Stubs linking to existing IPCs if available)
document.getElementById('enhanceBtn').addEventListener('click', async () => {
    const text = document.getElementById('postContent').value;
    if(!text) return alert("Write some draft text first!");
    
    document.getElementById('postContent').value = "Enhancing with AI...";
    try {
      const enhanced = await ipcRenderer.invoke('generate-ai', "Rewrite and enhance this social media post draft to be highly engaging, adding relevant emojis and hashtags. Here is the draft: " + text);
      document.getElementById('postContent').value = enhanced;
    } catch(e) {
      alert("Failed to enhance: " + e.message);
      document.getElementById('postContent').value = text;
    }
});

document.getElementById('stockPhotoBtn').addEventListener('click', async () => {
    const query = prompt("Enter a search term for a stock photo:");
    if(!query) return;
    
    document.getElementById('mediaUrl').value = "Searching Pexels/Pixabay/Flickr...";
    
    try {
        const res = await ipcRenderer.invoke('search-stock-photo', query);
        if(res && res.success) {
            document.getElementById('mediaUrl').value = res.imageUrl;
            alert("Stock photo attached from " + res.source + "!");
        } else {
            document.getElementById('mediaUrl').value = "";
            alert(res.error || "Failed to find image");
        }
    } catch(e) {
        document.getElementById('mediaUrl').value = "";
        alert("Search failed: " + e.message);
    }
});

document.getElementById('genImageBtn').addEventListener('click', async () => {
    const query = prompt("Describe the image you want AI to generate:");
    if(!query) return;
    
    document.getElementById('mediaUrl').value = "Generating via FAL AI...";
    
    try {
        const res = await ipcRenderer.invoke('generate-image', query);
        if(res && res.success) {
            document.getElementById('mediaUrl').value = res.imageUrl;
            alert("AI Image generated and attached!");
        } else {
            document.getElementById('mediaUrl').value = "";
            alert(res.error || "Failed to generate image");
        }
    } catch(e) {
        document.getElementById('mediaUrl').value = "";
        alert("Generation failed: " + e.message);
    }
});

// Scheduling Toggle
let schedulingMode = false;
document.getElementById('scheduleBtn').addEventListener('click', () => {
    schedulingMode = !schedulingMode;
    document.getElementById('scheduleOptions').style.display = schedulingMode ? 'block' : 'none';
    document.getElementById('scheduleBtn').style.background = schedulingMode ? '#38bdf8' : '#1e293b';
    document.getElementById('scheduleBtn').style.color = schedulingMode ? '#020617' : 'white';
    document.getElementById('publishBtn').innerHTML = schedulingMode ? '<i class="fas fa-calendar-check"></i> Confirm Schedule' : '<i class="fas fa-paper-plane"></i> Publish';
});

// Publish / Schedule Action
document.getElementById('publishBtn').addEventListener('click', async () => {
  const selectEl = document.getElementById('accountSelect');
  const selectedOption = selectEl.options[selectEl.selectedIndex];
  
  if(!selectedOption || !selectedOption.value) return alert('Please link and select a social account first.');
  
  const accountId = selectedOption.value;
  const platform = selectedOption.getAttribute('data-platform');
  const content = document.getElementById('postContent').value;
  const mediaUrl = document.getElementById('mediaUrl').value;
  const scheduleTime = document.getElementById('scheduleTime').value;

  if(!content) return alert('Please enter post content.');
  
  const publishBtn = document.getElementById('publishBtn');
  publishBtn.disabled = true;
  publishBtn.innerText = "Processing...";
  
  try {
      if(schedulingMode) {
        if(!scheduleTime) {
            publishBtn.disabled = false;
            publishBtn.innerHTML = '<i class="fas fa-calendar-check"></i> Confirm Schedule';
            return alert('Please select a date and time.');
        }
        await ipcRenderer.invoke('schedule-post', { platform, accountId, content, mediaUrl, scheduleTime });
        alert('Post Scheduled Successfully!');
        if(confirm('View in Calendar?')) window.location.href = 'calendar.html';
      } else {
        await ipcRenderer.invoke('publish-post', { platform, accountId, content, hasMedia: !!mediaUrl, mediaUrl });
        alert('Post Published Successfully via ' + platform + ' API!');
        document.getElementById('postContent').value = '';
        document.getElementById('mediaUrl').value = '';
      }
  } catch (err) {
      alert("Error publishing: " + err.message);
  }
  
  publishBtn.disabled = false;
  publishBtn.innerHTML = schedulingMode ? '<i class="fas fa-calendar-check"></i> Confirm Schedule' : '<i class="fas fa-paper-plane"></i> Publish';
});

// Video Tab Logic



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


// Manage Comments / Replies Tab Logic


window.simulateNewComment = function() {
    document.getElementById('inboxZeroState').style.display = 'none';
    const container = document.getElementById('commentsInboxContainer');
    
    const div = document.createElement('div');
    div.style.cssText = "background: rgba(15,23,42,0.6); border: 1px solid #334155; border-radius: 8px; padding: 1.5rem; margin-bottom: 1rem;";
    
    const brand = localStorage.getItem('ch_brandProfile') ? JSON.parse(localStorage.getItem('ch_brandProfile')).name : 'Our Brand';
    
    div.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom: 1rem;">
            <div>
                <strong style="color: #f1f5f9;"><i class="fab fa-twitter" style="color:#38bdf8;"></i> @PotentialClient</strong>
                <span style="color: #64748b; font-size: 0.8rem; margin-left: 0.5rem;">2 mins ago</span>
            </div>
            <span style="background: rgba(56, 189, 248, 0.1); color: #38bdf8; padding: 0.2rem 0.5rem; border-radius: 4px; font-size: 0.75rem; border: 1px solid #38bdf8;">Keyword Hit: ${currentKeywords[0] || 'Automation'}</span>
        </div>
        <p style="color: #cbd5e1; margin-bottom: 1.5rem; font-size: 1.1rem;">"Does anyone know a good tool for managing social media marketing across multiple pages? Need something reliable."</p>
        
        <div style="background: rgba(2, 6, 23, 0.8); border: 1px solid #475569; border-left: 3px solid #10b981; padding: 1rem; border-radius: 4px;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.5rem;">
                <span style="color:#10b981; font-weight:bold; font-size:0.85rem;"><i class="fas fa-robot"></i> AI Drafted Reply (Auto-Rules)</span>
            </div>
            <textarea class="textarea-field" style="min-height: 80px; margin-bottom:0.5rem;" id="draftReply_1">Hey! ${brand} actually specializes in exactly this. We help you automate posting and replies across 10+ platforms reliably. Let me know if you want to chat!</textarea>
            <div style="display:flex; gap:0.5rem; align-items:center;">
                <button class="primary-btn" style="padding: 0.5rem 1rem; font-size: 0.85rem;" onclick="approveReply(this)"><i class="fas fa-check"></i> Approve &amp; Reply</button>
                <button class="secondary-btn" style="padding: 0.5rem 1rem; font-size: 0.85rem;" onclick="this.parentElement.parentElement.parentElement.remove()"><i class="fas fa-times"></i> Discard</button>
                <div style="margin-left: auto; display:flex; gap:0.5rem;">
                    <button class="tool-btn" title="Like"><i class="fas fa-heart"></i></button>
                    <button class="tool-btn" title="Retweet/Share"><i class="fas fa-retweet"></i></button>
                </div>
            </div>
        </div>
    `;
    
    container.appendChild(div);
}

window.approveReply = async function(btnEl) {
    btnEl.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Sending...';
    btnEl.disabled = true;
    
    setTimeout(() => {
        btnEl.innerHTML = '<i class="fas fa-check-double"></i> Replied!';
        btnEl.style.background = '#10b981';
        setTimeout(() => {
            btnEl.parentElement.parentElement.parentElement.style.opacity = '0.5';
            setTimeout(() => {
                btnEl.parentElement.parentElement.parentElement.remove();
                if(document.getElementById('commentsInboxContainer').children.length === 1) {
                    document.getElementById('inboxZeroState').style.display = 'block';
                }
            }, 500);
        }, 1500);
    }, 1500);
}

