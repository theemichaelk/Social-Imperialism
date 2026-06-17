const fs = require('fs');
const content = `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<title>Social Imperialism - Content Calendar</title>
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
<style>
body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #0f172a; color: #f8fafc; margin: 0; padding: 0; display: flex; height: 100vh; overflow: hidden; }

/* Sidebar */
.sidebar { width: 250px; background-color: #020617; color: white; padding: 2rem 1rem; display: flex; flex-direction: column; border-right: 1px solid #1e293b; overflow-y: auto; }
.sidebar-title-container { display: flex; align-items: center; gap: 0.75rem; margin-bottom: 2rem; justify-content: center; }
.sidebar-title { font-size: 1.5rem; font-weight: bold; color: #38bdf8; text-align: center; letter-spacing: 1px; text-transform: uppercase; margin: 0; }
.nav-link { color: #94a3b8; text-decoration: none; padding: 0.75rem 1rem; border-radius: 6px; margin-bottom: 0.5rem; display: block; transition: all 0.2s ease; display: flex; align-items: center; gap: 10px; }
.nav-link i { width: 20px; text-align: center; }
.nav-link:hover { background-color: #1e293b; color: white; }
.nav-link.active { background-color: #38bdf8; color: #020617; font-weight: 600; box-shadow: 0 0 10px rgba(56, 189, 248, 0.5); }

/* Main Content */
.main-content { flex: 1; display: flex; flex-direction: column; background: radial-gradient(circle at top right, #1e293b, #0f172a); overflow: hidden; }
.header { padding: 1.5rem 2rem; border-bottom: 1px solid #334155; display: flex; justify-content: space-between; align-items: center; background: rgba(15,23,42,0.8); backdrop-filter: blur(10px); }
h1 { margin: 0; color: #f1f5f9; font-size: 1.5rem; display: flex; align-items: center; gap: 10px; }
.primary-btn { background: linear-gradient(135deg, #0ea5e9, #2563eb); color: white; border: none; padding: 0.6rem 1.2rem; border-radius: 6px; font-weight: 600; cursor: pointer; display: flex; align-items: center; gap: 0.5rem; box-shadow: 0 4px 10px rgba(37,99,235,0.3); transition: all 0.2s; text-decoration: none; font-size: 0.9rem; }
.primary-btn:hover { transform: translateY(-2px); box-shadow: 0 6px 15px rgba(37,99,235,0.4); }

/* Month Controller */
.month-controls { display: flex; align-items: center; gap: 15px; }
.month-btn { background: transparent; border: 1px solid #475569; color: #cbd5e1; width: 36px; height: 36px; border-radius: 50%; display: flex; justify-content: center; align-items: center; cursor: pointer; transition: all 0.2s; }
.month-btn:hover { background: #334155; color: white; border-color: #94a3b8; }
.current-month { font-size: 1.2rem; font-weight: 600; color: #f8fafc; min-width: 150px; text-align: center; }

/* Calendar Grid */
.calendar-wrapper { flex: 1; padding: 1.5rem 2rem; overflow-y: auto; display: flex; flex-direction: column; }
.calendar-header { display: grid; grid-template-columns: repeat(7, 1fr); gap: 10px; margin-bottom: 10px; }
.day-header { text-align: center; font-weight: bold; color: #94a3b8; padding: 10px 0; text-transform: uppercase; font-size: 0.85rem; letter-spacing: 1px; }

.calendar-grid { display: grid; grid-template-columns: repeat(7, 1fr); gap: 10px; flex: 1; grid-auto-rows: minmax(130px, 1fr); }
.calendar-day { background: rgba(30, 41, 59, 0.6); border-radius: 8px; border: 1px solid #334155; padding: 10px; position: relative; display: flex; flex-direction: column; transition: border-color 0.2s; }
.calendar-day.drag-over { border-color: #38bdf8; background: rgba(56, 189, 248, 0.1); border-style: dashed; border-width: 2px; }
.calendar-day.today { border-color: #38bdf8; background: rgba(15, 23, 42, 0.8); }
.calendar-day.today .date-number { background: #38bdf8; color: #0f172a; border-radius: 50%; width: 24px; height: 24px; display: flex; align-items: center; justify-content: center; }
.calendar-day.empty { background: transparent; border: 1px dashed rgba(51, 65, 85, 0.3); pointer-events: none; }

.date-number { font-weight: 600; color: #94a3b8; margin-bottom: 10px; font-size: 0.9rem; align-self: flex-end; }
.post-container { flex: 1; overflow-y: auto; display: flex; flex-direction: column; gap: 6px; }

/* Scrollbar for post container */
.post-container::-webkit-scrollbar { width: 4px; }
.post-container::-webkit-scrollbar-track { background: transparent; }
.post-container::-webkit-scrollbar-thumb { background: #475569; border-radius: 4px; }

/* Draggable Post Items */
.post-item { background: #1e293b; border-left: 3px solid #64748b; padding: 8px; border-radius: 6px; font-size: 0.75rem; cursor: grab; color: #e2e8f0; display: flex; flex-direction: column; gap: 4px; box-shadow: 0 2px 4px rgba(0,0,0,0.2); transition: transform 0.2s, box-shadow 0.2s; border: 1px solid #334155; border-left-width: 3px; }
.post-item:hover { transform: translateY(-2px); box-shadow: 0 4px 8px rgba(0,0,0,0.3); background: #334155; }
.post-item:active { cursor: grabbing; }
.post-item.dragging { opacity: 0.5; }

.post-item.twitter { border-left-color: #1DA1F2; }
.post-item.linkedin { border-left-color: #0A66C2; }
.post-item.facebook { border-left-color: #1877F2; }
.post-item.instagram { border-left-color: #E1306C; }

.post-time { font-size: 0.7rem; color: #94a3b8; display: flex; align-items: center; justify-content: space-between; }
.post-time i { font-size: 0.85rem; }

.post-content-preview { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-weight: 500; }

/* Modal */
.modal-overlay { position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background: rgba(2,6,23,0.8); backdrop-filter: blur(5px); z-index: 100; display: none; justify-content: center; align-items: center; }
.modal-content { background: #0f172a; border: 1px solid #334155; padding: 25px; border-radius: 12px; width: 450px; box-shadow: 0 20px 40px rgba(0,0,0,0.5); }
.modal-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; padding-bottom: 15px; border-bottom: 1px solid #1e293b; }
.modal-title { font-size: 1.2rem; margin: 0; color: #f8fafc; display: flex; align-items: center; gap: 10px; }
.close-btn { background: none; border: none; color: #94a3b8; cursor: pointer; font-size: 1.2rem; }
.close-btn:hover { color: #ef4444; }

.post-details-box { background: #1e293b; padding: 15px; border-radius: 8px; margin-bottom: 20px; font-size: 0.9rem; line-height: 1.5; color: #cbd5e1; border: 1px solid #334155; }
.post-media-preview { width: 100%; height: 150px; object-fit: cover; border-radius: 6px; margin-top: 10px; display: none; border: 1px solid #475569; }

.modal-actions { display: flex; justify-content: space-between; gap: 10px; }
.btn-danger { background: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.3); color: #ef4444; padding: 8px 16px; border-radius: 6px; cursor: pointer; transition: all 0.2s; font-weight: 600; }
.btn-danger:hover { background: rgba(239, 68, 68, 0.2); }
</style>
</head>
<body>

<div class="sidebar">
  <div class="sidebar-title-container">
    <h2 class="sidebar-title">Social<br>Imperialism</h2>
  </div>
  <a href="dashboard.html" class="nav-link"><i class="fas fa-home"></i> Dashboard</a>
  <a href="history.html" class="nav-link"><i class="fas fa-history"></i> AI Replies</a>
  <a href="keywords.html" class="nav-link"><i class="fas fa-tags"></i> Keywords</a>
  <a href="automations.html" class="nav-link"><i class="fas fa-project-diagram"></i> Visual Builder</a>
  <a href="rules.html" class="nav-link"><i class="fas fa-cogs"></i> Auto-Rules</a>
  <a href="account-hub.html" class="nav-link"><i class="fas fa-link"></i> Linked Accounts</a>
  <a href="content-hub.html" class="nav-link"><i class="fas fa-edit"></i> Content Hub</a>
  <a href="calendar.html" class="nav-link active"><i class="fas fa-calendar-alt"></i> Content Calendar</a>
  <a href="settings.html" class="nav-link"><i class="fas fa-sliders-h"></i> Settings</a>
</div>

<div class="main-content">
  <div class="header">
    <h1><i class="fas fa-calendar-alt" style="color:#38bdf8;"></i> Content Calendar</h1>
    
    <div class="month-controls">
      <button class="month-btn" onclick="changeMonth(-1)"><i class="fas fa-chevron-left"></i></button>
      <div class="current-month" id="monthDisplay">Loading...</div>
      <button class="month-btn" onclick="changeMonth(1)"><i class="fas fa-chevron-right"></i></button>
    </div>
    
    <a href="content-hub.html" class="primary-btn"><i class="fas fa-plus"></i> Schedule Post</a>
  </div>
  
  <div class="calendar-wrapper">
    <div class="calendar-header">
      <div class="day-header">Sun</div>
      <div class="day-header">Mon</div>
      <div class="day-header">Tue</div>
      <div class="day-header">Wed</div>
      <div class="day-header">Thu</div>
      <div class="day-header">Fri</div>
      <div class="day-header">Sat</div>
    </div>
    <div class="calendar-grid" id="calendarDays">
      <!-- Generated by JS -->
    </div>
  </div>
</div>

<!-- View Post Modal -->
<div class="modal-overlay" id="postModal">
  <div class="modal-content">
    <div class="modal-header">
      <h3 class="modal-title" id="modalTitle"><i class="fab fa-twitter" style="color:#1DA1F2;"></i> Scheduled Post</h3>
      <button class="close-btn" onclick="closeModal()"><i class="fas fa-times"></i></button>
    </div>
    
    <div style="display:flex; justify-content:space-between; margin-bottom:10px; color:#94a3b8; font-size:0.85rem;">
      <span id="modalDate"><i class="fas fa-calendar-day"></i> Oct 24, 2026</span>
      <span id="modalTime"><i class="fas fa-clock"></i> 14:30</span>
    </div>
    
    <div class="post-details-box">
      <div id="modalContent">Content goes here...</div>
      <img id="modalMedia" class="post-media-preview" src="" alt="Media Preview">
    </div>
    
    <div class="modal-actions">
      <button class="btn-danger" id="deletePostBtn"><i class="fas fa-trash"></i> Delete Post</button>
      <div>
        <button class="primary-btn" style="background:transparent; border:1px solid #475569; color:#f8fafc;" onclick="closeModal()">Close</button>
      </div>
    </div>
  </div>
</div>

<script>
// Mock / LocalStorage state
let currentDate = new Date();
let scheduledPosts = [];
let draggingPostId = null;
let currentViewingPostId = null;

// Initialization
document.addEventListener('DOMContentLoaded', () => {
    loadPostsFromStorage();
    renderCalendar();
});

function loadPostsFromStorage() {
    try {
        const data = localStorage.getItem('scheduled_posts');
        if(data) {
            scheduledPosts = JSON.parse(data);
        } else {
            // Seed some mock data if empty just to show UI
            const today = new Date();
            const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);
            const nextWeek = new Date(today); nextWeek.setDate(nextWeek.getDate() + 5);
            
            scheduledPosts = [
                { id: 'mock1', platform: 'Twitter', content: 'Excited to announce our new AI integration! #Tech', timestamp: today.toISOString(), hasMedia: false },
                { id: 'mock2', platform: 'LinkedIn', content: 'How automation is changing B2B workflows. A thread.', timestamp: tomorrow.toISOString(), hasMedia: false },
                { id: 'mock3', platform: 'Instagram', content: 'Behind the scenes at HQ 🚀', timestamp: nextWeek.toISOString(), hasMedia: true, mediaUrl: 'https://images.pexels.com/photos/3183150/pexels-photo-3183150.jpeg' }
            ];
            localStorage.setItem('scheduled_posts', JSON.stringify(scheduledPosts));
        }
    } catch(e) {
        console.error("Failed to load posts", e);
        scheduledPosts = [];
    }
}

function savePostsToStorage() {
    localStorage.setItem('scheduled_posts', JSON.stringify(scheduledPosts));
}

function changeMonth(delta) {
    currentDate.setMonth(currentDate.getMonth() + delta);
    renderCalendar();
}

function renderCalendar() {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    
    // Update Header
    const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    document.getElementById('monthDisplay').innerText = \`\${monthNames[month]} \${year}\`;
    
    const container = document.getElementById('calendarDays');
    container.innerHTML = '';
    
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    
    const today = new Date();
    const isCurrentMonth = today.getFullYear() === year && today.getMonth() === month;
    
    // Empty cells before start of month
    for(let i=0; i<firstDay; i++) {
        const cell = document.createElement('div');
        cell.className = 'calendar-day empty';
        container.appendChild(cell);
    }
    
    // Days
    for(let i=1; i<=daysInMonth; i++) {
        const isToday = isCurrentMonth && i === today.getDate();
        
        const cell = document.createElement('div');
        cell.className = 'calendar-day' + (isToday ? ' today' : '');
        cell.dataset.date = \`\${year}-\${String(month+1).padStart(2,'0')}-\${String(i).padStart(2,'0')}\`;
        
        // Setup Drag & Drop Receivers
        cell.addEventListener('dragover', handleDragOver);
        cell.addEventListener('dragleave', handleDragLeave);
        cell.addEventListener('drop', handleDrop);
        
        cell.innerHTML = \`<span class="date-number">\${i}</span><div class="post-container" id="container-\${cell.dataset.date}"></div>\`;
        container.appendChild(cell);
    }
    
    renderPosts();
}

function getPlatformIcon(platform) {
    platform = platform.toLowerCase();
    if(platform.includes('twitter') || platform === 'x') return 'fab fa-twitter';
    if(platform.includes('linkedin')) return 'fab fa-linkedin';
    if(platform.includes('facebook')) return 'fab fa-facebook';
    if(platform.includes('instagram')) return 'fab fa-instagram';
    return 'fas fa-share-alt';
}

function getPlatformColor(platform) {
    platform = platform.toLowerCase();
    if(platform.includes('twitter') || platform === 'x') return '#1DA1F2';
    if(platform.includes('linkedin')) return '#0A66C2';
    if(platform.includes('facebook')) return '#1877F2';
    if(platform.includes('instagram')) return '#E1306C';
    return '#38bdf8';
}

function renderPosts() {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth() + 1; // 1-12
    
    scheduledPosts.forEach(post => {
        try {
            const dateObj = new Date(post.timestamp);
            const postYear = dateObj.getFullYear();
            const postMonth = dateObj.getMonth() + 1;
            
            // Only render if it belongs in the current visible month
            if(postYear === year && postMonth === month) {
                const dateString = \`\${postYear}-\${String(postMonth).padStart(2,'0')}-\${String(dateObj.getDate()).padStart(2,'0')}\`;
                const container = document.getElementById('container-' + dateString);
                
                if(container) {
                    const timeString = dateObj.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
                    const icon = getPlatformIcon(post.platform);
                    const classStr = post.platform ? post.platform.toLowerCase() : '';
                    
                    const el = document.createElement('div');
                    el.className = \`post-item \${classStr}\`;
                    el.draggable = true;
                    el.dataset.id = post.id;
                    
                    el.innerHTML = \`
                        <div class="post-time"><span style="color:\${getPlatformColor(post.platform)}"><i class="\${icon}"></i></span> \${timeString}</div>
                        <div class="post-content-preview">\${post.content || 'Media Post'}</div>
                    \`;
                    
                    // Drag events
                    el.addEventListener('dragstart', handleDragStart);
                    el.addEventListener('dragend', handleDragEnd);
                    
                    // Click to view
                    el.addEventListener('click', () => openPostModal(post.id));
                    
                    container.appendChild(el);
                }
            }
        } catch(e) { console.error("Error rendering post", post, e); }
    });
}

// --- Drag & Drop Logic ---
function handleDragStart(e) {
    draggingPostId = this.dataset.id;
    this.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', this.dataset.id); // Required for Firefox
}

function handleDragEnd(e) {
    this.classList.remove('dragging');
    draggingPostId = null;
    document.querySelectorAll('.calendar-day').forEach(d => d.classList.remove('drag-over'));
}

function handleDragOver(e) {
    e.preventDefault(); // Necessary to allow dropping
    if(draggingPostId) {
        this.classList.add('drag-over');
    }
    return false;
}

function handleDragLeave(e) {
    this.classList.remove('drag-over');
}

function handleDrop(e) {
    e.stopPropagation();
    this.classList.remove('drag-over');
    
    const targetDateStr = this.dataset.date;
    if(!targetDateStr || !draggingPostId) return false;
    
    // Find post and update its date while preserving time
    const postIndex = scheduledPosts.findIndex(p => p.id === draggingPostId);
    if(postIndex > -1) {
        const post = scheduledPosts[postIndex];
        const oldDate = new Date(post.timestamp);
        const [tYear, tMonth, tDate] = targetDateStr.split('-');
        
        // Apply new date, keep old time
        oldDate.setFullYear(parseInt(tYear));
        oldDate.setMonth(parseInt(tMonth) - 1);
        oldDate.setDate(parseInt(tDate));
        
        scheduledPosts[postIndex].timestamp = oldDate.toISOString();
        
        // Save & Re-render
        savePostsToStorage();
        renderCalendar(); // Re-render to move the element DOM-wise
    }
    
    return false;
}

// --- Modal Logic ---
function openPostModal(id) {
    const post = scheduledPosts.find(p => p.id === id);
    if(!post) return;
    
    currentViewingPostId = id;
    
    const dateObj = new Date(post.timestamp);
    const dateStr = dateObj.toLocaleDateString([], {weekday: 'short', month: 'short', day: 'numeric', year: 'numeric'});
    const timeStr = dateObj.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
    
    document.getElementById('modalTitle').innerHTML = \`<i class="\${getPlatformIcon(post.platform)}" style="color:\${getPlatformColor(post.platform)};"></i> Scheduled to \${post.platform}\`;
    document.getElementById('modalDate').innerHTML = \`<i class="fas fa-calendar-day"></i> \${dateStr}\`;
    document.getElementById('modalTime').innerHTML = \`<i class="fas fa-clock"></i> \${timeStr}\`;
    document.getElementById('modalContent').innerText = post.content || 'Media only post.';
    
    const mediaEl = document.getElementById('modalMedia');
    if(post.hasMedia && post.mediaUrl) {
        mediaEl.src = post.mediaUrl;
        mediaEl.style.display = 'block';
    } else {
        mediaEl.style.display = 'none';
        mediaEl.src = '';
    }
    
    document.getElementById('postModal').style.display = 'flex';
}

function closeModal() {
    document.getElementById('postModal').style.display = 'none';
    currentViewingPostId = null;
}

document.getElementById('deletePostBtn').addEventListener('click', () => {
    if(!currentViewingPostId) return;
    if(confirm("Are you sure you want to delete this scheduled post?")) {
        scheduledPosts = scheduledPosts.filter(p => p.id !== currentViewingPostId);
        savePostsToStorage();
        closeModal();
        renderCalendar();
    }
});

</script>
</body>
</html>`;

fs.writeFileSync('calendar.html', content);
console.log("Calendar UI rewritten with native HTML5 Drag and Drop logic.");