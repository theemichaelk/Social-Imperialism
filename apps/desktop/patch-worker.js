const fs = require('fs');

const indexJsPath = 'index.js';
let indexJs = fs.readFileSync(indexJsPath, 'utf8');

const newDelayLogic = `        // Check for Frequency settings
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

        let baseDelay = 15000; // 15s default for realtime simulation
        if(workerFrequency === '10m') baseDelay = 600000;
        else if(workerFrequency === '5m') baseDelay = 300000;
        else if(workerFrequency === 'daily') baseDelay = 86400000;
        else if(workerFrequency === 'realtime') baseDelay = 15000;
        
        let delayMs = baseDelay;
        if (beFirstDelay) {
            // "Be First to Reply" - random human-like delay between 2 and 45 seconds to look natural when running the frequency check
            const jitter = Math.floor(Math.random() * (45000 - 2000 + 1) + 2000);
            if(workerFrequency === 'realtime') {
                 delayMs = jitter;
            } else {
                 delayMs = baseDelay + jitter;
            }
        }
        
        currentWorkerSleepUntil = Date.now() + delayMs;
        workerTimeout = setTimeout(workerLoop, delayMs);`;

const oldDelayLogic = `        // Random human delay between 15 seconds and 45 seconds to prevent spam tracking
        const delayMs = Math.floor(Math.random() * (45000 - 15000 + 1) + 15000);
        currentWorkerSleepUntil = Date.now() + delayMs;
        workerTimeout = setTimeout(workerLoop, delayMs);`;

if(indexJs.includes(oldDelayLogic)) {
    indexJs = indexJs.split(oldDelayLogic).join(newDelayLogic);
    fs.writeFileSync(indexJsPath, indexJs, 'utf8');
    console.log("Worker delay logic updated.");
} else {
    console.log("Could not find old delay logic in index.js");
}