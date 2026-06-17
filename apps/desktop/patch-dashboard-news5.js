const fs = require('fs');
let html = fs.readFileSync('dashboard.html', 'utf8');

// The PRD specifies that Trending News must show EXACTLY 4 random titles that open in a new research page.
// The history log indicated this had been an issue before, often failing due to `globalKeys is not defined`.
// I am replacing the `loadNews()` function completely with a robust, inline script.

const newLoadNews = `
window.loadNews = async function() {
    console.log("Loading news...");
    const container = document.getElementById('live-news');
    if(!container) return;
    
    container.innerHTML = '<div style="color:#94a3b8; font-size: 0.9rem;"><i class="fas fa-spinner fa-spin"></i> Fetching live feeds...</div>';
    
    try {
        const { ipcRenderer, shell } = require('electron');
        const news = await ipcRenderer.invoke('get-live-news');
        
        if(!news || !Array.isArray(news) || news.length === 0) {
            container.innerHTML = '<div style="color:#ef4444; font-size: 0.9rem;">No news available for this campaign.</div>';
            return;
        }
        
        // Randomize
        const shuffled = news.sort(() => 0.5 - Math.random());
        // Exactly 4 titles
        const top4 = shuffled.slice(0, 4);
        
        let htmlStr = '<div style="display:flex; flex-direction:column; gap:8px;">';
        top4.forEach(item => {
            htmlStr += \`<a href="#" onclick="require('electron').shell.openExternal('\${item.url}')" style="color: #38bdf8; text-decoration: none; font-size: 0.9rem; border-bottom: 1px solid #1e293b; padding-bottom: 4px; display: block; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; transition: all 0.2s;" onmouseover="this.style.color='#f8fafc'" onmouseout="this.style.color='#38bdf8'" title="\${item.title}">\${item.title}</a>\`;
        });
        htmlStr += '</div>';
        
        container.innerHTML = htmlStr;
        
    } catch(e) {
        console.error('News error:', e);
        container.innerHTML = '<div style="color:#ef4444; font-size: 0.9rem;">API Error fetching news.</div>';
    }
};
`;

// Rip out any old loadNews implementation
let pattern = /function loadNews\(\) \{[\s\S]*?\}\s*(?=async function|function|document|let|const|\n<\/script>)/g;
if(pattern.test(html)) {
    html = html.replace(pattern, newLoadNews);
} else {
    // If we can't find it, just inject it into the script block
    html = html.replace('// Dashboard Initialization Logic', newLoadNews + '\n\n// Dashboard Initialization Logic');
}

fs.writeFileSync('dashboard.html', html, 'utf8');
console.log('Trending News patched successfully.');