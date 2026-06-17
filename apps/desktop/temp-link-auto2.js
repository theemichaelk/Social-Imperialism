const fs = require('fs');
const pages = ['dashboard.html', 'history.html', 'content-hub.html', 'rules.html', 'keywords.html', 'settings.html', 'calendar.html', 'account-hub.html'];

pages.forEach(page => {
    try {
        let html = fs.readFileSync(page, 'utf8');
        
        // Find sidebar menu and inject link if it doesn't exist
        if(!html.includes('automations.html')) {
            const regex = /<a href="rules\.html"[^>]*>.*?<\/a>/i;
            const match = html.match(regex);
            
            if(match) {
                const rulesLink = match[0];
                const newLink = `<a href="automations.html" class="nav-link">Visual Builder</a>\n  ${rulesLink}`;
                html = html.replace(rulesLink, newLink);
                fs.writeFileSync(page, html, 'utf8');
                console.log('Linked in', page);
            }
        } else {
            console.log('Already linked in', page);
        }
    } catch(e) {
        console.error('Error on page', page, e.message);
    }
});