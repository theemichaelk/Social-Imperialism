const fs = require('fs');
let html = fs.readFileSync('rules.html', 'utf8');

const newModerationSection = `
    <!-- NEW MODERATION & CRISIS MANAGEMENT SECTION -->
    <div style="margin-bottom: 1.5rem; background: rgba(220, 38, 38, 0.05); border: 1px solid #ef4444; border-radius: 8px; padding: 1.5rem;">
      <h3 style="color: #ef4444; margin-top: 0; display: flex; align-items: center; gap: 0.5rem;">
        <i class="fas fa-shield-alt"></i> Moderation, Spam & Crisis Management
      </h3>
      <p style="color: #94a3b8; font-size: 0.9rem; margin-bottom: 1rem;">Proactively filter bots, spam, toxic content, and escalate crisis events before they spread.</p>
      
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
          <div style="background: rgba(15,23,42,0.5); padding: 1rem; border-radius: 6px; border: 1px solid #475569;">
            <label style="display: flex; align-items: flex-start; gap: 0.5rem; cursor: pointer; color: #cbd5e1;">
              <input type="checkbox" id="modSpamBot" checked style="margin-top: 3px;">
              <div>
                  <strong style="color: #f8fafc;">Spam & Bot Filtering</strong>
                  <div style="font-size: 0.8rem; color: #94a3b8; margin-top: 0.25rem;">Proactively hide/remove known bot replies, scam links, and spam comments in real-time.</div>
              </div>
            </label>
          </div>
          
          <div style="background: rgba(15,23,42,0.5); padding: 1rem; border-radius: 6px; border: 1px solid #475569;">
            <label style="display: flex; align-items: flex-start; gap: 0.5rem; cursor: pointer; color: #cbd5e1;">
              <input type="checkbox" id="modOffensive" checked style="margin-top: 3px;">
              <div>
                  <strong style="color: #f8fafc;">Offensive Content Removal</strong>
                  <div style="font-size: 0.8rem; color: #94a3b8; margin-top: 0.25rem;">AI auto-flags and removes toxic language, hate speech, and NSFW content.</div>
              </div>
            </label>
          </div>
          
          <div style="background: rgba(15,23,42,0.5); padding: 1rem; border-radius: 6px; border: 1px solid #475569;">
            <label style="display: flex; align-items: flex-start; gap: 0.5rem; cursor: pointer; color: #cbd5e1;">
              <input type="checkbox" id="modEscalation" checked style="margin-top: 3px;">
              <div>
                  <strong style="color: #f8fafc;">Crisis Escalation Protocols</strong>
                  <div style="font-size: 0.8rem; color: #94a3b8; margin-top: 0.25rem;">Identify high-risk messages (legal threats, viral complaints) and escalate instantly to your internal team inbox/SMS.</div>
              </div>
            </label>
          </div>
          
          <div style="background: rgba(15,23,42,0.5); padding: 1rem; border-radius: 6px; border: 1px solid #475569;">
            <label style="display: flex; align-items: flex-start; gap: 0.5rem; cursor: pointer; color: #cbd5e1;">
              <input type="checkbox" id="modCommunity" checked style="margin-top: 3px;">
              <div>
                  <strong style="color: #f8fafc;">Community Mgmt (Trust & Loyalty)</strong>
                  <div style="font-size: 0.8rem; color: #94a3b8; margin-top: 0.25rem;">Route positive/neutral questions to the AI Reply queue for timely, on-brand responses.</div>
              </div>
            </label>
          </div>
      </div>
      
      <div style="margin-top: 1rem; padding-top: 1rem; border-top: 1px dashed #475569;">
          <label style="color: #e2e8f0; font-size: 0.9rem; font-weight: bold; margin-bottom: 0.5rem; display: block;">Industry Routing Precision</label>
          <select id="industryRouting" style="width: 100%; background: #0f172a; border: 1px solid #334155; color: #f8fafc; padding: 0.6rem; border-radius: 4px; font-size: 0.9rem;">
            <option value="general">General / Default Routing</option>
            <option value="ecommerce">Ecommerce (Returns, Shipping, Restocks)</option>
            <option value="finance">Finance (High-security, Compliance, Fraud alerts)</option>
            <option value="automotive">Automotive (Service, Recalls, Sales inquiries)</option>
          </select>
          <div style="font-size: 0.8rem; color: #94a3b8; margin-top: 0.5rem;">The AI will load specialized lexicons for faster ticket resolution and smarter escalation.</div>
      </div>
    </div>
`;

html = html.replace(/(<div style="margin-bottom: 1.5rem;">\s*<label style="color: #38bdf8; font-weight: bold; margin-bottom: 0.5rem; display: block;">Cron \/ Scheduler Settings<\/label>)/, newModerationSection + '\n    $1');

// Update JS save and load function
const jsSaveMatch = /activeAccountIds: Array\.from\(document\.querySelectorAll\('\.automation-account-cb:checked'\)\)\.map\(cb => cb\.value\)/;
const jsSaveReplace = `activeAccountIds: Array.from(document.querySelectorAll('.automation-account-cb:checked')).map(cb => cb.value),
        modSpamBot: document.getElementById('modSpamBot').checked,
        modOffensive: document.getElementById('modOffensive').checked,
        modEscalation: document.getElementById('modEscalation').checked,
        modCommunity: document.getElementById('modCommunity').checked,
        industryRouting: document.getElementById('industryRouting').value`;
html = html.replace(jsSaveMatch, jsSaveReplace);

const jsLoadMatch = /document\.getElementById\('beFirstDelay'\)\.checked = typeof settings\.beFirstDelay !== 'undefined' \? settings\.beFirstDelay : true;/;
const jsLoadReplace = `document.getElementById('beFirstDelay').checked = typeof settings.beFirstDelay !== 'undefined' ? settings.beFirstDelay : true;
            
            if(document.getElementById('modSpamBot')) {
                document.getElementById('modSpamBot').checked = typeof settings.modSpamBot !== 'undefined' ? settings.modSpamBot : true;
                document.getElementById('modOffensive').checked = typeof settings.modOffensive !== 'undefined' ? settings.modOffensive : true;
                document.getElementById('modEscalation').checked = typeof settings.modEscalation !== 'undefined' ? settings.modEscalation : true;
                document.getElementById('modCommunity').checked = typeof settings.modCommunity !== 'undefined' ? settings.modCommunity : true;
                if(settings.industryRouting) document.getElementById('industryRouting').value = settings.industryRouting;
            }`;
html = html.replace(jsLoadMatch, jsLoadReplace);

fs.writeFileSync('rules.html', html, 'utf8');
console.log('Added Moderation, Crisis, and Industry Routing to Rules.');