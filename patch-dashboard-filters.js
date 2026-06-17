const fs = require('fs');
let content = fs.readFileSync('C:/Users/theem/OneDrive/Documents/Factory AI.02.20.26/Social Imperialism/apps/desktop/dashboard.html', 'utf8');

// 1. Add Keywords Filter
const filtersHtmlStr = `<select id="feedPlatformFilter" onchange="loadFeed()">`;
const replacementFiltersHtmlStr = `<select id="feedKeywordFilter" onchange="loadFeed()" style="width: 120px; background: rgba(15,23,42,0.8); border: 1px solid #475569; color: #f8fafc; padding: 0.2rem 0.5rem; border-radius: 4px; font-size: 0.75rem;">
          <option value="all">All Keywords</option>
        </select>
        <select id="feedPlatformFilter" onchange="loadFeed()">`;
content = content.replace(filtersHtmlStr, replacementFiltersHtmlStr);

// 2. Make View Original functional - escaping the variables so they stay as variables in the final file
content = content.replace(/<button class="view">View Original<\/button>/g, `<button class="view" onclick="window.open('https://' + \`\${post.platform}\`.toLowerCase() + '.com/search?q=' + encodeURIComponent(\`\${post.content}\`.substring(0, 20)), '_blank')">View Original</button>`);

// 3. Populate Keyword filter dynamically
const loadFeedTop = `const platformFilter = document.getElementById('feedPlatformFilter').value;`;
const keywordFilterCheck = `const keywordFilter = document.getElementById('feedKeywordFilter') ? document.getElementById('feedKeywordFilter').value : 'all';
    const platformFilter = document.getElementById('feedPlatformFilter').value;`;
content = content.replace(loadFeedTop, keywordFilterCheck);

const passesPlatformCheck = `// Check Platform Filter`;
const passesKeywordCheck = `// Check Keyword Filter
        let passesKeyword = true;
        if (keywordFilter && keywordFilter !== 'all') {
            passesKeyword = p.matchedKeyword === keywordFilter;
        }
        
        // Check Platform Filter`;
content = content.replace(passesPlatformCheck, passesKeywordCheck);

const finalReturn = `return passesPlatform && passesEngagement && passesPostType && passesExclude && passesFollowers && passesMedia;`;
const finalReturnReplacement = `return passesKeyword && passesPlatform && passesEngagement && passesPostType && passesExclude && passesFollowers && passesMedia;`;
content = content.replace(finalReturn, finalReturnReplacement);

// 4. Add keywords to the dropdown initially
const loadDomDetailerCall = `setTimeout(loadDomDetailer, 1000);`;
const loadKeywordsCall = `setTimeout(loadDomDetailer, 1000);

// Populate Keywords Filter
try {
    ipcRenderer.invoke('get-keywords').then(keywords => {
        const kwSelect = document.getElementById('feedKeywordFilter');
        if (kwSelect && keywords && keywords.length > 0) {
            keywords.forEach(kw => {
                const opt = document.createElement('option');
                opt.value = kw.term || kw;
                opt.innerText = kw.term || kw;
                kwSelect.appendChild(opt);
            });
        }
    });
} catch(e) {}`;
content = content.replace(loadDomDetailerCall, loadKeywordsCall);

fs.writeFileSync('C:/Users/theem/OneDrive/Documents/Factory AI.02.20.26/Social Imperialism/apps/desktop/dashboard.html', content, 'utf8');
console.log('Dashboard patched successfully');
