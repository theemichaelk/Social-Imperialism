const fs = require('fs');
let indexJs = fs.readFileSync('index.js', 'utf8');

// Update backend mock to show heuristic question matching and ranking
const mockUnansweredMatch = /ipcMain\.handle\('get-unanswered-questions', async \(event\) => \{\s*return \[\s*\{/;

const newMockUnanswered = `ipcMain.handle('get-unanswered-questions', async (event) => {
    return [
        {
            platform: "Quora / Marketing",
            views: 12450,
            timeElapsed: "14h",
            content: "What is the best way to automate social media posting across multiple accounts without getting shadowbanned?",
            classification: "High Intent Question",
            rankScore: 98
        },
        {
            platform: "Reddit / r/SaaS",
            views: 8900,
            timeElapsed: "6h",
            content: "Has anyone found a good alternative to Hootsuite that doesn't cost $100+/month for basic features?",
            classification: "Competitor Alternative Search",
            rankScore: 95
        },
        {
            platform: "Twitter / X",
            views: 4200,
            timeElapsed: "2h",
            content: "I'm spending way too much time managing client accounts. Are there tools that use AI to draft replies?",
            classification: "Direct Need Question",
            rankScore: 89
        }
    ];
});`;

// Need a more reliable regex replace, replacing the whole block
const replaceBlockRegex = /ipcMain\.handle\('get-unanswered-questions'[\s\S]*?\}\);/m;

if (indexJs.match(replaceBlockRegex)) {
    indexJs = indexJs.replace(replaceBlockRegex, newMockUnanswered);
}

fs.writeFileSync('index.js', indexJs, 'utf8');

// Now update the frontend to show the classification and rank score
let html = fs.readFileSync('dashboard.html', 'utf8');

const htmlCardRegex = /<span style="color: #f59e0b; font-size: 0\.8rem; font-weight: bold;">👁️ \$\{q\.views\.toLocaleString\(\)\} Views &nbsp;\|&nbsp; ⏱️ \$\{q\.timeElapsed\} old<\/span>/;

const newHtmlCard = `<span style="color: #f59e0b; font-size: 0.8rem; font-weight: bold;">👁️ \${q.views.toLocaleString()} Views &nbsp;|&nbsp; ⏱️ \${q.timeElapsed} old &nbsp;|&nbsp; <span style="color:#10b981;">Score: \${q.rankScore || 90}</span></span>
                </div>
                <div style="font-size: 0.75rem; color: #94a3b8; margin-bottom: 8px; text-transform: uppercase; letter-spacing: 0.5px;">AI Classification: \${q.classification || 'Question'}</div>`;

if (html.match(htmlCardRegex)) {
    html = html.replace(htmlCardRegex, newHtmlCard);
}

fs.writeFileSync('dashboard.html', html, 'utf8');
console.log('Successfully updated index.js and dashboard.html with heuristic ranking data.');