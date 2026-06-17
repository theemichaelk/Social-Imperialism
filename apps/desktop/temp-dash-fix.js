const fs = require('fs');
let html = fs.readFileSync('dashboard.html', 'utf8');

// The issue on Dashboard is that it has a ton of javascript functions but NOTHING calling them because the previous DOMContentLoaded was accidentally wiped out in earlier patches.
// Let's explicitly inject the initialization calls at the bottom of the script block.

const initCall = `
document.addEventListener('DOMContentLoaded', () => {
    console.log("Dashboard initializing...");
    try {
        if(typeof loadAccounts === 'function') loadAccounts();
        if(typeof window.loadNews === 'function') window.loadNews();
        else if(typeof loadNews === 'function') loadNews();
        if(typeof loadDomainMetrics === 'function') loadDomainMetrics();
        if(typeof initSidebarSwitcher === 'function') initSidebarSwitcher();
        if(typeof loadSavedProfilesDropdown === 'function') loadSavedProfilesDropdown();
    } catch(e) {
        console.error("Dashboard init error:", e);
    }
});
</script>
</body>
</html>`;

if(!html.includes("Dashboard initializing...")) {
    html = html.replace('</script>\n</body>\n</html>', initCall);
    fs.writeFileSync('dashboard.html', html, 'utf8');
    console.log("Added initialization block to dashboard.html");
} else {
    console.log("Dashboard already has an initialization block.");
}