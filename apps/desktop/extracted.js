async function loadFeed() {
  const container = document.getElementById('feed-container');
  try {
    // 1. Get stats
    const stats = await ipcRenderer.invoke('get-dashboard-stats');
    document.getElementById('stat-posts').innerText = stats.totalPosts;
    document.getElementById('aiDraftsCounter').innerText = stats.aiDrafts;
    document.getElementById('stat-engage').innerText = stats.totalEngagement;
    document.getElementById('stat-keys').innerText = stats.activeKeywords;

    // API Metrics Update
    if (stats.apiMetrics) {
        const apiPanel = document.getElementById('api-metrics-list');
        if (apiPanel) {
            apiPanel.innerHTML = Object.entries(stats.apiMetrics).sort().map(pair => {
                const k = pair[0];
                const v = pair[1];
                const color = v.includes('Connected') ? '#10b981' : '#ef4444';
                return '<div style="background: rgba(30, 41, 59, 0.5); padding: 10px 12px; border-radius: 4px; display:flex; justify-content:space-between; margin-bottom:4px; align-items:center;">'+
                       '<span style="color:#94a3b8; font-size:0.8rem; text-transform:uppercase;">' + k + '</span>'+
                       '<span style="font-size:0.8rem; color: ' + color + '">' + v + '</span>'+
                       '</div>';
            }).join('');
        }
    }

    // 2. Get posts (combining simulated discovery and user published)
    const filters = {
        platform: document.getElementById('feedPlatformFilter').value,
        language: document.getElementById('feedLanguageFilter').value,
        location: document.getElementById('feedLocationFilter').value,
        sort: document.getElementById('feedSortFilter').value
    };
    
    const simulatedDiscovery = await ipcRenderer.invoke('get-simulated-feed', filters);
    const userHistory = await ipcRenderer.invoke('get-all-post-history');
    
    // Map user history into standard feed format
    const formattedUserHistory = userHistory.map(post => {
      // Find platform from linked accounts
      let platformName = 'Hub';
      if (document.querySelectorAll('.account-card').length > 0) {
          const accounts = Array.from(document.querySelectorAll('.account-card')).map(card => ({ id: card.id, platform: card.querySelector('h4').innerText }));
          const acc = accounts.find(a => a.id === post.accountId);
          if (acc) platformName = acc.platform;
      }
      
      return {
        isHubPost: true,
        accountId: post.accountId,
        platform: platformName, 
        author: 'Your Account',
        time: new Date(post.timestamp).toLocaleTimeString(),
        matchScore: 100, // your own post is always 100% relevant
        content: post.hasMedia ? '[Media] ' + post.content : post.content
      };
    });

    // Interleave them
    let allPosts = [];
    let dIndex = 0, hIndex = 0;
    while(dIndex < simulatedDiscovery.length || hIndex < formattedUserHistory.length) {
      if (hIndex < formattedUserHistory.length) allPosts.push(formattedUserHistory[hIndex++]);
      if (dIndex < simulatedDiscovery.length) allPosts.push(simulatedDiscovery[dIndex++]);
    }
    
    // Add random engagement stats for filtering
    allPosts.forEach(p => {
        if (!p.stats) {
            p.stats = {
                likes: Math.floor(Math.random() * 50) + 1,
                comments: Math.floor(Math.random() * 20),
                views: Math.floor(Math.random() * 500) + 50
            };
        }
    });
    
    // Filter posts
    const platformFilter = document.getElementById('feedPlatformFilter').value;
    const minEngageFilter = parseInt(document.getElementById('feedMinEngageFilter').value) || 0;
    const minFollowers = parseInt(document.getElementById('feedMinFollowers').value) || 0;
    const postTypeFilter = document.getElementById('feedPostTypeFilter').value;
    const mediaFilter = document.getElementById('feedMediaFilter').value;
    const excludeWordsRaw = document.getElementById('feedExcludeWords').value.toLowerCase().split(',').map(s => s.trim()).filter(s => s !== '');
    
    allPosts = allPosts.filter(p => {
        // If an account is selected, ONLY show posts from that account's platform
        if (currentAccountPlatform) {
            if (p.isHubPost) {
                return p.accountId === currentAccountId;
            } else {
                return p.platform === currentAccountPlatform;
            }
        }
        
        // Check Platform Filter
        let passesPlatform = platformFilter === 'All' ? true : (p.platform.includes(platformFilter) || (p.isHubPost && p.platform.includes(platformFilter)));
        
        // Check Engagement Filter
        let passesEngagement = (p.stats.likes >= minEngageFilter);
        
        // Check Follower Filter (mock data)
        let passesFollowers = true;
        if (minFollowers > 0) passesFollowers = (Math.random() * 5000 + 100) >= minFollowers;
        
        // Check Exclude Words
        let passesExclude = true;
        if (excludeWordsRaw.length > 0) {
            const lowerContent = p.content.toLowerCase();
            passesExclude = !excludeWordsRaw.some(word => lowerContent.includes(word));
        }
        
        // Check Media
        let passesMedia = true;
        if (mediaFilter === 'media') passesMedia = p.content.includes('[Media]');
        if (mediaFilter === 'text') passesMedia = !p.content.includes('[Media]');
        
        // Check Post Type Filter (Heuristic approach since simulated)
        let passesPostType = true;
        if (postTypeFilter === 'question') {
            passesPostType = p.content.includes('?');
        } else if (postTypeFilter === 'complaint') {
            passesPostType = p.content.toLowerCase().includes('hate') || p.content.toLowerCase().includes('annoying') || p.content.toLowerCase().includes('sucks') || p.content.toLowerCase().includes('issue') || p.content.toLowerCase().includes('broken');
        } else if (postTypeFilter === 'praise') {
            passesPostType = p.content.toLowerCase().includes('love') || p.content.toLowerCase().includes('great') || p.content.toLowerCase().includes('awesome') || p.content.toLowerCase().includes('amazing') || p.content.toLowerCase().includes('best');
        }
        
        return passesPlatform && passesEngagement && passesPostType && passesExclude && passesFollowers && passesMedia;
    });

    container.innerHTML = ''; // clear loading
    
    // Update Deep Engagement Panel
    const deepPanel = document.getElementById('deep-engagement-panel');
    const tagsContainer = document.getElementById('deepEngagementTags');
    
    if (platformFilter === 'Facebook') {
        deepPanel.style.display = 'block';
        tagsContainer.innerHTML = `
            <span style="background: rgba(24, 119, 242, 0.2); color: #60a5fa; padding: 4px 10px; border-radius: 12px; font-size: 0.8rem; cursor: pointer; border: 1px solid #1877F2;">#SaaS Founders Group</span>
            <span style="background: rgba(24, 119, 242, 0.2); color: #60a5fa; padding: 4px 10px; border-radius: 12px; font-size: 0.8rem; cursor: pointer; border: 1px solid #1877F2;">#Digital Marketing Pros</span>
            <span style="background: rgba(24, 119, 242, 0.2); color: #60a5fa; padding: 4px 10px; border-radius: 12px; font-size: 0.8rem; cursor: pointer; border: 1px solid #1877F2;">#Startup Grind</span>
        `;
    } else if (platformFilter === 'Reddit') {
        deepPanel.style.display = 'block';
        tagsContainer.innerHTML = `
            <span style="background: rgba(255, 69, 0, 0.2); color: #fca5a5; padding: 4px 10px; border-radius: 12px; font-size: 0.8rem; cursor: pointer; border: 1px solid #FF4500;">r/SaaS</span>
            <span style="background: rgba(255, 69, 0, 0.2); color: #fca5a5; padding: 4px 10px; border-radius: 12px; font-size: 0.8rem; cursor: pointer; border: 1px solid #FF4500;">r/Entrepreneur</span>
            <span style="background: rgba(255, 69, 0, 0.2); color: #fca5a5; padding: 4px 10px; border-radius: 12px; font-size: 0.8rem; cursor: pointer; border: 1px solid #FF4500;">r/Marketing</span>
        `;
    } else if (platformFilter === 'Quora') {
        deepPanel.style.display = 'block';
        tagsContainer.innerHTML = `
            <span style="background: rgba(185, 43, 39, 0.2); color: #fca5a5; padding: 4px 10px; border-radius: 12px; font-size: 0.8rem; cursor: pointer; border: 1px solid #B92B27;">B2B Marketing Space</span>
            <span style="background: rgba(185, 43, 39, 0.2); color: #fca5a5; padding: 4px 10px; border-radius: 12px; font-size: 0.8rem; cursor: pointer; border: 1px solid #B92B27;">Startup Growth Hacks</span>
            <span style="background: rgba(185, 43, 39, 0.2); color: #fca5a5; padding: 4px 10px; border-radius: 12px; font-size: 0.8rem; cursor: pointer; border: 1px solid #B92B27;">AI Software Space</span>
        `;
    } else if (platformFilter === 'Twitter') {
        deepPanel.style.display = 'block';
        tagsContainer.innerHTML = `
            <span style="background: rgba(255, 255, 255, 0.2); color: #cbd5e1; padding: 4px 10px; border-radius: 12px; font-size: 0.8rem; cursor: pointer; border: 1px solid #fff;">#TechTwitter</span>
            <span style="background: rgba(255, 255, 255, 0.2); color: #cbd5e1; padding: 4px 10px; border-radius: 12px; font-size: 0.8rem; cursor: pointer; border: 1px solid #fff;">#BuildInPublic</span>
            <span style="background: rgba(255, 255, 255, 0.2); color: #cbd5e1; padding: 4px 10px; border-radius: 12px; font-size: 0.8rem; cursor: pointer; border: 1px solid #fff;">#MarketingTwitter</span>
        `;
    } else {
        deepPanel.style.display = 'none';
    }

    if (allPosts.length === 0) {
        container.innerHTML = `<div style="padding: 2rem; text-align: center; color: #94a3b8;">No activity found for this filter.</div>`;
    }

    // Load initial trending topics
    loadTrendingTopics();

    ipcRenderer.invoke('get-live-news', 'technology').then(news => {
      const nDiv = document.getElementById('live-news');
      if (news.error) {
        nDiv.innerHTML = '<span style="color:#ef4444">News Feed Offline: ' + news.error + '</span>';
      } else if (news.articles && news.articles.length > 0) {
        let htmlStr = '<ul style="list-style:none; padding:0; margin:0; display:flex; flex-direction:column; gap:12px;">';
        const shuffled = news.articles.sort(() => 0.5 - Math.random());
        const selected = shuffled.slice(0, 4);
        selected.forEach(article => {
          htmlStr += '<li style="border-bottom: 1px solid rgba(51, 65, 85, 0.5); padding-bottom: 8px;">' +
            '<a href="# " onclick="require(\'electron\').shell.openExternal(\'' + article.url + '\'); return false;" style="color:#38bdf8; text-decoration:none; font-weight:bold; font-size:0.95rem; transition:color 0.2s; display:block; margin-bottom:4px;">' + article.title + '</a>' +
          '</li>';
        });
        htmlStr += '</ul>';
        nDiv.innerHTML = htmlStr;
      } else {
        nDiv.innerHTML = 'No trending news found.';
      }
    });\n\n    allPosts.forEach(post => {
      const div = document.createElement('div');
      div.className = 'post-item';
      
      let badges = `<span class="platform-badge">${post.platform}</span>`;
      if (post.isHubPost) {
        badges += ` <span style="background: rgba(16, 185, 129, 0.2); color: #10b981; padding: 2px 6px; border-radius: 4px; font-size: 0.7rem; margin-left: 5px;">Published by You</span>`;
      }
      
      let kwBadge = '';
      if (post.matchedKeyword) {
          kwBadge = `<span style="background: rgba(139, 92, 246, 0.2); color: #a78bfa; border: 1px solid #8b5cf6; padding: 2px 6px; border-radius: 4px; font-size: 0.7rem; margin-left: 5px;">Keyword: ${post.matchedKeyword}</span>`;
      }
      
      let actionButtons = '';
      if (!post.isHubPost) {
        actionButtons = `
          <button class="ai-reply" data-keyword="${post.matchedKeyword || ''}" data-platform="${post.platform}">Draft AI Reply</button>
          <button class="engage-like" style="background:transparent; color:#f8fafc; border:1px solid #475569;" data-platform="${post.platform}">Like</button>
          <button class="engage-share" style="background:transparent; color:#f8fafc; border:1px solid #475569;" data-platform="${post.platform}">Share</button>
          <button class="view">View Original</button>
        `;
      } else {
         actionButtons = `<button class="view" style="color: #10b981; border-color: #10b981;">View Performance</button>`;
      }

      div.innerHTML = `
        <div class="post-meta" style="display:flex; justify-content:space-between; align-items:center;">
          <span>${badges}${kwBadge} &bull; ${post.author}</span>
          <span>${post.time} &bull; <span style="color:#10b981;">${post.matchScore}% Match</span></span>
        </div>
        <div class="post-content">
          ${post.content}
        </div>
        <div style="font-size:0.8rem; color:#94a3b8; margin-top:0.5rem; margin-bottom:1rem; display:flex; gap:15px;">
            <span><i style="opacity:0.7;">👍</i> ${post.stats.likes} Likes</span>
            <span><i style="opacity:0.7;">💬</i> ${post.stats.comments} Comments</span>
            <span><i style="opacity:0.7;">👁️</i> ${post.stats.views} Views</span>
        </div>
        <div class="post-actions" style="display: flex; gap: 0.5rem;">
          ${actionButtons}
        </div>
        <div class="ai-response-area" style="display:none; margin-top:1.5rem; padding:1.5rem; border-radius:8px;"></div>
      `;
      container.appendChild(div);
      
      if (!post.isHubPost) {
        attachReplyListener(div.querySelector('.ai-reply'));
        attachEngageListener(div.querySelector('.engage-like'), 'like');
        attachEngageListener(div.querySelector('.engage-share'), 'share');
      }
    });
  } catch(e) {
    container.innerHTML = '<div style="padding: 2rem; color: #ef4444;">Failed to load feed.</div>';
  }
}

// Add to global scope
let isScanningUnanswered = false;

document.getElementById('refreshQuestionsBtn').addEventListener('click', async (e) => {
    if (isScanningUnanswered) return;
    isScanningUnanswered = true;
    e.target.innerText = "Scanning...";
    e.target.style.opacity = 0.5;
    
    const container = document.getElementById('unanswered-questions-list');
    container.innerHTML = '<div style="text-align: center; color: #a78bfa; padding: 1rem;">Scanning social platforms for high-value unanswered questions...</div>';
    
    try {
        const questions = await ipcRenderer.invoke('get-unanswered-questions');
        container.innerHTML = '';
        
        if (!questions || questions.length === 0) {
            container.innerHTML = '<div style="text-align: center; color: #64748b; padding: 1rem;">No new unanswered questions found right now.</div>';
            return;
        }
        
        questions.forEach(q => {
            const div = document.createElement('div');
            div.style.background = 'rgba(15, 23, 42, 0.8)';
            div.style.border = '1px solid #334155';
            div.style.borderRadius = '8px';
            div.style.padding = '1rem';
            div.innerHTML = `
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
                    <span style="background: rgba(139, 92, 246, 0.2); color: #c084fc; padding: 2px 8px; border-radius: 4px; font-size: 0.75rem; font-weight: bold;">${q.platform}</span>
                    <span style="color: #f59e0b; font-size: 0.8rem; font-weight: bold;">👁️ ${q.views.toLocaleString()} Views &nbsp;|&nbsp; ⏱️ ${q.timeElapsed} old</span>
                </div>
                <div style="color: #e2e8f0; font-size: 0.95rem; margin-bottom: 1rem; line-height: 1.4;">"${q.content}"</div>
                <div style="display: flex; gap: 0.5rem;">
                    <button class="secondary ai-reply-q" style="flex: 1; border-color: #a78bfa; color: #a78bfa; font-size: 0.85rem;">Draft AI Answer</button>
                    <button class="secondary" style="font-size: 0.85rem;">Dismiss</button>
                </div>
                <div class="q-response-area" style="display:none; margin-top:1rem;"></div>
            `;
            container.appendChild(div);
            
            // Attach Answer Logic
            const replyBtn = div.querySelector('.ai-reply-q');
            replyBtn.addEventListener('click', async (ev) => {
                const responseArea = div.querySelector('.q-response-area');
                ev.target.innerText = 'Drafting Answer...';
                responseArea.style.display = 'block';
                responseArea.innerHTML = `<div style="color: #a78bfa; font-size: 0.85rem; padding: 10px;">Generating high-value answer...</div>`;
                
                const reply = await ipcRenderer.invoke('draft-post-reply', {
                    postContent: q.content,
                    matchedKeyword: '',
                    oneTimeOverride: 'Provide a highly detailed, helpful, authoritative answer that establishes the brand as an expert, leading naturally into the brand value proposition.'
                });
                
                responseArea.innerHTML = `
                    <textarea style="width: 100%; min-height: 80px; background: #0f172a; color: #f8fafc; border: 1px solid #475569; border-radius: 6px; padding: 8px; font-size: 0.9rem; margin-bottom: 8px;">${reply}</textarea>
                    <button style="background: #8b5cf6; color: white; border: none; padding: 6px 12px; border-radius: 4px; font-weight: bold; cursor: pointer; width: 100%;">Publish Answer</button>
                `;
            });
        });
        
    } catch(err) {
        container.innerHTML = `<div style="text-align: center; color: #ef4444; padding: 1rem;">Failed to fetch questions.</div>`;
    } finally {
        isScanningUnanswered = false;
        e.target.innerText = "Scan Now";
        e.target.style.opacity = 1;
    }
});

// FAL Image Generation hook
document.getElementById('generateImageBtn').addEventListener('click', async (e) => {
    const postContent = document.getElementById('postContent').value;
    if(!postContent || postContent.trim() === '') {
        alert("Please draft some post content first. The AI needs context to generate the image.");
        return;
    }
    
    e.target.innerText = "🎨 Generating...";
    e.target.disabled = true;
    
    const promptInstructions = `A highly professional social media post image based on this content: "${postContent.substring(0, 100)}". Futuristic, clean, hyper-realistic, 8k resolution.`;
    
    const result = await ipcRenderer.invoke('generate-image', promptInstructions);
    
    if (result.error) {
        alert(result.error);
        e.target.innerText = "🎨 Generate Image";
        e.target.disabled = false;
        return;
    }
    
    document.getElementById('aiGeneratedImageBox').style.display = 'block';
    document.getElementById('generatedImagePreview').src = result.imageUrl;
    
    e.target.innerText = "🎨 Generate Image";
    e.target.disabled = false;
});

document.getElementById('removeImageBtn').addEventListener('click', () => {
    document.getElementById('aiGeneratedImageBox').style.display = 'none';
    document.getElementById('generatedImagePreview').src = '';
});

// Pexels/Flickr Search hook
document.getElementById('searchStockBtn').addEventListener('click', async (e) => {
    const postContent = document.getElementById('postContent').value;
    if(!postContent || postContent.trim() === '') {
        alert("Please draft some post content first. The system needs context to search for the right stock photo.");
        return;
    }
    
    e.target.innerText = "📸 Searching...";
    e.target.disabled = true;
    
    // Extract a search term from the first few words of the post content
    const query = postContent.split(' ').slice(0, 3).join(' ').replace(/[^a-zA-Z0-9 ]/g, '');
    
    const result = await ipcRenderer.invoke('search-stock-photo', query);
    
    if (result.error) {
        alert(result.error);
        e.target.innerText = "📸 Stock Photo";
        e.target.disabled = false;
        return;
    }
    
    document.getElementById('aiGeneratedImageBox').style.display = 'block';
    document.getElementById('generatedImagePreview').src = result.imageUrl;
    
    // Add a small credit badge for the stock source
    let sourceBadge = document.getElementById('stockSourceBadge');
    if (!sourceBadge) {
        sourceBadge = document.createElement('div');
        sourceBadge.id = 'stockSourceBadge';
        sourceBadge.style.cssText = 'position: absolute; bottom: 10px; right: 10px; background: rgba(0,0,0,0.6); color: #fff; padding: 2px 8px; border-radius: 4px; font-size: 0.7rem;';
        document.getElementById('aiGeneratedImageBox').appendChild(sourceBadge);
    }
    sourceBadge.innerText = 'Photo by ' + result.source;
    
    e.target.innerText = "📸 Stock Photo";
    e.target.disabled = false;
});

function attachReplyListener(button) {
  button.addEventListener('click', async (e) => {
    const postItem = e.target.closest('.post-item');
    const content = postItem.querySelector('.post-content').innerText.trim();
    const responseArea = postItem.querySelector('.ai-response-area');
    
    // Get the brand name dynamically
    let brandName = "AI";
    try {
      const activeCampaign = await ipcRenderer.invoke('get-active-campaign');
      if (activeCampaign && activeCampaign.brandName) {
        brandName = activeCampaign.brandName;
      }
    } catch(err) {}

    e.target.innerText = 'Neural Net Active...';
    e.target.disabled = true;
    e.target.style.opacity = '0.7';
    responseArea.style.display = 'block';
    
    // Check if user wants to supply a one-time prompt override for this specific post
    const oneTimePrompt = prompt("AI REPLY ENGINE: Provide custom instructions for this reply.\n\nYou can override the base prompt for:\n1. This specific post\n2. This specific keyword\n3. The entire project tone\n\nExample: 'Focus on explaining our free trial and avoid hard selling.' Leave blank to use defaults.");
    
    responseArea.innerHTML = `<i>Social Imperialism is Thinking...</i>`;
    
    try {
      const matchedKw = e.target.getAttribute('data-keyword') || '';
      const reply = await ipcRenderer.invoke('draft-post-reply', {
          postContent: content,
          matchedKeyword: matchedKw,
          oneTimeOverride: oneTimePrompt
      });
      
      // Update Counter visually
      const counter = document.getElementById('aiDraftsCounter');
      counter.innerText = parseInt(counter.innerText) + 1;
      
      // Add Send buttons when reply is generated
      responseArea.innerHTML = `
        <div style="margin-bottom: 0.5rem; color:#38bdf8; font-weight:bold; font-size:0.85rem; text-transform:uppercase; letter-spacing:1px;">AI Generated Draft</div>
        <textarea class="edit-reply-box" style="width: 100%; min-height: 100px; background: rgba(15,23,42,0.8); color: #f8fafc; border: 1px solid #475569; border-radius: 6px; padding: 10px; font-family: inherit; font-size: 1rem; margin: 15px 0;">${reply}</textarea>
        <div style="display: flex; gap: 10px; margin-top: 10px;">
          <button class="send-reply" style="background:#10b981; color:white; border:none; padding:8px 20px; border-radius:6px; font-weight:bold; cursor:pointer; box-shadow: 0 0 10px rgba(16,185,129,0.3);">Post Now</button>
          <button class="schedule-reply" style="background:transparent; color:#f1f5f9; border:1px solid #475569; padding:8px 20px; border-radius:6px; font-weight:bold; cursor:pointer;">Schedule</button>
          <button class="regen-reply" style="background:transparent; color:#38bdf8; border:1px solid #38bdf8; padding:8px 20px; border-radius:6px; font-weight:bold; cursor:pointer; margin-left: auto;">Regenerate</button>
        </div>
      `;

      // Make the Send button actually do something
      responseArea.querySelector('.send-reply').addEventListener('click', async (ev) => {
        ev.target.innerText = 'Transmitting...';
        
        try {
          const finalReply = responseArea.querySelector('.edit-reply-box').value;
          
          // Increment Draft Counter
          await ipcRenderer.invoke('increment-ai-drafts');
          
          // Save Reply to History
          const platformName = postItem.querySelector('.platform-badge').innerText;
          await ipcRenderer.invoke('save-ai-reply', {
            originalPost: content,
            replyContent: finalReply,
            platform: platformName,
            status: 'Published'
          });
          
          ev.target.innerText = 'Transmission Complete';
          ev.target.style.background = 'rgba(16, 185, 129, 0.2)';
          ev.target.style.color = '#34d399';
          ev.target.style.border = '1px solid #10b981';
          ev.target.style.boxShadow = 'none';
          
          setTimeout(() => {
            postItem.style.opacity = '0.5';
            setTimeout(() => postItem.remove(), 500);
          }, 1500);
        } catch(e) {
          alert('Failed to save reply: ' + e.message);
        }
      });
      
      responseArea.querySelector('.schedule-reply').addEventListener('click', () => {
         alert("Scheduling interface will open here. For now, it requires the background worker chron job to be active.");
      });
      
      responseArea.querySelector('.regen-reply').addEventListener('click', () => {
         e.target.click(); // Trigger the whole drafting process again
      });

    } catch (err) {
      responseArea.innerHTML = '<span style="color:#ef4444">System Error: ' + err.message + '</span>';
    }
    
    e.target.innerText = 'Draft AI Reply';
    e.target.disabled = false;
    e.target.style.opacity = '1';
  });
}

function attachEngageListener(button, actionType) {
  if(!button) return;
  button.addEventListener('click', async (e) => {
    const postItem = e.target.closest('.post-item');
    const content = postItem.querySelector('.post-content').innerText.trim();
    const platform = e.target.getAttribute('data-platform');
    
    e.target.innerText = 'Engaging...';
    e.target.disabled = true;
    
    try {
      await ipcRenderer.invoke('engage-post', {
          action: actionType,
          platform: platform,
          postContent: content
      });
      
      e.target.innerText = actionType === 'like' ? 'Liked' : 'Shared';
      e.target.style.color = '#10b981';
      e.target.style.borderColor = '#10b981';
      e.target.style.background = 'rgba(16, 185, 129, 0.1)';
    } catch(err) {
      e.target.innerText = 'Error';
      e.target.style.color = '#ef4444';
      e.target.style.borderColor = '#ef4444';
      alert('Engagement failed: ' + err.message);
    }
  });
}

