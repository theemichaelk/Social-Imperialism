const fs = require('fs');
let html = fs.readFileSync('settings.html', 'utf8');

const newTabsHtml = `
    <!-- Settings Sub-Navigation -->
    <div style="display:flex; gap:10px; margin-bottom: 2rem;">
      <button class="primary" id="btn-campaigns" onclick="switchSettingsView('campaignListView')" style="padding:0.5rem 1rem; font-size:0.85rem;"><i class="fas fa-layer-group"></i> Campaigns</button>
      <button class="secondary" id="btn-pricing" onclick="switchSettingsView('pricingView')" style="padding:0.5rem 1rem; font-size:0.85rem;"><i class="fas fa-credit-card"></i> Pricing Plans & Billing</button>
      <button class="secondary" id="btn-tutorials" onclick="switchSettingsView('tutorialView')" style="padding:0.5rem 1rem; font-size:0.85rem;"><i class="fas fa-graduation-cap"></i> Setup / Tutorials</button>
    </div>

    <!-- Campaign Selection View -->
`;

html = html.replace(/<!-- Campaign Selection View -->/, newTabsHtml);

const newViewsHtml = `
    <!-- Pricing & Billing View -->
    <div id="pricingView" class="hidden">
      <div class="header">
        <h1><i class="fas fa-credit-card"></i> Pricing Plans</h1>
        <p style="color:#94a3b8; margin-top:5px;">Simple monthly pricing. Flexibility at our core: Increase or decrease support teams as needed. Handle surge periods automatically.</p>
      </div>
      
      <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 1.5rem; margin-bottom: 2rem;">
        <!-- Standard -->
        <div style="background: rgba(30, 41, 59, 0.5); border: 1px solid #475569; border-radius: 12px; padding: 2rem; position: relative;">
          <h3 style="color: #e2e8f0; margin-top: 0; font-size: 1.3rem;">Starter</h3>
          <div style="font-size: 2.5rem; font-weight: bold; color: #f8fafc; margin-bottom: 1rem;">$49<span style="font-size:1rem; color:#94a3b8; font-weight:normal;">/mo</span></div>
          <p style="color: #94a3b8; font-size: 0.9rem; margin-bottom: 1.5rem; min-height: 40px;">For solo creators automating basic engagement.</p>
          <ul style="list-style: none; padding: 0; margin: 0 0 2rem 0; color: #cbd5e1; font-size: 0.9rem;">
            <li style="margin-bottom: 0.5rem;"><i class="fas fa-check" style="color:#10b981; margin-right:8px;"></i> 3 Social Accounts</li>
            <li style="margin-bottom: 0.5rem;"><i class="fas fa-check" style="color:#10b981; margin-right:8px;"></i> Basic AI Replies</li>
            <li style="margin-bottom: 0.5rem;"><i class="fas fa-check" style="color:#10b981; margin-right:8px;"></i> 500 AI Generations/mo</li>
            <li style="margin-bottom: 0.5rem;"><i class="fas fa-times" style="color:#ef4444; margin-right:8px;"></i> No Crisis Monitoring</li>
          </ul>
          <button class="secondary" style="width: 100%;">Current Plan</button>
        </div>

        <!-- Pro -->
        <div style="background: rgba(15, 23, 42, 0.8); border: 2px solid #38bdf8; border-radius: 12px; padding: 2rem; position: relative; box-shadow: 0 0 20px rgba(56,189,248,0.15);">
          <div style="position: absolute; top: -12px; left: 50%; transform: translateX(-50%); background: #38bdf8; color: #020617; padding: 2px 12px; border-radius: 12px; font-size: 0.75rem; font-weight: bold; text-transform: uppercase;">Most Popular</div>
          <h3 style="color: #38bdf8; margin-top: 0; font-size: 1.3rem;">Growth</h3>
          <div style="font-size: 2.5rem; font-weight: bold; color: #f8fafc; margin-bottom: 1rem;">$149<span style="font-size:1rem; color:#94a3b8; font-weight:normal;">/mo</span></div>
          <p style="color: #94a3b8; font-size: 0.9rem; margin-bottom: 1.5rem; min-height: 40px;">For agencies and growing brands managing communities.</p>
          <ul style="list-style: none; padding: 0; margin: 0 0 2rem 0; color: #cbd5e1; font-size: 0.9rem;">
            <li style="margin-bottom: 0.5rem;"><i class="fas fa-check" style="color:#10b981; margin-right:8px;"></i> 15 Social Accounts</li>
            <li style="margin-bottom: 0.5rem;"><i class="fas fa-check" style="color:#10b981; margin-right:8px;"></i> Spam & Bot Filtering</li>
            <li style="margin-bottom: 0.5rem;"><i class="fas fa-check" style="color:#10b981; margin-right:8px;"></i> Advanced Analytics</li>
            <li style="margin-bottom: 0.5rem;"><i class="fas fa-check" style="color:#10b981; margin-right:8px;"></i> Reddit Prospector</li>
          </ul>
          <button class="primary" style="width: 100%;">Upgrade to Growth</button>
        </div>

        <!-- Enterprise -->
        <div style="background: rgba(30, 41, 59, 0.5); border: 1px solid #475569; border-radius: 12px; padding: 2rem; position: relative;">
          <h3 style="color: #e2e8f0; margin-top: 0; font-size: 1.3rem;">Enterprise</h3>
          <div style="font-size: 2.5rem; font-weight: bold; color: #f8fafc; margin-bottom: 1rem;">Custom</div>
          <p style="color: #94a3b8; font-size: 0.9rem; margin-bottom: 1.5rem; min-height: 40px;">High volume teams across Finance, Ecommerce & Automotive.</p>
          <ul style="list-style: none; padding: 0; margin: 0 0 2rem 0; color: #cbd5e1; font-size: 0.9rem;">
            <li style="margin-bottom: 0.5rem;"><i class="fas fa-check" style="color:#10b981; margin-right:8px;"></i> Unlimited Accounts</li>
            <li style="margin-bottom: 0.5rem;"><i class="fas fa-check" style="color:#10b981; margin-right:8px;"></i> 24/7 Crisis Monitoring</li>
            <li style="margin-bottom: 0.5rem;"><i class="fas fa-check" style="color:#10b981; margin-right:8px;"></i> Dedicated Account Manager</li>
            <li style="margin-bottom: 0.5rem;"><i class="fas fa-check" style="color:#10b981; margin-right:8px;"></i> Custom Industry Routing</li>
          </ul>
          <button class="secondary" style="width: 100%;">Contact Sales</button>
        </div>
      </div>
      
      <div style="background: rgba(16, 185, 129, 0.1); border: 1px solid #10b981; border-radius: 8px; padding: 1.5rem; display: flex; justify-content: space-between; align-items: center;">
        <div>
          <h4 style="color: #34d399; margin: 0 0 0.5rem 0;">Launch in 24 hours</h4>
          <p style="color: #94a3b8; margin: 0; font-size: 0.9rem;">Dedicated Account Managers to enable seamless onboarding. We learn your brand in days, not weeks.</p>
        </div>
        <button class="primary" style="background: linear-gradient(135deg, #10b981, #059669); box-shadow: 0 4px 15px rgba(16, 185, 129, 0.3);">Schedule Onboarding</button>
      </div>
    </div>

    <!-- Tutorials & Setup View -->
    <div id="tutorialView" class="hidden">
      <div class="header">
        <h1><i class="fas fa-graduation-cap"></i> Setup & Tutorials</h1>
        <p style="color:#94a3b8; margin-top:5px;">Best in class AI and automation setup guides to help you scale your operations securely.</p>
      </div>
      
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem;">
        <div style="background: rgba(30, 41, 59, 0.5); border: 1px solid #475569; border-radius: 8px; overflow: hidden; cursor:pointer; transition: all 0.2s;" onmouseover="this.style.borderColor='#38bdf8'" onmouseout="this.style.borderColor='#475569'">
          <div style="height: 160px; background: #1e293b; display: flex; align-items: center; justify-content: center; position: relative;">
            <i class="fab fa-youtube fa-3x" style="color: #ef4444;"></i>
            <div style="position: absolute; bottom: 10px; right: 10px; background: rgba(0,0,0,0.8); padding: 2px 6px; border-radius: 4px; font-size: 0.75rem;">12:45</div>
          </div>
          <div style="padding: 1rem;">
            <h4 style="margin: 0 0 0.5rem 0; color: #e2e8f0;">Mastering the Visual Automations Builder</h4>
            <p style="margin: 0; color: #94a3b8; font-size: 0.85rem;">Learn how to connect triggers to actions and manage webhooks.</p>
          </div>
        </div>

        <div style="background: rgba(30, 41, 59, 0.5); border: 1px solid #475569; border-radius: 8px; overflow: hidden; cursor:pointer; transition: all 0.2s;" onmouseover="this.style.borderColor='#38bdf8'" onmouseout="this.style.borderColor='#475569'">
          <div style="height: 160px; background: #1e293b; display: flex; align-items: center; justify-content: center; position: relative;">
            <i class="fas fa-shield-alt fa-3x" style="color: #10b981;"></i>
            <div style="position: absolute; bottom: 10px; right: 10px; background: rgba(0,0,0,0.8); padding: 2px 6px; border-radius: 4px; font-size: 0.75rem;">08:20</div>
          </div>
          <div style="padding: 1rem;">
            <h4 style="margin: 0 0 0.5rem 0; color: #e2e8f0;">Setting up Spam Filtering & Escalation</h4>
            <p style="margin: 0; color: #94a3b8; font-size: 0.85rem;">Configure your auto-rules to protect your brand from toxic content.</p>
          </div>
        </div>

        <div style="background: rgba(30, 41, 59, 0.5); border: 1px solid #475569; border-radius: 8px; overflow: hidden; cursor:pointer; transition: all 0.2s;" onmouseover="this.style.borderColor='#38bdf8'" onmouseout="this.style.borderColor='#475569'">
          <div style="height: 160px; background: #1e293b; display: flex; align-items: center; justify-content: center; position: relative;">
            <i class="fab fa-reddit-alien fa-3x" style="color: #f97316;"></i>
            <div style="position: absolute; bottom: 10px; right: 10px; background: rgba(0,0,0,0.8); padding: 2px 6px; border-radius: 4px; font-size: 0.75rem;">15:30</div>
          </div>
          <div style="padding: 1rem;">
            <h4 style="margin: 0 0 0.5rem 0; color: #e2e8f0;">Reddit Prospector Workflows</h4>
            <p style="margin: 0; color: #94a3b8; font-size: 0.85rem;">How to find high-intent leads and funnel them into your CRM.</p>
          </div>
        </div>

        <div style="background: rgba(30, 41, 59, 0.5); border: 1px solid #475569; border-radius: 8px; overflow: hidden; cursor:pointer; transition: all 0.2s;" onmouseover="this.style.borderColor='#38bdf8'" onmouseout="this.style.borderColor='#475569'">
          <div style="height: 160px; background: #1e293b; display: flex; align-items: center; justify-content: center; position: relative;">
            <i class="fas fa-project-diagram fa-3x" style="color: #a855f7;"></i>
            <div style="position: absolute; bottom: 10px; right: 10px; background: rgba(0,0,0,0.8); padding: 2px 6px; border-radius: 4px; font-size: 0.75rem;">05:15</div>
          </div>
          <div style="padding: 1rem;">
            <h4 style="margin: 0 0 0.5rem 0; color: #e2e8f0;">OAuth 2.0 Integration Guide</h4>
            <p style="margin: 0; color: #94a3b8; font-size: 0.85rem;">Step-by-step instructions for connecting all 12+ social platforms securely.</p>
          </div>
        </div>
      </div>
    </div>
    
    <!-- Edit/Create Campaign View -->
`;

html = html.replace(/<!-- Edit\/Create Campaign View -->/, newViewsHtml);

const newJsHtml = `
window.switchSettingsView = function(viewId) {
    document.getElementById('campaignListView').classList.add('hidden');
    document.getElementById('campaignEditView').classList.add('hidden');
    document.getElementById('apiKeysView').classList.add('hidden');
    document.getElementById('pricingView').classList.add('hidden');
    document.getElementById('tutorialView').classList.add('hidden');
    
    if(viewId !== 'apiKeysView' && viewId !== 'campaignEditView') {
        document.getElementById('btn-campaigns').className = 'secondary';
        document.getElementById('btn-pricing').className = 'secondary';
        document.getElementById('btn-tutorials').className = 'secondary';
        
        if(viewId === 'campaignListView') document.getElementById('btn-campaigns').className = 'primary';
        if(viewId === 'pricingView') document.getElementById('btn-pricing').className = 'primary';
        if(viewId === 'tutorialView') document.getElementById('btn-tutorials').className = 'primary';
        
        if(viewId === 'campaignListView') {
            document.getElementById('newCampaignBtn').classList.remove('hidden');
        } else {
            document.getElementById('newCampaignBtn').classList.add('hidden');
        }
    }
    
    document.getElementById(viewId).classList.remove('hidden');
};

function showListView() {
  switchSettingsView('campaignListView');
  loadCampaigns();
}
`;

html = html.replace(/function showListView\(\) {[\s\S]*?loadCampaigns\(\);\n}/, newJsHtml);

fs.writeFileSync('settings.html', html, 'utf8');
console.log('Added Pricing and Tutorials views to Settings.');