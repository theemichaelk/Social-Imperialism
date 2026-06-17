const fs = require('fs');
let html = fs.readFileSync('history.html', 'utf8');

// Ensure updateLiveMetrics maps accurately to the stat cards
const patch = `
window.updateLiveMetrics = function() {
    const filterEl = document.getElementById('metricsTimeFilter');
    const filter = filterEl ? filterEl.value : 'all';
    
    const historyData = localStorage.getItem('aiRepliesHistory');
    let replies = [];
    if(historyData) {
        try { replies = JSON.parse(historyData); } catch(e){}
    }
    
    const now = new Date().getTime();
    let cutoff = 0;
    if(filter === '24h') cutoff = now - (24 * 60 * 60 * 1000);
    else if(filter === '1w') cutoff = now - (7 * 24 * 60 * 60 * 1000);
    else if(filter === '1m') cutoff = now - (30 * 24 * 60 * 60 * 1000);
    else if(filter === '3m') cutoff = now - (90 * 24 * 60 * 60 * 1000);
    
    const filteredReplies = replies.filter(r => {
        if(filter === 'all') return true;
        return new Date(r.timestamp).getTime() >= cutoff;
    });
    
    const published = filteredReplies.filter(r => r.status === 'Published').length;
    const drafted = filteredReplies.filter(r => r.status === 'Draft').length;
    
    const engagementFactor = filter === 'all' ? 1.5 : 1;
    const estEngagement = Math.floor(published * 4.2 * engagementFactor); 
    const hoursSaved = ((published + drafted) * 5) / 60; 
    
    const metricBoxes = document.querySelectorAll('.stat-value');
    if(metricBoxes.length >= 4) {
        metricBoxes[0].innerText = published;
        metricBoxes[1].innerText = drafted;
        metricBoxes[2].innerText = estEngagement.toLocaleString();
        metricBoxes[3].innerText = hoursSaved.toFixed(1) + 'h';
    }
}
document.addEventListener('DOMContentLoaded', () => { setTimeout(window.updateLiveMetrics, 1000); });
`;

if(html.includes('updateLiveMetrics')) {
    html = html.replace(/window\.updateLiveMetrics[\s\S]*\}\);/m, patch);
    fs.writeFileSync('history.html', html, 'utf8');
}