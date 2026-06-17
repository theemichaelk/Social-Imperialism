const fs = require('fs');
let html = fs.readFileSync('content-hub.html', 'utf8');

// 1. Add Tab Button
const tabButtonHtml = '<div class="tab" onclick="switchTab(\'brand\')"><i class="fas fa-bullseye"></i> Brand & Keywords</div>';

if (!html.includes('switchTab(\'brand\')')) {
    html = html.replace('<div class="tab" onclick="switchTab(\'comments\')"><i class="fas fa-comments"></i> Manage Comments / Replies</div>', 
                        '<div class="tab" onclick="switchTab(\'comments\')"><i class="fas fa-comments"></i> Manage Comments / Replies</div>\n      ' + tabButtonHtml);
}

// 2. Add Tab Content
const tabContentHtml = `
    <!-- BRAND & KEYWORDS TAB -->
    <div id="brand-tab" class="tab-content">
      <div class="two-col">
        <div style="background: rgba(15, 23, 42, 0.5); padding: 1.5rem; border-radius: 8px; border: 1px solid #334155;">
          <h3 class="section-title">1. Brand Profile</h3>
          <label>Brand Name</label>
          <input type="text" class="input-field" id="chBrandName" placeholder="e.g. Acme Corp">
          <label>Brand Domain</label>
          <input type="text" class="input-field" id="chBrandDomain" placeholder="e.g. acme.com">
          <label>Brand Description</label>
          <textarea class="textarea-field" id="chBrandDesc" style="min-height: 80px;" placeholder="What does your brand do?"></textarea>
          <label>Tone of Voice</label>
          <select class="input-field" id="chBrandTone">
            <option value="professional">Professional</option>
            <option value="casual">Casual / Friendly</option>
            <option value="humorous">Humorous</option>
          </select>
          <label>Target Audience (Optional)</label>
          <input type="text" class="input-field" id="chBrandAudience" placeholder="e.g. Small business owners">
          <button class="primary-btn" style="width: 100%; justify-content: center;" onclick="saveBrandProfile()">Save Profile</button>
        </div>
        
        <div style="background: rgba(15, 23, 42, 0.5); padding: 1.5rem; border-radius: 8px; border: 1px solid #334155;">
          <h3 class="section-title">2. Keywords &amp; Platforms</h3>
          <p style="color: #94a3b8; font-size: 0.9rem; margin-bottom: 1rem;">Let AI suggest keywords based on your brand profile, or add them manually.</p>
          <button class="tool-btn generate" style="margin-bottom: 1rem; width: 100%; justify-content: center;" onclick="suggestKeywords()"><i class="fas fa-magic"></i> AI Suggest Keywords</button>
          
          <div id="keywordSuggestions" style="margin-bottom: 1rem; display: flex; flex-wrap: wrap; gap: 0.5rem;"></div>

          <label>Add Manual Keyword</label>
          <div style="display: flex; gap: 0.5rem; margin-bottom: 1rem;">
            <input type="text" class="input-field" id="chManualKeyword" style="margin-bottom: 0;" placeholder="e.g. marketing automation">
            <button class="secondary-btn" onclick="addManualKeyword()">Add</button>
          </div>

          <label>Per-Platform Keyword Rules</label>
          <div style="background: #020617; border: 1px solid #475569; border-radius: 6px; padding: 1rem; max-height: 200px; overflow-y: auto;" id="platformKeywordsList">
            <p style="color: #475569; text-align: center; margin: 0;">Add keywords to assign them to platforms.</p>
          </div>
        </div>
      </div>
    </div>
`;

if (!html.includes('id="brand-tab"')) {
    html = html.replace('<!-- COMMENTS TAB (Placeholder) -->', tabContentHtml + '\n    <!-- COMMENTS TAB (Placeholder) -->');
}

// 3. Add JS Logic
const jsContentHtml = `
// Brand & Keyword Logic
let currentKeywords = [];

function saveBrandProfile() {
    // Basic LocalStorage save
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

async function suggestKeywords() {
    const desc = document.getElementById('chBrandDesc').value;
    const name = document.getElementById('chBrandName').value;
    if (!desc || !name) return alert('Please fill in Brand Name and Description first.');
    
    document.getElementById('keywordSuggestions').innerHTML = '<span style="color: #38bdf8;">Generating suggestions...</span>';
    
    try {
        const prompt = \`Based on this brand: ${name} - ${desc}. Suggest 5 relevant social media listening keywords as a comma-separated list.\`;
        const res = await ipcRenderer.invoke('generate-ai', prompt);
        
        let kws = res.split(',').map(k => k.trim().replace(/^[\'\"]|[\'\"]$/g, '')).filter(k => k);
        let htmlStr = '';
        kws.forEach(k => {
            htmlStr += `<span style="background: #1e293b; border: 1px solid #38bdf8; padding: 0.25rem 0.75rem; border-radius: 999px; font-size: 0.85rem; cursor: pointer;" onclick="addKeywordToList(\'${k}\')">${k} <i class="fas fa-plus" style="margin-left: 0.5rem;"></i></span>`\
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
                <strong style="color: #f1f5f9;">${kw}</strong>
                <button onclick="removeKeyword(${idx})" style="background: transparent; border: none; color: #ef4444; cursor: pointer;"><i class="fas fa-times"></i></button>
            </div>
            <div style="display: flex; gap: 1rem; font-size: 0.8rem; color: #94a3b8;">
                <label><input type="checkbox" checked> Twitter/X</label>
                <label><input type="checkbox" checked> Reddit</label>
                <label><input type="checkbox"> TikTok</label>
                <label><input type="checkbox"> YouTube</label>
            </div>
        </div>`;
    });
    container.innerHTML = htmlStr;
}

window.removeKeyword = function(idx) {
    currentKeywords.splice(idx, 1);
    renderPlatformKeywords();
}

document.addEventListener('DOMContentLoaded', () => {
    loadBrandProfile();
});
`;

if (!html.includes('let currentKeywords = [];')) {
    html = html.replace('// Load Linked Accounts into the dropdown', jsContentHtml + '\n\n// Load Linked Accounts into the dropdown');
}

fs.writeFileSync('content-hub.html', html, 'utf8');
console.log('Successfully injected Brand & Keywords tab into Content Hub!');