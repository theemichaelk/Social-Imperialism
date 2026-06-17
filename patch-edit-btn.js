const fs = require('fs');
let content = fs.readFileSync('C:/Users/theem/OneDrive/Documents/Factory AI.02.20.26/Social Imperialism/apps/desktop/dashboard.html', 'utf8');

const htmlToReplace = `<button class="schedule-reply" style="background:transparent; color:#f1f5f9; border:1px solid #475569; padding:8px 20px; border-radius:6px; font-weight:bold; cursor:pointer;">Schedule</button>`;
const newHtml = `<button class="schedule-reply" style="background:transparent; color:#f1f5f9; border:1px solid #475569; padding:8px 20px; border-radius:6px; font-weight:bold; cursor:pointer;">Schedule</button>
          <button class="edit-btn" style="background:transparent; color:#f1f5f9; border:1px solid #475569; padding:8px 20px; border-radius:6px; font-weight:bold; cursor:pointer;" onclick="this.parentElement.previousElementSibling.focus()">Edit</button>`;

content = content.replace(htmlToReplace, newHtml);
fs.writeFileSync('C:/Users/theem/OneDrive/Documents/Factory AI.02.20.26/Social Imperialism/apps/desktop/dashboard.html', content, 'utf8');
console.log('Added Edit button');
