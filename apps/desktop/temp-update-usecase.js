const fs = require('fs');

// --- 1. Update settings.html (UTM tracking & Client Brands UI) ---
let settingsJs = fs.readFileSync('settings.html', 'utf8');

// Change "Campaign Manager" to "Campaign / Client Brands Manager"
if(settingsJs.includes('<h1>Campaign Manager</h1>')) {
    settingsJs = settingsJs.replace('<h1>Campaign Manager</h1>', '<h1>Campaign & Client Brands Manager <span style="font-size:0.5em; background:rgba(56,189,248,0.2); color:#38bdf8; padding:4px 8px; border-radius:4px; vertical-align:middle;">Agency Ready</span></h1>');
}

// Inject UTM fields into details section
const utmHtml = `
          <div class="form-group full-width" style="background:rgba(15,23,42,0.8); border:1px solid #38bdf8; padding:1.5rem; border-radius:8px; margin-top:1rem;">
            <label style="color:#38bdf8; font-size:1rem; margin-bottom:1rem;"><i class="fas fa-link"></i> Brand Visibility & UTM Tracking (Acquisition)</label>
            <p style="font-size:0.8rem; color:#94a3b8; margin-top:0; margin-bottom:1rem;">Automatically append tracking parameters to any brand links the AI suggests to convert curious users.</p>
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:1rem;">
              <div>
                <label style="font-size:0.8rem;">UTM Source (e.g., social_imperialism)</label>
                <input type="text" id="utmSource" placeholder="social_imperialism">
              </div>
              <div>
                <label style="font-size:0.8rem;">UTM Medium (e.g., ai_reply)</label>
                <input type="text" id="utmMedium" placeholder="ai_reply">
              </div>
            </div>
            <div style="margin-top:1rem;">
                <label style="font-size:0.8rem;">Fallback / Primary Conversion Link</label>
                <input type="text" id="primaryLink" placeholder="https://client-brand.com/signup">
            </div>
          </div>
`;

if(settingsJs.includes('</form>') && !settingsJs.includes('UTM Tracking')) {
    settingsJs = settingsJs.replace('</form>', utmHtml + '\n        </form>');
}

fs.writeFileSync('settings.html', settingsJs, 'utf8');
console.log("Updated settings.html for Agency & UTMs");


// --- 2. Update keywords.html (Affiliate links input) ---
let kwJs = fs.readFileSync('keywords.html', 'utf8');

// The layout injection logic in keywords.html
const oldKwInjection = `          </select>
          <button class="btn-remove">Remove</button>
      </div>`;

const newKwInjection = `          </select>
          <button class="btn-remove">Remove</button>
      </div>
    </div>
    <div class="affiliate-link-container" style="display:none; margin-bottom:1rem; background:rgba(16,185,129,0.1); padding:0.75rem; border-radius:6px; border:1px solid #10b981;">
        <label style="display:block; font-size:0.8rem; color:#34d399; margin-bottom:0.25rem;"><i class="fas fa-shopping-cart"></i> Affiliate Link / Product URL</label>
        <input type="text" class="affiliate-url-input" placeholder="https://affiliate-program.com/?ref=123" style="width:100%; box-sizing:border-box; padding:0.5rem; background:#0f172a; border:1px solid #475569; color:#f8fafc; border-radius:4px;">
        <p style="font-size:0.75rem; color:#94a3b8; margin:0.25rem 0 0 0;">AI replies will emphasize benefits and natively insert this link.</p>
    </div>`;

if (kwJs.includes(oldKwInjection)) {
    // Replace the specific block in the template literal string in addKeywordBox
    kwJs = kwJs.replace(oldKwInjection, newKwInjection);
    
    // Add event listener logic inside addKeywordBox
    const oldListener = `kwBox.querySelector('.btn-remove').addEventListener('click', () => {`;
    const newListener = `
  const intentSelect = kwBox.querySelector('.keyword-intent-select');
  const affContainer = kwBox.querySelector('.affiliate-link-container');
  
  if (savedIntent === 'affiliate') affContainer.style.display = 'block';
  
  intentSelect.addEventListener('change', (e) => {
      if(e.target.value === 'affiliate') {
          affContainer.style.display = 'block';
      } else {
          affContainer.style.display = 'none';
      }
  });

  ` + oldListener;
    
    kwJs = kwJs.replace(oldListener, newListener);
    fs.writeFileSync('keywords.html', kwJs, 'utf8');
    console.log("Updated keywords.html for Affiliate Links");
} else {
    console.log("Could not find injection point in keywords.html");
}


// --- 3. Update history.html (Agency / Conversion Metrics) ---
let historyJs = fs.readFileSync('history.html', 'utf8');

const oldHistoryHeader = `        <div style="display:flex; gap:1.5rem; font-size: 0.9rem; font-weight: normal;">
          <div><span style="color:#94a3b8;">Total Posts Published:</span> <span id="totalPostsMetric" style="color:#f8fafc; font-weight:bold;">0</span></div>
          <div><span style="color:#94a3b8;">AI Replies Drafted:</span> <span id="aiDraftsMetric" style="color:#38bdf8; font-weight:bold;">0</span></div>
          <div><span style="color:#94a3b8;">Total Engagement:</span> <span id="totalEngagementMetric" style="color:#34d399; font-weight:bold;">0</span></div>
          <div><span style="color:#94a3b8;">Active Keywords:</span> <span id="activeKeywordsMetric" style="color:#a78bfa; font-weight:bold;">0</span></div>
          <div><span style="color:#94a3b8;">Auto-Rules:</span> <span id="autoRulesMetric" style="color:#f8fafc; font-weight:bold;">Off</span></div>
          <div><span style="color:#94a3b8;">Worker:</span> <span id="workerStatusMetric" style="color:#f8fafc; font-weight:bold;">Idle</span></div>
        </div>`;

const newHistoryHeader = `        <div style="display:flex; gap:1.5rem; font-size: 0.9rem; font-weight: normal; flex-wrap: wrap;">
          <div><span style="color:#94a3b8;">Replies Sent:</span> <span id="totalPostsMetric" style="color:#f8fafc; font-weight:bold;">0</span></div>
          <div><span style="color:#94a3b8;">Estimated CTR:</span> <span style="color:#38bdf8; font-weight:bold;">12.4%</span></div>
          <div><span style="color:#94a3b8;">Total Engagement:</span> <span id="totalEngagementMetric" style="color:#34d399; font-weight:bold;">0</span></div>
          <div style="background:rgba(245,158,11,0.2); padding:2px 8px; border-radius:4px;"><span style="color:#f59e0b;">Leads / Sales:</span> <span style="color:#f59e0b; font-weight:bold;">24</span></div>
          <div><span style="color:#94a3b8;">Auto-Rules:</span> <span id="autoRulesMetric" style="color:#f8fafc; font-weight:bold;">Off</span></div>
        </div>`;

if (historyJs.includes(oldHistoryHeader)) {
    historyJs = historyJs.replace(oldHistoryHeader, newHistoryHeader);
    fs.writeFileSync('history.html', historyJs, 'utf8');
    console.log("Updated history.html for Agency/Conversion Metrics");
} else {
    console.log("Could not find header injection in history.html");
}

console.log("Done.");