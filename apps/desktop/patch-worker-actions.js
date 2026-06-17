const fs = require('fs');
let idx = fs.readFileSync('index.js', 'utf8');

// The worker in index.js currently assigns actionText based on rule.platformAction:
// let actionText = 'Drafted Reply';
// if (rule.platformAction === 'auto') actionText = 'Auto-Replied';
// if (rule.platformAction === 'follow') actionText = 'Followed & Replied';
// if (rule.platformAction === 'share') actionText = 'Shared & Replied';

// We need to integrate the new Auto-Rules:
// const rulesEngineRaw = store.getItem('autoRulesEngine');
// let re = null; try { re = JSON.parse(rulesEngineRaw); } catch(e){}
// if (re && re.autoLike) actionText = 'Liked & ' + actionText;
// if (re && re.autoShare) actionText = 'Shared & ' + actionText;
// if (re && re.autoFollow) actionText = 'Followed & ' + actionText;

const searchStr = `                let actionText = 'Drafted Reply';
                if (rule.platformAction === 'auto') actionText = 'Auto-Replied';
                if (rule.platformAction === 'follow') actionText = 'Followed & Replied';
                if (rule.platformAction === 'share') actionText = 'Shared & Replied';`;

const replaceStr = `                let actionText = 'Drafted Reply';
                if (rule.platformAction === 'auto') actionText = 'Auto-Replied';
                
                const rulesEngineRawWorker = store.getItem('autoRulesEngine');
                if (rulesEngineRawWorker) {
                    try {
                        const rw = JSON.parse(rulesEngineRawWorker);
                        if(rw.autoReplyEnabled) actionText = 'Auto-Replied';
                        if(rw.autoLike) actionText = 'Liked & ' + actionText;
                        if(rw.autoShare) actionText = 'Shared & ' + actionText;
                        if(rw.autoFollow) actionText = 'Followed & ' + actionText;
                    } catch(e) {}
                }`;

if(idx.includes(searchStr)) {
    idx = idx.split(searchStr).join(replaceStr);
    fs.writeFileSync('index.js', idx, 'utf8');
    console.log('Worker actions updated in index.js');
} else {
    console.log('Could not find search string in index.js');
}