const fs = require('fs');
let html = fs.readFileSync('content-hub.html', 'utf8');

// 1. Add RSS Tab to HTML Tabs list
html = html.replace(/<div class="tab" onclick="switchTab\('analytics'\)"><i class="fas fa-chart-line"><\/i> Post Analytics<\/div>/, '<div class="tab" onclick="switchTab(\'analytics\')"><i class="fas fa-chart-line"></i> Post Analytics</div>\n      <div class="tab" onclick="switchTab(\'rss\')"><i class="fas fa-rss"></i> RSS & Curated Feeds</div>');

// 2. Add RSS Tab Content
const rssTabHtml = `
    <!-- RSS TAB -->
    <div id="rss-tab" class="tab-content">
      <div style="background: rgba(15, 23, 42, 0.5); padding: 1.5rem; border-radius: 8px; border: 1px solid #334155;">
        <h3 class="section-title"><i class="fas fa-rss"></i> RSS-Based Content Automation</h3>
        <p style="color: #94a3b8; font-size: 0.9rem; margin-bottom: 1rem;">Connect RSS feeds from your blog, affiliate sites, or industry news. The scheduler will watch for new items, summarize them via AI, and automatically create formatted posts.</p>
        
        <div style="display:flex; gap: 0.5rem; margin-bottom: 1.5rem;">
          <input type="url" class="input-field" id="rssUrlInput" style="margin-bottom:0;" placeholder="https://yourblog.com/feed">
          <button class="primary-btn" onclick="addRssFeed()"><i class="fas fa-plus"></i> Add Feed</button>
        </div>

        <div id="rssFeedsList" style="display: flex; flex-direction: column; gap: 1rem; margin-bottom: 2rem;">
            <!-- Feeds populate here -->
            <div style="background: rgba(2, 6, 23, 0.5); border: 1px solid #475569; border-radius: 8px; padding: 1rem;">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 0.5rem;">
                    <div style="color: #f8fafc; font-weight: bold;"><i class="fas fa-link" style="color: #f97316; margin-right: 5px;"></i> https://techcrunch.com/feed/</div>
                    <button class="secondary-btn" style="padding: 0.2rem 0.5rem; font-size: 0.75rem; color: #ef4444; border-color: rgba(239, 68, 68, 0.3);"><i class="fas fa-trash"></i></button>
                </div>
                <div style="display:flex; gap: 1.5rem; align-items: center;">
                    <label style="color: #cbd5e1; font-size: 0.85rem;"><input type="checkbox" checked style="margin-right: 5px;"> Auto-Post (Bypass Review)</label>
                    <select style="background: #0f172a; border: 1px solid #475569; color: #f8fafc; padding: 0.2rem; border-radius: 4px; font-size: 0.8rem;">
                        <option>Format for Twitter (Short + Hashtags)</option>
                        <option>Format for LinkedIn (Detailed + Professional)</option>
                        <option>Format for Facebook Fanpage</option>
                    </select>
                </div>
            </div>
        </div>
      </div>
    </div>
`;

// Insert the RSS tab content before the analytics tab or after repurpose tab
html = html.replace(/(<div id="analytics-tab" class="tab-content">)/, rssTabHtml + '\n    $1');

// 3. Add Auto-Content Creation buttons to Standard Tab
const newToolsHtml = `
        <button class="tool-btn generate" id="btn-gen-image" onclick="window.social_api.genImage()"><i class="fas fa-paint-brush"></i> Generate Image</button>
        <button class="tool-btn generate" onclick="generateCarousel()"><i class="fas fa-layer-group"></i> AI Carousel</button>
        <button class="tool-btn generate" onclick="generateThumbnail()"><i class="fas fa-image"></i> AI Thumbnail</button>
        <button class="tool-btn generate" id="btn-stock-photo" onclick="window.social_api.stockPhoto()"><i class="fas fa-camera"></i> Stock Photo</button>
`;
html = html.replace(/<button class="tool-btn generate" id="btn-gen-image" onclick="window\.social_api\.genImage\(\)"><i class="fas fa-paint-brush"><\/i> Generate Image<\/button>\s*<button class="tool-btn generate" id="btn-stock-photo"/, newToolsHtml.trim() + '\n        <button class="tool-btn generate" id="btn-stock-photo"');

// 4. Add the Javascript for the new buttons
const newJs = `
function generateCarousel() {
    const text = document.getElementById('postContent').value;
    if(!text) return alert("Write some draft text first so the AI knows what the carousel is about.");
    alert("Simulated: FAL API generating a multi-image carousel based on the post text...");
}

function generateThumbnail() {
    const text = document.getElementById('postContent').value;
    if(!text) return alert("Write some draft text first.");
    alert("Simulated: FAL API generating a high-converting YouTube/Blog thumbnail...");
}

function addRssFeed() {
    const url = document.getElementById('rssUrlInput').value;
    if(!url) return alert('Enter an RSS URL');
    alert('Simulated: Connected RSS feed ' + url + '. Scheduler will now monitor this feed.');
    document.getElementById('rssUrlInput').value = '';
}
`;

html = html.replace(/window\.switchTab = function/, newJs + '\n\nwindow.switchTab = function');

fs.writeFileSync('content-hub.html', html, 'utf8');
console.log('Added RSS Feed and Carousel/Thumbnail Generation to Content Hub.');