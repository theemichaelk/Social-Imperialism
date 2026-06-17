const fs = require('fs');
const content = `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<title>Social Imperialism - Engagement Lists & AI Comments</title>
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
<style>
body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; background-color: #0f172a; color: #f8fafc; margin: 0; padding: 0; display: flex; height: 100vh; overflow: hidden; }

/* Sidebar */
.sidebar { width: 250px; background-color: #020617; color: white; padding: 2rem 1rem; display: flex; flex-direction: column; border-right: 1px solid #1e293b; overflow-y: auto; z-index: 100; }
.sidebar-title-container { display: flex; align-items: center; gap: 0.75rem; margin-bottom: 1.5rem; justify-content: center; }
.sidebar-logo { height: 48px; width: 48px; object-fit: contain; }
.sidebar-title { font-size: 1.5rem; font-weight: bold; color: #38bdf8; text-align: left; letter-spacing: 1px; text-transform: uppercase; margin: 0; line-height: 1.2; }
.nav-link { color: #94a3b8; text-decoration: none; padding: 0.75rem 1rem; border-radius: 6px; margin-bottom: 0.5rem; display: flex; align-items: center; gap: 10px; transition: all 0.2s ease; font-size: 0.95rem; }
.nav-link i { width: 20px; text-align: center; font-size: 1.1rem; }
.nav-link:hover { background-color: #1e293b; color: white; transform: translateX(2px); }
.nav-link.active { background-color: #38bdf8; color: #020617; font-weight: 600; box-shadow: 0 0 10px rgba(56, 189, 248, 0.5); transform: translateX(2px); }

/* Main Content */
.main-content { flex: 1; display: flex; flex-direction: column; background: radial-gradient(circle at top right, #1e293b, #0f172a); overflow: hidden; }
.header { padding: 1.5rem 2rem; border-bottom: 1px solid #334155; display: flex; justify-content: space-between; align-items: center; background: rgba(15,23,42,0.8); backdrop-filter: blur(10px); }
h1 { margin: 0; color: #f1f5f9; font-size: 1.5rem; display: flex; align-items: center; gap: 10px; }

.container { flex: 1; padding: 2rem; overflow-y: auto; display: grid; grid-template-columns: 1fr 1fr; gap: 2rem; align-items: start; }

.panel { background: rgba(30, 41, 59, 0.6); border: 1px solid #334155; border-radius: 12px; padding: 1.5rem; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); }
.panel-header { display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #475569; padding-bottom: 1rem; margin-bottom: 1.5rem; }
.panel-title { margin: 0; font-size: 1.2rem; color: #e2e8f0; display: flex; align-items: center; gap: 10px; }

.input-field { width: 100%; padding: 0.75rem; margin-bottom: 1rem; background: rgba(15, 23, 42, 0.8); border: 1px solid #475569; color: #f8fafc; border-radius: 6px; box-sizing: border-box; }
.textarea-field { width: 100%; padding: 1rem; margin-bottom: 1rem; background: rgba(15, 23, 42, 0.8); border: 1px solid #475569; color: #f8fafc; border-radius: 8px; resize: vertical; min-height: 100px; box-sizing: border-box; }

.primary-btn { background: linear-gradient(135deg, #0ea5e9, #2563eb); color: white; border: none; padding: 0.6rem 1.2rem; border-radius: 6px; font-weight: 600; cursor: pointer; display: flex; align-items: center; gap: 0.5rem; box-shadow: 0 4px 10px rgba(37,99,235,0.3); transition: all 0.2s; }
.primary-btn:hover { transform: translateY(-2px); box-shadow: 0 6px 15px rgba(37,99,235,0.4); }

.list-item { background: #1e293b; border: 1px solid #475569; padding: 1rem; border-radius: 8px; margin-bottom: 1rem; display: flex; justify-content: space-between; align-items: center; transition: border-color 0.2s; cursor: pointer; }
.list-item:hover { border-color: #38bdf8; }
.list-info h4 { margin: 0 0 0.25rem 0; color: #f8fafc; }
.list-info p { margin: 0; color: #94a3b8; font-size: 0.85rem; }

.badge { display: inline-block; padding: 0.25rem 0.5rem; background: rgba(56, 189, 248, 0.1); border: 1px solid #38bdf8; color: #38bdf8; border-radius: 999px; font-size: 0.7rem; font-weight: 600; margin-left: 10px; text-transform: uppercase; }

.ai-controls { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1rem; }

.comment-card { background: #0f172a; border-left: 3px solid #10b981; padding: 1rem; border-radius: 6px; font-size: 0.95rem; line-height: 1.5; color: #cbd5e1; margin-bottom: 1rem; display: none; }
</style>
</head>
<body>

<div class="sidebar">
  <div class="sidebar-title-container">
    <img src="icon.svg" alt="Icon" class="sidebar-logo" onerror="this.style.display='none'">
    <h2 class="sidebar-title">Social<br>Imperialism</h2>
  </div>
  
  <a href="dashboard.html" class="nav-link"><i class="fas fa-home"></i> Dashboard</a>
  <a href="engagement.html" class="nav-link active"><i class="fas fa-users"></i> Engagement</a>
  <a href="history.html" class="nav-link"><i class="fas fa-history"></i> AI Replies</a>
  <a href="keywords.html" class="nav-link"><i class="fas fa-tags"></i> Keywords</a>
  <a href="automations.html" class="nav-link"><i class="fas fa-project-diagram"></i> Visual Builder</a>
  <a href="rules.html" class="nav-link"><i class="fas fa-cogs"></i> Auto-Rules</a>
  <a href="account-hub.html" class="nav-link"><i class="fas fa-link"></i> Linked Accounts</a>
  <a href="content-hub.html" class="nav-link"><i class="fas fa-edit"></i> Content Hub</a>
  <a href="calendar.html" class="nav-link"><i class="fas fa-calendar-alt"></i> Content Calendar</a>
  <a href="settings.html" class="nav-link"><i class="fas fa-sliders-h"></i> Settings</a>
</div>

<div class="main-content">
  <div class="header">
    <h1><i class="fab fa-linkedin" style="color:#0A66C2;"></i> LinkedIn Engagement & CRM</h1>
  </div>
  
  <div class="container">
    <!-- Left Column: Engagement Lists -->
    <div class="panel">
      <div class="panel-header">
        <h3 class="panel-title"><i class="fas fa-list-ul"></i> Engagement Lists</h3>
        <button class="primary-btn" onclick="document.getElementById('addListForm').style.display='block'"><i class="fas fa-plus"></i> New List</button>
      </div>
      
      <div id="addListForm" style="display:none; background: rgba(15,23,42,0.5); padding: 1rem; border-radius: 8px; margin-bottom: 1.5rem; border: 1px solid #475569;">
        <input type="text" id="listName" class="input-field" placeholder="List Name (e.g. MNC Founders)">
        <select id="listType" class="input-field">
          <option value="Top Creators">Top Creators</option>
          <option value="Prospects">Prospects</option>
          <option value="Founders">MNC Founders</option>
          <option value="Niche">Niche Creators</option>
        </select>
        <div style="display:flex; justify-content:flex-end; gap:0.5rem;">
          <button class="primary-btn" style="background:transparent; border:1px solid #475569;" onclick="document.getElementById('addListForm').style.display='none'">Cancel</button>
          <button class="primary-btn" onclick="saveList()">Save</button>
        </div>
      </div>
      
      <div id="listsContainer">
        <!-- Default mock list -->
        <div class="list-item" onclick="selectList('MNC Founders')">
          <div class="list-info">
            <h4>MNC Founders <span class="badge">Founders</span></h4>
            <p>12 tracking • 5 new posts today</p>
          </div>
          <i class="fas fa-chevron-right" style="color:#64748b;"></i>
        </div>
        
        <div class="list-item" onclick="selectList('AI Tech Creators')">
          <div class="list-info">
            <h4>AI Tech Creators <span class="badge">Top Creators</span></h4>
            <p>28 tracking • 14 new posts today</p>
          </div>
          <i class="fas fa-chevron-right" style="color:#64748b;"></i>
        </div>
      </div>
    </div>
    
    <!-- Right Column: AI Comment Generation -->
    <div class="panel" id="aiPanel" style="opacity: 0.5; pointer-events: none;">
      <div class="panel-header">
        <h3 class="panel-title"><i class="fas fa-robot" style="color:#10b981;"></i> AI Comment Generator</h3>
      </div>
      
      <p style="color:#94a3b8; font-size:0.9rem; margin-top:0;">Generate thoughtful, context-aware comments instantly without switching tabs.</p>
      
      <div class="ai-controls">
        <div>
          <label style="color:#cbd5e1; font-size:0.85rem; margin-bottom:0.5rem; display:block;">Select Tone</label>
          <select id="commentTone" class="input-field">
            <option value="Professional">Professional</option>
            <option value="Funny">Funny</option>
            <option value="Excited">Excited</option>
            <option value="Candid">Candid</option>
            <option value="Less Excited">Less Excited</option>
          </select>
        </div>
        <div>
          <label style="color:#cbd5e1; font-size:0.85rem; margin-bottom:0.5rem; display:block;">Comment Type</label>
          <select id="commentType" class="input-field">
            <option value="Agree">Agree & Elaborate</option>
            <option value="Question">Ask a Question</option>
            <option value="Insight">Add Personal Insight</option>
            <option value="Sales">Sales Conversion Framework</option>
          </select>
        </div>
      </div>
      
      <label style="color:#cbd5e1; font-size:0.85rem; margin-bottom:0.5rem; display:block;">Target Post Content / Context</label>
      <textarea id="postContext" class="textarea-field" placeholder="Paste the post you want to reply to, or write context here..."></textarea>
      
      <label style="color:#cbd5e1; font-size:0.85rem; margin-bottom:0.5rem; display:block;">Custom Instructions (Optional)</label>
      <input type="text" id="customInstructions" class="input-field" placeholder="e.g. Mention our new automation tool">
      
      <button class="primary-btn" style="width:100%; justify-content:center; margin-bottom:1.5rem;" onclick="generateComment()"><i class="fas fa-magic"></i> Generate Comment</button>
      
      <div id="commentResult" class="comment-card">
        <!-- Result goes here -->
      </div>
      
      <div id="commentActions" style="display:none; justify-content:space-between;">
        <button class="primary-btn" style="background:transparent; border:1px solid #475569; color:#cbd5e1;" onclick="generateComment()"><i class="fas fa-sync"></i> Regenerate</button>
        <button class="primary-btn" style="background:#0A66C2;" onclick="alert('Comment Posted directly to LinkedIn via API!')"><i class="fas fa-paper-plane"></i> Post Reply</button>
      </div>
      
    </div>
  </div>
</div>

<script>
const { ipcRenderer } = require('electron');

function selectList(name) {
    document.querySelectorAll('.list-item').forEach(el => el.style.borderColor = '#475569');
    event.currentTarget.style.borderColor = '#38bdf8';
    
    const panel = document.getElementById('aiPanel');
    panel.style.opacity = '1';
    panel.style.pointerEvents = 'all';
}

function saveList() {
    const name = document.getElementById('listName').value;
    const type = document.getElementById('listType').value;
    if(!name) return alert('Name required');
    
    const container = document.getElementById('listsContainer');
    const div = document.createElement('div');
    div.className = 'list-item';
    div.onclick = function() { selectList(name); };
    div.innerHTML = \`
      <div class="list-info">
        <h4>\${name} <span class="badge">\${type}</span></h4>
        <p>0 tracking • 0 new posts today</p>
      </div>
      <i class="fas fa-chevron-right" style="color:#64748b;"></i>
    \`;
    
    container.insertBefore(div, container.firstChild);
    document.getElementById('listName').value = '';
    document.getElementById('addListForm').style.display = 'none';
}

async function generateComment() {
    const tone = document.getElementById('commentTone').value;
    const type = document.getElementById('commentType').value;
    const context = document.getElementById('postContext').value;
    const custom = document.getElementById('customInstructions').value;
    
    if(!context) return alert('Please provide the post content or context first.');
    
    const resBox = document.getElementById('commentResult');
    const actionBox = document.getElementById('commentActions');
    
    resBox.style.display = 'block';
    resBox.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Generating tailored LinkedIn comment...';
    actionBox.style.display = 'none';
    
    const prompt = \`Write a \${tone} LinkedIn comment. Type of response: \${type}. Post context: "\${context}". Additional instructions: \${custom}. Make it sound natural, not robotic.\`;
    
    try {
        const reply = await ipcRenderer.invoke('generate-ai', prompt);
        resBox.innerHTML = reply;
        actionBox.style.display = 'flex';
    } catch(err) {
        resBox.innerHTML = '<span style="color:#ef4444;">Error generating comment: ' + err.message + '</span>';
    }
}
</script>
</body>
</html>`;
fs.writeFileSync('engagement.html', content);
console.log('Engagement page created.');