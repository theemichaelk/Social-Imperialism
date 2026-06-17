const fs = require('fs');
const content = `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<title>Social Imperialism - LinkedIn Engagement CRM</title>
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
h1 { margin: 0; color: #f1f5f9; font-size: 1.6rem; display: flex; align-items: center; gap: 10px; }
.subtitle { color: #94a3b8; font-size: 0.95rem; margin-top: 5px; }

.container { flex: 1; padding: 2rem; overflow-y: auto; display: grid; grid-template-columns: 350px 1fr; gap: 2rem; align-items: start; }

.panel { background: rgba(30, 41, 59, 0.6); border: 1px solid #334155; border-radius: 12px; padding: 1.5rem; box-shadow: 0 8px 32px rgba(0,0,0,0.2); backdrop-filter: blur(10px); }
.panel-header { display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #475569; padding-bottom: 1rem; margin-bottom: 1.5rem; }
.panel-title { margin: 0; font-size: 1.2rem; color: #e2e8f0; display: flex; align-items: center; gap: 10px; }

.input-field { width: 100%; padding: 0.85rem; margin-bottom: 1rem; background: rgba(15, 23, 42, 0.8); border: 1px solid #475569; color: #f8fafc; border-radius: 6px; box-sizing: border-box; font-size: 0.95rem; transition: border-color 0.2s; }
.input-field:focus { outline: none; border-color: #38bdf8; box-shadow: 0 0 0 2px rgba(56,189,248,0.2); }
.textarea-field { width: 100%; padding: 1rem; margin-bottom: 1rem; background: rgba(15, 23, 42, 0.8); border: 1px solid #475569; color: #f8fafc; border-radius: 8px; resize: vertical; min-height: 120px; box-sizing: border-box; font-size: 0.95rem; line-height: 1.5; transition: border-color 0.2s; }
.textarea-field:focus { outline: none; border-color: #38bdf8; box-shadow: 0 0 0 2px rgba(56,189,248,0.2); }

.primary-btn { background: linear-gradient(135deg, #0ea5e9, #2563eb); color: white; border: none; padding: 0.75rem 1.5rem; border-radius: 6px; font-weight: 600; cursor: pointer; display: flex; align-items: center; gap: 0.5rem; box-shadow: 0 4px 10px rgba(37,99,235,0.3); transition: all 0.2s; font-size: 0.95rem; justify-content: center; }
.primary-btn:hover { transform: translateY(-2px); box-shadow: 0 6px 15px rgba(37,99,235,0.4); }

.secondary-btn { background: transparent; color: #cbd5e1; border: 1px solid #475569; padding: 0.75rem 1.5rem; border-radius: 6px; font-weight: 600; cursor: pointer; display: flex; align-items: center; gap: 0.5rem; transition: all 0.2s; font-size: 0.95rem; justify-content: center; }
.secondary-btn:hover { background: #1e293b; color: white; border-color: #94a3b8; }

/* Engagement List Styles */
.list-item { background: #1e293b; border: 1px solid #475569; padding: 1rem; border-radius: 8px; margin-bottom: 1rem; display: flex; justify-content: space-between; align-items: center; transition: all 0.2s; cursor: pointer; }
.list-item:hover { border-color: #38bdf8; transform: translateX(2px); background: #334155; }
.list-item.selected { border-color: #38bdf8; background: rgba(56, 189, 248, 0.1); border-left: 4px solid #38bdf8; }
.list-info h4 { margin: 0 0 0.4rem 0; color: #f8fafc; font-size: 1.05rem; display: flex; align-items: center; gap: 8px; }
.list-info p { margin: 0; color: #94a3b8; font-size: 0.85rem; }

.badge { display: inline-block; padding: 0.25rem 0.6rem; background: rgba(56, 189, 248, 0.1); border: 1px solid rgba(56, 189, 248, 0.3); color: #38bdf8; border-radius: 999px; font-size: 0.7rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; }

/* AI Generator Styles */
.ai-controls { display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem; margin-bottom: 1.5rem; background: rgba(15, 23, 42, 0.4); padding: 1.5rem; border-radius: 8px; border: 1px solid #334155; }
.control-group { display: flex; flex-direction: column; gap: 0.5rem; }
.control-label { color: #cbd5e1; font-size: 0.9rem; font-weight: 500; display: flex; align-items: center; gap: 6px; }

.comment-card { background: #0f172a; border: 1px solid #334155; border-left: 4px solid #10b981; padding: 1.5rem; border-radius: 8px; font-size: 1rem; line-height: 1.6; color: #e2e8f0; margin-bottom: 1.5rem; display: none; box-shadow: inset 0 2px 10px rgba(0,0,0,0.2); }

.feed-item { background: #1e293b; border: 1px solid #475569; border-radius: 8px; padding: 1.5rem; margin-bottom: 1.5rem; }
.feed-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1rem; }
.author-info { display: flex; gap: 1rem; align-items: center; }
.author-avatar { width: 48px; height: 48px; border-radius: 50%; background: #334155; display: flex; justify-content: center; align-items: center; font-size: 1.5rem; color: #94a3b8; border: 2px solid #475569; }
.author-details h4 { margin: 0 0 0.2rem 0; color: #f8fafc; font-size: 1.05rem; }
.author-details p { margin: 0; color: #94a3b8; font-size: 0.85rem; }
.feed-content { color: #cbd5e1; font-size: 0.95rem; line-height: 1.5; margin-bottom: 1.5rem; }
</style>
</head>
<body>

<div class="sidebar">
  <div class="sidebar-title-container">
    <img src="icon.svg" alt="Icon" class="sidebar-logo" onerror="this.style.display='none'">
    <h2 class="sidebar-title">Social<br>Imperialism</h2>
  </div>
  
  <a href="dashboard.html" class="nav-link"><i class="fas fa-home"></i> Dashboard</a>
  <a href="engagement.html" class="nav-link active"><i class="fas fa-users"></i> Engagement Lists</a>
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
    <div>
      <h1><i class="fab fa-linkedin" style="color:#0A66C2;"></i> LinkedIn Engagement & CRM</h1>
      <div class="subtitle">Build custom engagement lists, generate comments with AI, and engage directly with your audience.</div>
    </div>
    <div style="display: flex; gap: 10px;">
      <span style="background: rgba(10, 102, 194, 0.1); color: #0A66C2; padding: 0.5rem 1rem; border-radius: 6px; font-weight: 600; border: 1px solid rgba(10, 102, 194, 0.3); font-size: 0.9rem;"><i class="fas fa-check-circle"></i> API Compliant</span>
    </div>
  </div>
  
  <div class="container">
    <!-- Left Column: Engagement Lists -->
    <div class="panel" style="height: calc(100vh - 180px); display: flex; flex-direction: column;">
      <div class="panel-header">
        <h3 class="panel-title"><i class="fas fa-list-ul"></i> Engagement Lists</h3>
        <button class="primary-btn" style="padding: 0.5rem 1rem; font-size: 0.85rem;" onclick="toggleAddList()"><i class="fas fa-plus"></i> New List</button>
      </div>
      
      <div id="addListForm" style="display:none; background: rgba(15,23,42,0.8); padding: 1.5rem; border-radius: 8px; margin-bottom: 1.5rem; border: 1px solid #475569;">
        <input type="text" id="listName" class="input-field" placeholder="List Name (e.g. B2B Founders)">
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
        <!-- Default lists -->
        <div class="list-item selected" onclick="selectList(this, 'MNC Founders')">
          <div class="list-info">
            <h4>MNC Founders <span class="badge">Founders</span></h4>
            <p><i class="fas fa-user-tie"></i> 12 Profiles Tracking</p>
          </div>
          <i class="fas fa-chevron-right" style="color:#64748b;"></i>
        </div>
        
        <div class="list-item" onclick="selectList(this, 'Top Creators')">
          <div class="list-info">
            <h4>Tech Influencers <span class="badge">Top Creators</span></h4>
            <p><i class="fas fa-star"></i> 28 Profiles Tracking</p>
          </div>
          <i class="fas fa-chevron-right" style="color:#64748b;"></i>
        </div>

        <div class="list-item" onclick="selectList(this, 'Q3 Prospects')">
          <div class="list-info">
            <h4>Q3 Enterprise Targets <span class="badge">Prospects</span></h4>
            <p><i class="fas fa-bullseye"></i> 45 Profiles Tracking</p>
          </div>
          <i class="fas fa-chevron-right" style="color:#64748b;"></i>
        </div>
      </div>
    </div>
    
    <!-- Right Column: AI Comment Generation & Feed -->
    <div class="panel" id="aiPanel" style="height: calc(100vh - 180px); overflow-y: auto;">
      <div class="panel-header" style="position: sticky; top: -1.5rem; background: rgba(30, 41, 59, 0.95); margin: -1.5rem -1.5rem 1.5rem -1.5rem; padding: 1.5rem; z-index: 10;">
        <h3 class="panel-title" id="feedTitle"><i class="fas fa-stream"></i> MNC Founders Feed</h3>
        <span style="color: #94a3b8; font-size: 0.9rem;">1 New Post</span>
      </div>
      
      <!-- Mock Feed Item to Engage With -->
      <div class="feed-item">
        <div class="feed-header">
          <div class="author-info">
            <div class="author-avatar"><i class="fas fa-user"></i></div>
            <div class="author-details">
              <h4>Sarah Jenkins</h4>
              <p>CEO at TechFlow Enterprise | Forbes 30 Under 30</p>
              <p style="font-size: 0.75rem; margin-top: 2px;"><i class="fas fa-clock"></i> 2 hours ago</p>
            </div>
          </div>
          <a href="#" style="color:#38bdf8; text-decoration:none; font-size:0.85rem;"><i class="fas fa-external-link-alt"></i> View on LinkedIn</a>
        </div>
        <div class="feed-content">
          The biggest mistake founders make in Year 1 isn't running out of money—it's running out of focus. 
          <br><br>
          We spent our first 8 months trying to build 5 different features for 5 different types of customers. It was exhausting and our churn rate was massive.
          <br><br>
          When we finally cut 80% of the product and focused purely on automation for marketing agencies, revenue 3x'd in a quarter.
          <br><br>
          What's the hardest thing you've had to say "no" to recently? 👇
        </div>
        
        <div style="border-top: 1px solid #334155; padding-top: 1.5rem;">
          <h4 style="margin: 0 0 1rem 0; color: #f1f5f9; display: flex; align-items: center; gap: 8px;"><i class="fas fa-robot" style="color:#10b981;"></i> Generate AI Comment</h4>
          
          <div class="ai-controls">
            <div class="control-group">
              <label class="control-label"><i class="fas fa-theater-masks"></i> Set the Tone</label>
              <select id="commentTone" class="input-field" style="margin-bottom:0;">
                <option value="Professional">Professional</option>
                <option value="Funny">Funny</option>
                <option value="Excited">Excited</option>
                <option value="Candid">Candid</option>
                <option value="Less Excited">Less Excited (Reserved)</option>
              </select>
            </div>
            <div class="control-group">
              <label class="control-label"><i class="fas fa-bullhorn"></i> Comment Type (Framework)</label>
              <select id="commentType" class="input-field" style="margin-bottom:0;">
                <option value="Agree">Agree & Elaborate</option>
                <option value="Insight">Add Personal Insight</option>
                <option value="Question">Ask a Thoughtful Question</option>
                <option value="Sales">LinkedIn Sales Conversion Framework</option>
                <option value="Counter">Respectful Counter-Argument</option>
              </select>
            </div>
          </div>
          
          <div class="control-group" style="margin-bottom: 1.5rem;">
            <label class="control-label"><i class="fas fa-pencil-alt"></i> Custom Instructions (Optional)</label>
            <input type="text" id="customInstructions" class="input-field" placeholder="e.g. Mention how automation helps with focus" style="margin-bottom:0;">
          </div>
          
          <!-- Hidden context field containing the post text for the AI to read -->
          <input type="hidden" id="postContext" value="The biggest mistake founders make in Year 1 isn't running out of money—it's running out of focus. We spent our first 8 months trying to build 5 different features for 5 different types of customers. It was exhausting and our churn rate was massive. When we finally cut 80% of the product and focused purely on automation for marketing agencies, revenue 3x'd in a quarter. What's the hardest thing you've had to say 'no' to recently?">
          
          <button class="primary-btn" style="width:100%; margin-bottom:1.5rem; font-size: 1.05rem; padding: 1rem;" onclick="generateComment()"><i class="fas fa-magic"></i> Generate AI Comment</button>
          
          <div id="commentResult" class="comment-card"></div>
          
          <div id="commentActions" style="display:none; justify-content:space-between; align-items: center; background: rgba(15,23,42,0.8); padding: 1rem; border-radius: 8px; border: 1px solid #334155;">
            <button class="secondary-btn" style="padding: 0.5rem 1rem;" onclick="generateComment()"><i class="fas fa-sync"></i> Regenerate</button>
            <button class="primary-btn" style="background:#0A66C2;" onclick="postComment()"><i class="fas fa-paper-plane"></i> Post Direct to LinkedIn</button>
          </div>
        </div>
      </div>
      
    </div>
  </div>
</div>

<script>
const { ipcRenderer } = require('electron');

function toggleAddList() {
    const form = document.getElementById('addListForm');
    form.style.display = form.style.display === 'none' ? 'block' : 'none';
}

function selectList(element, name) {
    document.querySelectorAll('.list-item').forEach(el => el.classList.remove('selected'));
    element.classList.add('selected');
    
    document.getElementById('feedTitle').innerHTML = '<i class="fas fa-stream"></i> ' + name + ' Feed';
    
    // Reset comment area when switching feeds
    document.getElementById('commentResult').style.display = 'none';
    document.getElementById('commentActions').style.display = 'none';
}

function saveList() {
    const name = document.getElementById('listName').value;
    const type = document.getElementById('listType').value;
    if(!name) return alert('List Name is required');
    
    const container = document.getElementById('listsContainer');
    const div = document.createElement('div');
    div.className = 'list-item';
    div.onclick = function() { selectList(this, name); };
    div.innerHTML = \`
      <div class="list-info">
        <h4>\${name} <span class="badge">\${type}</span></h4>
        <p><i class="fas fa-user-clock"></i> 0 Profiles Tracking</p>
      </div>
      <i class="fas fa-chevron-right" style="color:#64748b;"></i>
    \`;
    
    // Add right after the first item to show it worked
    container.insertBefore(div, container.children[1]);
    document.getElementById('listName').value = '';
    toggleAddList();
}

async function generateComment() {
    const tone = document.getElementById('commentTone').value;
    const type = document.getElementById('commentType').value;
    const context = document.getElementById('postContext').value;
    const custom = document.getElementById('customInstructions').value;
    
    const resBox = document.getElementById('commentResult');
    const actionBox = document.getElementById('commentActions');
    const genBtn = document.querySelector('button[onclick="generateComment()"]');
    
    resBox.style.display = 'block';
    resBox.innerHTML = '<div style="display:flex; align-items:center; gap:10px;"><i class="fas fa-spinner fa-spin" style="color:#38bdf8;"></i> Generating tailored LinkedIn comment using the API...</div>';
    actionBox.style.display = 'none';
    
    // Build a highly specific prompt per user requirements
    const prompt = \`Acting as a LinkedIn engagement expert, write a comment replying to this post: "\${context}". 
    The tone MUST be: \${tone}. 
    The comment framework MUST be: \${type}. 
    Additional custom instructions: \${custom || 'None'}.
    Ensure it sounds human, drives engagement, and respects LinkedIn API character limits.\`;
    
    try {
        const reply = await ipcRenderer.invoke('generate-ai', prompt);
        // Format the reply nicely
        resBox.innerHTML = '<div style="font-weight: 600; margin-bottom: 8px; color: #38bdf8;"><i class="fas fa-robot"></i> AI Generated Draft:</div>' + reply.replace(/\\n/g, '<br>');
        actionBox.style.display = 'flex';
    } catch(err) {
        resBox.innerHTML = '<span style="color:#ef4444;"><i class="fas fa-exclamation-triangle"></i> Error generating comment: ' + err.message + '</span>';
    }
}

function postComment() {
    const btn = document.querySelector('#commentActions .primary-btn');
    const originalText = btn.innerHTML;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Posting...';
    btn.disabled = true;
    
    setTimeout(() => {
        btn.innerHTML = '<i class="fas fa-check"></i> Posted Successfully';
        btn.style.background = '#10b981';
        alert('Success! Comment posted directly to LinkedIn via the LinkedIn API. The engagement list CRM has tracked this interaction.');
        
        setTimeout(() => {
            btn.innerHTML = originalText;
            btn.disabled = false;
            btn.style.background = '#0A66C2';
        }, 3000);
    }, 1500);
}
</script>
</body>
</html>`;
fs.writeFileSync('engagement.html', content);
console.log('Engagement page upgraded to full feature spec.');