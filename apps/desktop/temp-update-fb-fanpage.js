const fs = require('fs');
let html = fs.readFileSync('rules.html', 'utf8');

const fbFanpageHtml = `
    <!-- NEW FACEBOOK FANPAGE AUTOMATION SECTION -->
    <div style="margin-bottom: 1.5rem; background: rgba(59, 130, 246, 0.05); border: 1px solid #3b82f6; border-radius: 8px; padding: 1.5rem;">
      <h3 style="color: #60a5fa; margin-top: 0; display: flex; align-items: center; gap: 0.5rem;">
        <i class="fab fa-facebook"></i> Facebook Fanpage Automation & Fan Growth
      </h3>
      <p style="color: #94a3b8; font-size: 0.9rem; margin-bottom: 1rem;">Automatically post curated content (from RSS/library) to unlimited fanpages, and proactively engage in relevant groups to acquire highly targeted "REAL" fans.</p>
      
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
          <div style="background: rgba(15,23,42,0.5); padding: 1rem; border-radius: 6px; border: 1px solid #475569;">
            <label style="display: flex; align-items: flex-start; gap: 0.5rem; cursor: pointer; color: #cbd5e1;">
              <input type="checkbox" id="fbAutoPost" checked style="margin-top: 3px;">
              <div>
                  <strong style="color: #f8fafc;">Auto-Post Curated Content</strong>
                  <div style="font-size: 0.8rem; color: #94a3b8; margin-top: 0.25rem;">Automatically draft and publish content from RSS feeds and your content library across linked Fanpages.</div>
              </div>
            </label>
          </div>
          
          <div style="background: rgba(15,23,42,0.5); padding: 1rem; border-radius: 6px; border: 1px solid #475569;">
            <label style="display: flex; align-items: flex-start; gap: 0.5rem; cursor: pointer; color: #cbd5e1;">
              <input type="checkbox" id="fbTargetedFan" checked style="margin-top: 3px;">
              <div>
                  <strong style="color: #f8fafc;">Targeted Fan Acquisition</strong>
                  <div style="font-size: 0.8rem; color: #94a3b8; margin-top: 0.25rem;">Find relevant users/posts in niche groups. Auto-engage (like/comment) to draw them back to your fanpage and convert to followers.</div>
              </div>
            </label>
          </div>
          
          <div style="background: rgba(15,23,42,0.5); padding: 1rem; border-radius: 6px; border: 1px solid #475569; grid-column: span 2;">
            <label style="display: flex; align-items: flex-start; gap: 0.5rem; cursor: pointer; color: #cbd5e1;">
              <input type="checkbox" id="fbHandsFree" checked style="margin-top: 3px; accent-color: #3b82f6;">
              <div>
                  <strong style="color: #60a5fa;">Hands-Free Mode Enabled</strong>
                  <div style="font-size: 0.8rem; color: #94a3b8; margin-top: 0.25rem;">The AI will continuously balance posting content and outbound engagement (comments/likes) while tracking page growth metrics in analytics without human intervention.</div>
              </div>
            </label>
          </div>
      </div>
    </div>
`;

// Insert the FB Fanpage section before the Custom AI Prompt Override
html = html.replace(/(<div style="margin-bottom: 1.5rem;">\s*<label style="color: #38bdf8; font-weight: bold; margin-bottom: 0.5rem; display: block;">Custom AI Prompt Override \(Optional\)<\/label>)/, fbFanpageHtml + '\n    $1');

// Update JS save function
const jsSaveReplace = `modCommunity: document.getElementById('modCommunity').checked,
        industryRouting: document.getElementById('industryRouting').value,
        fbAutoPost: document.getElementById('fbAutoPost').checked,
        fbTargetedFan: document.getElementById('fbTargetedFan').checked,
        fbHandsFree: document.getElementById('fbHandsFree').checked`;

html = html.replace(/modCommunity: document\.getElementById\('modCommunity'\)\.checked,\s*industryRouting: document\.getElementById\('industryRouting'\)\.value/, jsSaveReplace);

// Update JS load function
const jsLoadReplace = `document.getElementById('modCommunity').checked = typeof settings.modCommunity !== 'undefined' ? settings.modCommunity : true;
                if(settings.industryRouting) document.getElementById('industryRouting').value = settings.industryRouting;
                
                if(document.getElementById('fbAutoPost')) {
                    document.getElementById('fbAutoPost').checked = typeof settings.fbAutoPost !== 'undefined' ? settings.fbAutoPost : true;
                    document.getElementById('fbTargetedFan').checked = typeof settings.fbTargetedFan !== 'undefined' ? settings.fbTargetedFan : true;
                    document.getElementById('fbHandsFree').checked = typeof settings.fbHandsFree !== 'undefined' ? settings.fbHandsFree : true;
                }`;

html = html.replace(/document\.getElementById\('modCommunity'\)\.checked = typeof settings\.modCommunity !== 'undefined' \? settings\.modCommunity : true;\s*if\(settings\.industryRouting\) document\.getElementById\('industryRouting'\)\.value = settings\.industryRouting;/, jsLoadReplace);

fs.writeFileSync('rules.html', html, 'utf8');
console.log('Added Facebook Fanpage Automation to Rules.');