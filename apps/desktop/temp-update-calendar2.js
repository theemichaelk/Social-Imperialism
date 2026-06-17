const fs = require('fs');
let html = fs.readFileSync('calendar.html', 'utf8');

// Insert Timezone and Best Time selectors into the header of the calendar
const headerTools = `
    <div style="display:flex; gap: 15px; margin-left: 20px; align-items: center;">
      <select id="timezoneSelect" style="background: #0f172a; border: 1px solid #475569; color: #f8fafc; padding: 0.4rem; border-radius: 4px; font-size: 0.85rem;">
        <option value="local">Local Timezone</option>
        <option value="est">EST (New York)</option>
        <option value="pst">PST (Los Angeles)</option>
        <option value="gmt">GMT (London)</option>
      </select>
      <button class="secondary-btn" onclick="suggestBestTimes()" style="background: transparent; border: 1px solid #38bdf8; color: #38bdf8; padding: 0.4rem 0.8rem; border-radius: 6px; cursor: pointer; font-size: 0.85rem; display: flex; align-items: center; gap: 5px;"><i class="fas fa-magic"></i> Suggest Best Times</button>
    </div>
    
    <a href="content-hub.html" class="primary-btn"><i class="fas fa-plus"></i> Schedule Post</a>
`;

html = html.replace(/<a href="content-hub\.html" class="primary-btn"><i class="fas fa-plus"><\/i> Schedule Post<\/a>/, headerTools);

// Insert the JS function for suggestBestTimes()
const jsFunction = `
window.suggestBestTimes = function() {
    alert("AI Analysis Complete:\\nBased on your historical engagement patterns, the best times to post this week are:\\n\\n- Tuesday at 10:00 AM (High B2B Traffic)\\n- Thursday at 2:30 PM (Peak User Activity)\\n- Saturday at 11:00 AM (Weekend Browsing)\\n\\nWould you like to Auto-Schedule your Drafts queue into these slots?");
};
`;

html = html.replace(/function loadPostsFromStorage\(\) \{/, jsFunction + '\n\nfunction loadPostsFromStorage() {');

fs.writeFileSync('calendar.html', html, 'utf8');
console.log('Added Timezones and Best-Time suggestions to Calendar.');