const fs = require('fs');
let html = fs.readFileSync('content-hub.html', 'utf8');

// The issue might be that the buttons are not wired up to the JS functions correctly or the JS functions are outside the DOMContentLoaded scope / conflicting.
// Let's rewrite the button listeners to be inline inline onclick handlers for bulletproof reliability in Electron.

const htmlReplacements = [
    { old: 'id="enhanceBtn"', new: 'id="enhanceBtn" onclick="enhanceText()"' },
    { old: 'id="stockPhotoBtn"', new: 'id="stockPhotoBtn" onclick="getStockPhoto()"' },
    { old: 'id="genImageBtn"', new: 'id="genImageBtn" onclick="generateFalImage()"' },
    { old: 'id="publishBtn"', new: 'id="publishBtn" onclick="publishStandardPost()"' }
];

htmlReplacements.forEach(r => {
    html = html.replace(r.old, r.new);
});

// Now we need to define these functions globally so they can be called by onclick
const newJsFunctions = `
window.enhanceText = async function() {
    const text = document.getElementById('postContent').value;
    if(!text) return alert("Write some draft text first!");
    
    document.getElementById('postContent').value = "Enhancing with AI...";
    try {
      const enhanced = await ipcRenderer.invoke('generate-ai', "Rewrite and enhance this social media post draft to be highly engaging, adding relevant emojis and hashtags. Here is the draft: " + text);
      document.getElementById('postContent').value = enhanced;
    } catch(e) {
      alert("Failed to enhance: " + e.message);
      document.getElementById('postContent').value = text;
    }
};

window.getStockPhoto = async function() {
    const query = prompt("Enter a search term for a stock photo:");
    if(!query) return;
    
    document.getElementById('mediaUrl').value = "Searching Pexels...";
    
    try {
        const res = await ipcRenderer.invoke('search-stock-photo', query);
        if(res && res.success) {
            document.getElementById('mediaUrl').value = res.imageUrl;
            alert("Stock photo attached from " + res.source + "!");
        } else {
            document.getElementById('mediaUrl').value = "";
            alert(res.error || "Failed to find image");
        }
    } catch(e) {
        document.getElementById('mediaUrl').value = "";
        alert("Search failed: " + e.message);
    }
};

window.generateFalImage = async function() {
    const query = prompt("Describe the image you want AI to generate:");
    if(!query) return;
    
    document.getElementById('mediaUrl').value = "Generating via FAL AI...";
    
    try {
        const res = await ipcRenderer.invoke('generate-image', query);
        if(res && res.success) {
            document.getElementById('mediaUrl').value = res.imageUrl;
            alert("AI Image generated and attached!");
        } else {
            document.getElementById('mediaUrl').value = "";
            alert(res.error || "Failed to generate image");
        }
    } catch(e) {
        document.getElementById('mediaUrl').value = "";
        alert("Generation failed: " + e.message);
    }
};

window.publishStandardPost = async function() {
  const selectEl = document.getElementById('accountSelect');
  const selectedOption = selectEl.options[selectEl.selectedIndex];
  if(!selectedOption || !selectedOption.value) return alert('Select an account first.');
  
  const accountId = selectedOption.value;
  const platform = selectedOption.getAttribute('data-platform');
  const content = document.getElementById('postContent').value;
  const mediaUrl = document.getElementById('mediaUrl').value;
  const scheduleTime = document.getElementById('scheduleTime').value;
  
  if(!content && !mediaUrl) return alert('Add some text or media.');
  
  const btn = document.getElementById('publishBtn');
  btn.innerText = "Publishing to " + platform + "...";
  btn.disabled = true;
  
  try {
     const res = await ipcRenderer.invoke('publish-post', { 
       platform, accountId, content, hasMedia: !!mediaUrl, mediaUrl, scheduledDate: scheduleTime 
     });
     
     if (res && res.success) {
         alert('Successfully published to ' + platform + '!');
         document.getElementById('postContent').value = '';
         document.getElementById('mediaUrl').value = '';
     } else {
         alert('Publishing Error: ' + (res.error || 'Unknown error'));
     }
  } catch(e) {
     alert('Error: ' + e.message);
  }
  
  btn.innerHTML = '<i class="fas fa-paper-plane"></i> Publish Now';
  btn.disabled = false;
};
`;

// Remove the old event listeners
html = html.replace(/document\.getElementById\('enhanceBtn'\)\.addEventListener[\s\S]*?\}\);/g, '');
html = html.replace(/document\.getElementById\('stockPhotoBtn'\)\.addEventListener[\s\S]*?\}\);/g, '');
html = html.replace(/document\.getElementById\('genImageBtn'\)\.addEventListener[\s\S]*?\}\);/g, '');
html = html.replace(/document\.getElementById\('publishBtn'\)\.addEventListener[\s\S]*?\}\);/g, '');

// Inject new global functions at the end of the script tag
html = html.replace('</script>', newJsFunctions + '\n</script>');

fs.writeFileSync('content-hub.html', html, 'utf8');
console.log('Fixed Content Hub buttons');