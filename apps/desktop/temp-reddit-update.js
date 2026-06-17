const fs = require('fs');
let html = fs.readFileSync('dashboard.html', 'utf8');

// Insert the Reddit Prospector UI into the dashboard
const newPanel = `
  <!-- REDDIT PROSPECTOR & LEAD GEN PANEL -->
  <div id="reddit-prospector-panel" style="background: rgba(15, 23, 42, 0.6); border: 1px solid #f97316; border-radius: 12px; padding: 1.5rem; margin-bottom: 2rem;">
    <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid rgba(249, 115, 22, 0.2); padding-bottom: 1rem; margin-bottom: 1rem;">
      <div>
        <h3 style="color: #f97316; margin: 0; display: flex; align-items: center; gap: 8px;">
          <i class="fab fa-reddit-alien"></i>
          Reddit Prospector & Multi-Platform Lead Gen
        </h3>
        <p style="color: #94a3b8; font-size: 0.85rem; margin: 4px 0 0 0;">Scanning 45+ subreddits for users asking for your exact solutions.</p>
      </div>
      <div style="display:flex; gap: 10px;">
          <button id="scanRedditBtn" class="primary-btn" style="background: linear-gradient(135deg, #f97316, #ea580c); box-shadow: 0 4px 15px rgba(249, 115, 22, 0.3);" onclick="startRedditScan()">Scan Now</button>
      </div>
    </div>
    
    <div style="display: grid; grid-template-columns: 1fr 300px; gap: 1.5rem;">
        <div>
            <div id="reddit-leads-list" style="display: flex; flex-direction: column; gap: 1rem;">
              <!-- Leads populate here -->
              <div style="text-align: center; color: #64748b; padding: 2rem; border: 1px dashed #334155; border-radius: 8px;">Click "Scan Now" to find high-intent prospects across Reddit.</div>
            </div>
        </div>
        
        <div style="background: rgba(30, 41, 59, 0.5); border: 1px solid #334155; border-radius: 8px; padding: 1rem;">
            <h4 style="margin-top:0; color:#e2e8f0; font-size:0.9rem;">Lead Gen Settings</h4>
            
            <label style="display:block; font-size:0.8rem; color:#94a3b8; margin-top:1rem; margin-bottom:0.25rem;">Target Subreddits</label>
            <textarea style="width:100%; min-height:60px; background:#0f172a; border:1px solid #475569; border-radius:4px; color:#f8fafc; padding:0.5rem; font-size:0.8rem;">r/SaaS, r/Entrepreneur, r/marketing, r/startups</textarea>
            
            <label style="display:block; font-size:0.8rem; color:#94a3b8; margin-top:1rem; margin-bottom:0.25rem;">Solution Keywords (Intent)</label>
            <textarea style="width:100%; min-height:60px; background:#0f172a; border:1px solid #475569; border-radius:4px; color:#f8fafc; padding:0.5rem; font-size:0.8rem;">"how to automate", "tool for social media", "alternative to hootsuite"</textarea>
            
            <label style="display:block; font-size:0.8rem; color:#94a3b8; margin-top:1rem; margin-bottom:0.25rem;">Auto-Save Leads to Google Sheets</label>
            <select style="width:100%; background:#0f172a; border:1px solid #475569; border-radius:4px; color:#f8fafc; padding:0.5rem; font-size:0.8rem;">
                <option>Enabled (Leads Sheet)</option>
                <option>Disabled</option>
            </select>
        </div>
    </div>
  </div>
`;

// Insert after the Unanswered Questions panel
html = html.replace(/(<div id="unanswered-tracker"[\s\S]*?<\/div>\s*<\/div>)/, '$1\n\n' + newPanel);

const newScripts = `
let isScanningReddit = false;
window.startRedditScan = function() {
    if(isScanningReddit) return;
    isScanningReddit = true;
    
    const btn = document.getElementById('scanRedditBtn');
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Scanning 45+ Subs...';
    btn.style.opacity = '0.7';
    
    const list = document.getElementById('reddit-leads-list');
    list.innerHTML = '';
    
    // Simulate finding leads after a delay
    setTimeout(() => {
        const leads = [
            {
                sub: "r/SaaS",
                user: "u/growth_hacker99",
                time: "2 hours ago",
                title: "What are you using to manage presence across 5+ platforms without losing your mind?",
                content: "I'm currently juggling Twitter, LinkedIn, IG, TikTok, and Reddit. Every tool I try either misses a platform or feels clunky. What's the best stack for a solo founder?",
                intentScore: 98
            },
            {
                sub: "r/Entrepreneur",
                user: "u/startup_jane",
                time: "5 hours ago",
                title: "Need recommendations for AI content generation that doesn't sound like a robot.",
                content: "I want to automate my LinkedIn posting, but ChatGPT outputs always sound so stiff. Has anyone found a workflow that actually captures brand voice?",
                intentScore: 92
            }
        ];
        
        leads.forEach(lead => {
            list.innerHTML += \`
                <div style="background: rgba(30, 41, 59, 0.4); border: 1px solid #334155; border-radius: 8px; padding: 1rem;">
                    <div style="display:flex; justify-content:space-between; margin-bottom:0.5rem;">
                        <div>
                            <span style="color:#f97316; font-weight:bold; font-size:0.85rem; margin-right:10px;">\${lead.sub}</span>
                            <span style="color:#94a3b8; font-size:0.8rem;">\${lead.user} • \${lead.time}</span>
                        </div>
                        <span style="background: rgba(16, 185, 129, 0.2); color: #10b981; border: 1px solid #10b981; padding: 2px 8px; border-radius: 12px; font-size: 0.75rem; font-weight:bold;">\${lead.intentScore}% Intent Score</span>
                    </div>
                    <div style="color:#f8fafc; font-weight:600; font-size:1rem; margin-bottom:0.5rem;">\${lead.title}</div>
                    <div style="color:#cbd5e1; font-size:0.9rem; line-height:1.5; margin-bottom:1rem; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden;">"\${lead.content}"</div>
                    
                    <div style="display:flex; gap:10px;">
                        <button class="primary-btn" style="padding:0.4rem 1rem; font-size:0.8rem; background: linear-gradient(135deg, #f97316, #ea580c);" onclick="alert('Contextual AI Reply drafted. Moving lead to CRM Pipeline.')"><i class="fas fa-robot"></i> Contextual AI Reply</button>
                        <button class="secondary-btn" style="padding:0.4rem 1rem; font-size:0.8rem; background:transparent; color:#94a3b8; border:1px solid #475569;" onclick="alert('Lead saved to Google Sheets / CRM.')"><i class="fas fa-save"></i> Save Lead</button>
                    </div>
                </div>
            \`;
        });
        
        btn.innerHTML = 'Scan Now';
        btn.style.opacity = '1';
        isScanningReddit = false;
        
    }, 2000);
}
`;

html = html.replace(/window\.saveCurrentProfile = function/, newScripts + '\n\nwindow.saveCurrentProfile = function');

fs.writeFileSync('dashboard.html', html, 'utf8');
console.log('Dashboard updated with Reddit Prospector panel.');