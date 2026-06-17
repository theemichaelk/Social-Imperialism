const fs = require('fs');
let html = fs.readFileSync('history.html', 'utf8');

// 1. Export Data Button
const exportRegex = /<button id="exportDataBtn" class="export-btn">Export Data<\/button>/;
const newExport = `<button id="exportDataBtn" class="export-btn" onclick="exportData()">Export Data</button>`;
if (html.match(exportRegex)) html = html.replace(exportRegex, newExport);

// 2. Add Export Logic & load real stats
const scriptInject = `
async function exportData() {
    const history = await ipcRenderer.invoke('get-all-replies-history');
    if(!history || history.length === 0) {
        alert("No data to export");
        return;
    }
    const csvContent = "data:text/csv;charset=utf-8," 
        + "Original Post,AI Reply,Platform,Status,Date\\n"
        + history.map(e => \`"\${e.originalPost.replace(/"/g, '""')}","\${e.replyContent.replace(/"/g, '""')}","\${e.platform}","\${e.status}","\${new Date(e.timestamp).toLocaleString()}"\`).join("\\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "ai_replies_export.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// Ensure the Command Center loads real metrics
async function loadRealCommandCenterMetrics() {
    try {
        const stats = await ipcRenderer.invoke('get-dashboard-stats');
        const keywords = await ipcRenderer.invoke('get-keywords');
        
        // Find the stat elements in the header and update them
        const statElements = document.querySelectorAll('.header-stat-value');
        if (statElements.length >= 4) {
             statElements[0].innerText = stats.totalPosts || 0;
             statElements[1].innerText = stats.aiDrafts || 0;
             statElements[2].innerText = stats.totalEngagement || 0;
             statElements[3].innerText = (keywords && Array.isArray(keywords)) ? keywords.length : 0;
        }
    } catch(e) {
        console.error("Failed to load real command center stats in history", e);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    loadRealCommandCenterMetrics();
});
`;

if (!html.includes('loadRealCommandCenterMetrics')) {
    html = html.replace('</script>\n</body>', scriptInject + '\n</script>\n</body>');
}

fs.writeFileSync('history.html', html, 'utf8');
console.log('Fixed History (AI Replies) page');