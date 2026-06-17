const fs = require('fs');
const path = require('path');
const filePath = path.join(__dirname, 'apps/desktop/dashboard.html');
let content = fs.readFileSync(filePath, 'utf8');

const badRegex = /htmlStr \+= '<\/ul>';\s*nDiv\.innerHTML = htmlStr;\s*\} else \{\s*nDiv\.innerHTML = 'No trending news found\.';\s*\}\s*\}\);\\n\\n\s*window\.currentFeedPosts/g;
if (badRegex.test(content)) {
    content = content.replace(badRegex, "window.currentFeedPosts");
}

const badRegex2 = /htmlStr \+= '<\/ul>';\s*nDiv\.innerHTML = htmlStr;\s*\} else \{\s*nDiv\.innerHTML = 'No trending news found\.';\s*\}\s*\}\);\s*window\.currentFeedPosts/g;
if (badRegex2.test(content)) {
    content = content.replace(badRegex2, "window.currentFeedPosts");
}

// Clean up another variant just in case
const badRegex3 = /\}\);\s*\}\);\s*window\.currentFeedPosts/g;
if (badRegex3.test(content)) {
    content = content.replace(badRegex3, "});\n    window.currentFeedPosts");
}

const badRegex4 = /\}\);\s*\}\);\\n\\n\s*window\.currentFeedPosts/g;
if (badRegex4.test(content)) {
    content = content.replace(badRegex4, "});\n    window.currentFeedPosts");
}

const renderFunc = `
function renderFeedPage() {
    const container = document.getElementById('feed-container');
    if (!container) return;
    if (window.currentFeedPage === 1) container.innerHTML = '';
    
    const start = (window.currentFeedPage - 1) * window.postsPerPage;
    const end = start + window.postsPerPage;
    const postsToShow = window.currentFeedPosts.slice(start, end);
    
    if (postsToShow.length === 0 && window.currentFeedPage === 1) {
        container.innerHTML = '<div style="padding: 2rem; text-align: center; color: #94a3b8;">No activity found for this filter.</div>';
        return;
    }

    postsToShow.forEach(post => {
      const div = document.createElement('div');
      div.className = 'post-item';
      
      let badges = \`<span class="platform-badge">\${post.platform}</span>\`;
      if (post.isHubPost) {
        badges += \` <span style="background: rgba(16, 185, 129, 0.2); color: #10b981; padding: 2px 6px; border-radius: 4px; font-size: 0.7rem; margin-left: 5px;">Published by You</span>\`;
      }
      
      let kwBadge = '';
      if (post.matchedKeyword) {
          kwBadge = \`<span style="background: rgba(139, 92, 246, 0.2); color: #a78bfa; border: 1px solid #8b5cf6; padding: 2px 6px; border-radius: 4px; font-size: 0.7rem; margin-left: 5px;">Keyword: \${post.matchedKeyword}</span>\`;
      }
      
      let actionButtons = '';
      if (!post.isHubPost) {
        actionButtons = \`
          <button class="ai-reply" data-keyword="\${post.matchedKeyword || ''}" data-platform="\${post.platform}">Draft AI Reply</button>
          <button class="engage-like" style="background:transparent; color:#f8fafc; border:1px solid #475569;" data-platform="\${post.platform}">Like</button>
          <button class="engage-share" style="background:transparent; color:#f8fafc; border:1px solid #475569;" data-platform="\${post.platform}">Share</button>
          <button class="view" onclick="window.open('https://' + '\${post.platform}'.toLowerCase() + '.com/search?q=' + encodeURIComponent('\${post.content}'.substring(0, 20)), '_blank')">View Original</button>
        \`;
      } else {
         actionButtons = \`<button class="view" style="color: #10b981; border-color: #10b981;">View Performance</button>\`;
      }

      div.innerHTML = \`
        <div class="post-meta" style="display:flex; justify-content:space-between; align-items:center;">
          <span>\${badges}\${kwBadge} &bull; \${post.author}</span>
          <span>\${post.time} &bull; <span style="color:#10b981;">\${post.matchScore}% Match</span></span>
        </div>
        <div class="post-content">
          \${post.content}
        </div>
        <div style="font-size:0.8rem; color:#94a3b8; margin-top:0.5rem; margin-bottom:1rem; display:flex; gap:15px;">
            <span><i style="opacity:0.7;">👍</i> \${post.stats.likes} Likes</span>
            <span><i style="opacity:0.7;">💬</i> \${post.stats.comments} Comments</span>
            <span><i style="opacity:0.7;">👁️</i> \${post.stats.views} Views</span>
        </div>
        <div class="post-actions" style="display: flex; gap: 0.5rem;">
          \${actionButtons}
        </div>
        <div class="ai-response-area" style="display:none; margin-top:1.5rem; padding:1.5rem; border-radius:8px;"></div>
      \`;
      container.appendChild(div);
      
      if (!post.isHubPost) {
        if(typeof attachReplyListener === 'function') attachReplyListener(div.querySelector('.ai-reply'));
        if(typeof attachEngageListener === 'function') {
           attachEngageListener(div.querySelector('.engage-like'), 'like');
           attachEngageListener(div.querySelector('.engage-share'), 'share');
        }
      }
    });

    const oldBtn = document.getElementById('loadMoreBtn');
    if (oldBtn) oldBtn.remove();

    if (end < window.currentFeedPosts.length) {
        const loadMoreBtn = document.createElement('button');
        loadMoreBtn.id = 'loadMoreBtn';
        loadMoreBtn.className = 'secondary';
        loadMoreBtn.style.cssText = 'width: 100%; margin-top: 1.5rem; border-color: #38bdf8; color: #38bdf8;';
        loadMoreBtn.innerText = 'Load More Posts...';
        loadMoreBtn.onclick = () => {
            window.currentFeedPage++;
            renderFeedPage();
        };
        container.appendChild(loadMoreBtn);
    }
}
`;

if (!content.includes('function renderFeedPage()')) {
    content += '\n\n<script>\n' + renderFunc + '\n</script>\n';
}

fs.writeFileSync(filePath, content, 'utf8');
console.log('dashboard fixed');
