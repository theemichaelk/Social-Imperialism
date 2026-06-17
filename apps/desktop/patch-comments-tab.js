const fs = require('fs');
let html = fs.readFileSync('content-hub.html', 'utf8');

const oldCommentsTab = `    <!-- COMMENTS TAB (Placeholder) -->
    <div id="comments-tab" class="tab-content">
      <p style="color: #94a3b8;">Select a connected account to view unread comments and pending AI Drafts.</p>
      <div style="background: rgba(15,23,42,0.5); padding: 1.5rem; border-radius: 8px; border: 1px solid #334155; text-align: center;">
        <i class="fas fa-inbox fa-3x" style="color: #475569; margin-bottom: 1rem;"></i>
        <h4>Inbox Zero</h4>
        <p>No new comments found matching your auto-rules.</p>
      </div>
    </div>`;

const newCommentsTab = `    <!-- COMMENTS TAB -->
    <div id="comments-tab" class="tab-content">
      <div class="header" style="border:none; padding:0; margin-bottom:1rem;">
        <p style="color: #94a3b8;">Select an account to view AI Drafts and unread comments routed by your Auto-Rules.</p>
        <select class="input-field" id="commentsAccountSelect" style="width: 300px; margin:0;" onchange="loadCommentsForAccount(this.value)">
          <option value="">All Connected Accounts</option>
        </select>
      </div>
      
      <div id="commentsInboxContainer">
          <div style="background: rgba(15,23,42,0.5); padding: 1.5rem; border-radius: 8px; border: 1px solid #334155; text-align: center;" id="inboxZeroState">
            <i class="fas fa-inbox fa-3x" style="color: #475569; margin-bottom: 1rem;"></i>
            <h4>Inbox Zero</h4>
            <p>No new comments found matching your auto-rules.</p>
            <button class="secondary-btn" style="margin: 1rem auto 0 auto;" onclick="simulateNewComment()"><i class="fas fa-sync"></i> Force Check</button>
          </div>
      </div>
    </div>`;

if(html.includes('<!-- COMMENTS TAB (Placeholder) -->')) {
    html = html.replace(oldCommentsTab, newCommentsTab);
    
    const commentsLogic = `
// Manage Comments / Replies Tab Logic
function cloneAccountsToCommentsSelect() {
    const mainSelect = document.getElementById('accountSelect');
    const cmtSelect = document.getElementById('commentsAccountSelect');
    if(!cmtSelect) return;
    
    // Keep 'All' option
    const allOpt = cmtSelect.options[0];
    cmtSelect.innerHTML = '';
    cmtSelect.appendChild(allOpt);
    
    Array.from(mainSelect.options).forEach(opt => {
        if(opt.value) cmtSelect.appendChild(opt.cloneNode(true));
    });
}
const originalLoadAccounts2 = window.loadAccounts;
window.loadAccounts = async function() {
    if(originalLoadAccounts2) await originalLoadAccounts2();
    cloneAccountsToCommentsSelect();
}

window.simulateNewComment = function() {
    document.getElementById('inboxZeroState').style.display = 'none';
    const container = document.getElementById('commentsInboxContainer');
    
    const div = document.createElement('div');
    div.style.cssText = "background: rgba(15,23,42,0.6); border: 1px solid #334155; border-radius: 8px; padding: 1.5rem; margin-bottom: 1rem;";
    
    const brand = localStorage.getItem('ch_brandProfile') ? JSON.parse(localStorage.getItem('ch_brandProfile')).name : 'Our Brand';
    
    div.innerHTML = \`
        <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom: 1rem;">
            <div>
                <strong style="color: #f1f5f9;"><i class="fab fa-twitter" style="color:#38bdf8;"></i> @PotentialClient</strong>
                <span style="color: #64748b; font-size: 0.8rem; margin-left: 0.5rem;">2 mins ago</span>
            </div>
            <span style="background: rgba(56, 189, 248, 0.1); color: #38bdf8; padding: 0.2rem 0.5rem; border-radius: 4px; font-size: 0.75rem; border: 1px solid #38bdf8;">Keyword Hit: \${currentKeywords[0] || 'Automation'}</span>
        </div>
        <p style="color: #cbd5e1; margin-bottom: 1.5rem; font-size: 1.1rem;">"Does anyone know a good tool for managing social media marketing across multiple pages? Need something reliable."</p>
        
        <div style="background: rgba(2, 6, 23, 0.8); border: 1px solid #475569; border-left: 3px solid #10b981; padding: 1rem; border-radius: 4px;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.5rem;">
                <span style="color:#10b981; font-weight:bold; font-size:0.85rem;"><i class="fas fa-robot"></i> AI Drafted Reply (Auto-Rules)</span>
            </div>
            <textarea class="textarea-field" style="min-height: 80px; margin-bottom:0.5rem;" id="draftReply_1">Hey! \${brand} actually specializes in exactly this. We help you automate posting and replies across 10+ platforms reliably. Let me know if you want to chat!</textarea>
            <div style="display:flex; gap:0.5rem; align-items:center;">
                <button class="primary-btn" style="padding: 0.5rem 1rem; font-size: 0.85rem;" onclick="approveReply(this)"><i class="fas fa-check"></i> Approve &amp; Reply</button>
                <button class="secondary-btn" style="padding: 0.5rem 1rem; font-size: 0.85rem;" onclick="this.parentElement.parentElement.parentElement.remove()"><i class="fas fa-times"></i> Discard</button>
                <div style="margin-left: auto; display:flex; gap:0.5rem;">
                    <button class="tool-btn" title="Like"><i class="fas fa-heart"></i></button>
                    <button class="tool-btn" title="Retweet/Share"><i class="fas fa-retweet"></i></button>
                </div>
            </div>
        </div>
    \`;
    
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
`;
    html = html.replace('</script>', commentsLogic + '\n</script>');
    fs.writeFileSync('content-hub.html', html, 'utf8');
    console.log('Comments Tab successfully updated');
} else {
    console.log('Could not find placeholder comments tab');
}