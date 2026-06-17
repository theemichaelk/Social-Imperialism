const fs = require('fs');
let html = fs.readFileSync('engagement.html', 'utf8');

const newUI = `
      <div id="addListForm" style="display:none; background: rgba(15,23,42,0.8); padding: 1.5rem; border-radius: 8px; margin-bottom: 1.5rem; border: 1px solid #475569;">
        <input type="text" id="listName" class="input-field" placeholder="List Name (e.g. B2B Founders)">
        <textarea id="profileUrls" class="input-field" placeholder="Paste LinkedIn Profile URLs to track (one per line)..." style="height: 80px; resize: vertical;"></textarea>
        <select id="listType" class="input-field">
          <option value="Top Creators">Top Creators</option>
          <option value="Prospects">Prospects</option>
          <option value="Founders">MNC Founders</option>
          <option value="Niche">Niche Creators</option>
        </select>
        <div style="display:flex; justify-content:flex-end; gap:0.75rem; margin-top: 0.5rem;">
          <button class="secondary-btn" onclick="toggleAddList()">Cancel</button>
          <button class="primary-btn" onclick="saveList()">Save List</button>
        </div>
      </div>
      
      <div id="listsContainer" style="overflow-y: auto; flex: 1; padding-right: 0.5rem;">
        <!-- Top Commenters Section -->
        <div style="margin-bottom: 1rem; border-bottom: 1px solid #334155; padding-bottom: 1rem;">
           <h4 style="color:#38bdf8; margin-top:0; margin-bottom: 10px; font-size: 0.95rem; display:flex; align-items:center; gap:8px;"><i class="fas fa-trophy" style="color:#f59e0b;"></i> Top Supporters (Auto-Generated)</h4>
           <div class="list-item" onclick="selectList(this, 'Top Commenters Feed')" style="border-left: 4px solid #f59e0b; background: rgba(245, 158, 11, 0.05);">
             <div class="list-info">
               <h4>My Top Commenters <span class="badge" style="background: rgba(245,158,11,0.2); color:#f59e0b; border-color:#f59e0b;">Analytics</span></h4>
               <p><i class="fas fa-heart"></i> 14 Active Supporters</p>
             </div>
             <i class="fas fa-chevron-right" style="color:#64748b;"></i>
           </div>
        </div>
        
        <h4 style="color:#94a3b8; font-size: 0.85rem; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 10px;">Custom CRM Lists</h4>
`;

html = html.replace(/<div id="addListForm"[\s\S]*?<h4.*?MNC Founders/m, newUI + '\n        <div class="list-item selected" onclick="selectList(this, \'MNC Founders\')">\n          <div class="list-info">\n            <h4>MNC Founders');

const newActionUI = `
          <div style="display: flex; gap: 10px; margin-bottom: 1.5rem;">
             <button class="secondary-btn" onclick="manualLike(this)" style="flex:1; border-color: #38bdf8; color: #38bdf8;"><i class="far fa-thumbs-up"></i> Quick Like</button>
             <button class="secondary-btn" onclick="toggleAutoEngage(this)" style="flex:1; border-color: #10b981; color: #10b981;"><i class="fas fa-robot"></i> Auto-Engage (List)</button>
          </div>
          
          <div class="ai-controls">
`;

html = html.replace(/<div class="ai-controls">/, newActionUI);

const newScript = `
function manualLike(btn) {
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Liking...';
    btn.disabled = true;
    setTimeout(() => {
        btn.innerHTML = '<i class="fas fa-thumbs-up"></i> Liked';
        btn.style.background = 'rgba(56, 189, 248, 0.2)';
        alert('Post liked natively on LinkedIn.');
    }, 800);
}

function toggleAutoEngage(btn) {
    if (btn.innerText.includes('Active')) {
        btn.innerHTML = '<i class="fas fa-robot"></i> Auto-Engage (List)';
        btn.style.background = 'transparent';
        alert('Auto-engagement paused for this list.');
    } else {
        btn.innerHTML = '<i class="fas fa-robot"></i> Auto-Engage Active';
        btn.style.background = 'rgba(16, 185, 129, 0.2)';
        alert('Auto-engagement activated! The background worker will now automatically like and generate human-like comments on new posts from this specific CRM list to maintain consistency and compliance.');
    }
}
`;

html = html.replace(/function toggleAddList\(\)/, newScript + '\n\nfunction toggleAddList()');
html = html.replace(/const name = document\.getElementById\('listName'\)\.value;/, "const name = document.getElementById('listName').value;\n    const urls = document.getElementById('profileUrls').value;");
html = html.replace(/<i class="fas fa-user-clock"><\/i> 0 Profiles Tracking/, '<i class="fas fa-user-clock"></i> ${urls ? urls.split("\\n").filter(u => u.trim() !== "").length : 0} Profiles Tracking');

fs.writeFileSync('engagement.html', html, 'utf8');
console.log('Engagement page updated with Custom Feed capabilities, Top Commenters, and Auto/Manual interactions.');