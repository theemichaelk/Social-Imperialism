const fs = require('fs');
let html = fs.readFileSync('dashboard.html', 'utf8');

// 1. Unanswered Questions Tracker Additions
// I need to add custom thresholds (views/time) and notification frequency dropdowns to the Unanswered Tracker.

const trackerHeaderMatch = /<p style="color: #94a3b8; font-size: 0.85rem; margin: 4px 0 0 0;">High-view industry questions with zero brand replies. Perfect for lead generation\.<\/p>\s*<\/div>/;

const newTrackerSettings = `
        <p style="color: #94a3b8; font-size: 0.85rem; margin: 4px 0 0 0;">High-view industry questions with zero brand replies. Perfect for lead generation.</p>
        
        <div style="display:flex; gap: 15px; margin-top: 15px; background: rgba(0,0,0,0.2); padding: 10px; border-radius: 8px;">
            <div>
                <label style="display:block; font-size: 0.75rem; color: #cbd5e1; margin-bottom:4px;">Min Views Threshold</label>
                <input type="number" id="qaMinViews" value="500" style="width: 80px; background: #0f172a; border: 1px solid #475569; color: #f8fafc; padding: 4px; border-radius: 4px; font-size: 0.8rem;">
            </div>
            <div>
                <label style="display:block; font-size: 0.75rem; color: #cbd5e1; margin-bottom:4px;">Min Time Unanswered</label>
                <select id="qaMinTime" style="background: #0f172a; border: 1px solid #475569; color: #f8fafc; padding: 4px; border-radius: 4px; font-size: 0.8rem;">
                    <option value="1h">1 Hour</option>
                    <option value="6h">6 Hours</option>
                    <option value="24h" selected>24 Hours</option>
                </select>
            </div>
            <div>
                <label style="display:block; font-size: 0.75rem; color: #cbd5e1; margin-bottom:4px;">Alert Frequency (Slack/Email)</label>
                <select id="qaAlertFreq" style="background: #0f172a; border: 1px solid #475569; color: #f8fafc; padding: 4px; border-radius: 4px; font-size: 0.8rem;">
                    <option value="hourly">Hourly Digest</option>
                    <option value="daily" selected>Daily Digest</option>
                    <option value="weekly">Weekly Digest</option>
                </select>
            </div>
        </div>
      </div>
`;

if (html.match(trackerHeaderMatch)) {
    html = html.replace(trackerHeaderMatch, newTrackerSettings);
}

// 2. Answer Composer Additions
// Enhance the reply modal to include Rich Text buttons and FAQ/RSS Source drop downs

const answerComposerRegex = /<textarea style="width: 100%; min-height: 80px; background: #0f172a; color: #f8fafc; border: 1px solid #475569; border-radius: 6px; padding: 8px; font-size: 0.9rem; margin-bottom: 8px;">\$\{reply\}<\/textarea>/;

const newComposerUI = `
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                        <div style="display: flex; gap: 8px;">
                            <button style="background:transparent; border:none; color:#94a3b8; cursor:pointer;" title="Bold"><i class="fas fa-bold"></i></button>
                            <button style="background:transparent; border:none; color:#94a3b8; cursor:pointer;" title="Italic"><i class="fas fa-italic"></i></button>
                            <button style="background:transparent; border:none; color:#94a3b8; cursor:pointer;" title="Add Link"><i class="fas fa-link"></i></button>
                            <button style="background:transparent; border:none; color:#94a3b8; cursor:pointer;" title="Add Image"><i class="fas fa-image"></i></button>
                        </div>
                        <select style="background: #0f172a; border: 1px solid #475569; color: #94a3b8; padding: 4px; border-radius: 4px; font-size: 0.75rem;">
                            <option>Use Knowledge Base: General FAQ</option>
                            <option>Use Knowledge Base: Recent Blogs (RSS)</option>
                        </select>
                    </div>
                    <textarea style="width: 100%; min-height: 120px; background: #0f172a; color: #f8fafc; border: 1px solid #475569; border-radius: 6px; padding: 12px; font-size: 0.9rem; margin-bottom: 8px; line-height: 1.5;">\$\{reply\}</textarea>
`;

if (html.match(answerComposerRegex)) {
    html = html.replace(answerComposerRegex, newComposerUI);
}

fs.writeFileSync('dashboard.html', html, 'utf8');
console.log('Successfully added Q&A requirements to dashboard.');