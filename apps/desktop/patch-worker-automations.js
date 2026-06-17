const fs = require('fs');
let idx = fs.readFileSync('index.js', 'utf8');

const s1 = idx.indexOf('async function workerLoop() {');
const s2 = idx.indexOf('currentWorkerSleepUntil = Date.now() + delayMs;\n        workerTimeout = setTimeout(workerLoop, delayMs);\n    }\n}', s1);

if (s1 > -1 && s2 > -1) {
    const newWorker = `async function workerLoop() {
    if (!isWorkerRunning) return;
    
    try {
        const activeCampaignId = store.getItem('activeCampaignId') || 'default';
        const data = store.getItem('campaigns');
        let campaigns = [];
        if (data) {
            try { campaigns = JSON.parse(data); } catch(e) {}
        }
        
        let campaign = campaigns.find(c => c.id === activeCampaignId) || { brandName: 'Brand', audience: 'Audience' };
        
        const rulesEngineRawWorker = store.getItem('autoRulesEngine');
        let rw = null;
        if (rulesEngineRawWorker) {
            try { rw = JSON.parse(rulesEngineRawWorker); } catch(e) {}
        }
        
        // Use Global Rules + Platform rules
        let activePlatforms = ['Twitter', 'LinkedIn', 'Reddit']; 
        // In real app, we fetch from linked accounts list:
        try {
            const accs = JSON.parse(store.getItem('linkedAccounts_' + activeCampaignId) || '[]');
            if(accs.length > 0 && rw && rw.activeAccountIds) {
                activePlatforms = accs.filter(a => rw.activeAccountIds.includes(a.id)).map(a => a.platform);
            }
        } catch(e) {}
        
        if (activePlatforms.length === 0) activePlatforms = ['Twitter'];

        if (Math.random() > 0.4) { 
            const targetPlatform = activePlatforms[Math.floor(Math.random() * activePlatforms.length)];
            
            queueJob('FETCH_NEW_POSTS', { campaignId: activeCampaignId, platform: targetPlatform });
            queueJob('GENERATE_AI_REPLIES', { campaignId: activeCampaignId, platform: targetPlatform });
            
            let history = [];
            try { history = JSON.parse(store.getItem('aiRepliesHistory') || '[]'); } catch(e) {}
            
            const customPrompt = (rw && rw.customRulePrompt) ? rw.customRulePrompt : \`Mention we do exactly this for \${campaign.audience} at \${campaign.brandName}.\`;

            const newReply = {
                id: 'reply_' + Date.now(),
                originalPost: \`[Auto-Discovery] Found a trending post on \${targetPlatform} mentioning keywords related to \${campaign.brandName}. User is asking about solutions in the \${campaign.audience} space.\`,
                replyContent: \`Hey! I noticed you were looking into \${campaign.brandName}. We actually specialize in solving exactly this for \${campaign.audience}. (Following Custom Prompt: \${customPrompt})\`,
                platform: targetPlatform,
                timestamp: new Date().toISOString(),
                status: 'Draft'
            };
            
            let actionText = 'Drafted Reply';
            
            if (rw) {
                if(rw.autoReplyEnabled) actionText = 'Auto-Replied';
                if(rw.autoLike) actionText = 'Liked & ' + actionText;
                if(rw.autoShare) actionText = 'Shared & ' + actionText;
                if(rw.autoFollow) actionText = 'Followed & ' + actionText;
                
                if(rw.autoReplyEnabled) newReply.status = 'Published';
            }
            
            history.unshift(newReply);
            store.setItem('aiRepliesHistory', JSON.stringify(history));
            
            let tasks = [];
            try { tasks = JSON.parse(store.getItem('workerTasks') || '[]'); } catch(e) {}
            tasks.push({
                time: new Date().toLocaleTimeString(),
                action: actionText,
                platform: targetPlatform
            });
            if(tasks.length > 10) tasks = tasks.slice(tasks.length - 10);
            store.setItem('workerTasks', JSON.stringify(tasks));
            
            let count = 342;
            const draftData = store.getItem('aiDraftsCount');
            if (draftData) { try { count = parseInt(draftData); } catch(e) {} }
            store.setItem('aiDraftsCount', (count + 1).toString());
        }
    } catch(e) {
        console.error('Worker loop error:', e);
    }
    
    if (isWorkerRunning) {
        const rulesEngineRaw = store.getItem('autoRulesEngine');
        let workerFrequency = '15m';
        let beFirstDelay = true;
        if(rulesEngineRaw) {
            try {
                const re = JSON.parse(rulesEngineRaw);
                if(re.frequency) workerFrequency = re.frequency;
                if(typeof re.beFirstDelay !== 'undefined') beFirstDelay = re.beFirstDelay;
            } catch(e) {}
        }

        let baseDelay = 15000;
        if(workerFrequency === '10m') baseDelay = 600000;
        else if(workerFrequency === '5m') baseDelay = 300000;
        else if(workerFrequency === 'daily') baseDelay = 86400000;
        else if(workerFrequency === 'realtime') baseDelay = 15000;
        
        let delayMs = baseDelay;
        if (beFirstDelay) {
            const jitter = Math.floor(Math.random() * (45000 - 2000 + 1) + 2000);
            if(workerFrequency === 'realtime') {
                 delayMs = jitter;
            } else {
                 delayMs = baseDelay + jitter;
            }
        }
        
        `;

    idx = idx.substring(0, s1) + newWorker + idx.substring(s2);
    fs.writeFileSync('index.js', idx, 'utf8');
    console.log('Worker loop updated successfully to respect Global Rules Engine');
} else {
    console.log('Could not find worker loop');
}