const fs = require('fs');
let html = fs.readFileSync('content-hub.html', 'utf8');

// Ensure all HTML elements are correctly wired up with `onclick`
html = html.replace(/id="genImageBtn" onclick="generateFalImage\(\)"/g, 'id="genImageBtn" onclick="window.generateFalImage()"');
html = html.replace(/id="stockPhotoBtn" onclick="getStockPhoto\(\)"/g, 'id="stockPhotoBtn" onclick="window.getStockPhoto()"');
html = html.replace(/id="enhanceBtn" onclick="enhanceText\(\)"/g, 'id="enhanceBtn" onclick="window.enhanceText()"');
html = html.replace(/id="publishBtn" onclick="publishStandardPost\(\)"/g, 'id="publishBtn" onclick="window.publishStandardPost()"');

// Make sure that the IPC is accessed off the window if needed or that the JS context works
let jsBlock = `
window.enhanceText = async function() {
    console.log("Enhance triggered");
    const text = document.getElementById('postContent').value;
    if(!text) return alert("Write some draft text first!");
    
    document.getElementById('postContent').value = "Enhancing with AI...";
    try {
      const enhanced = await require('electron').ipcRenderer.invoke('generate-ai', "Rewrite and enhance this social media post draft to be highly engaging, adding relevant emojis and hashtags. Here is the draft: " + text);
      document.getElementById('postContent').value = enhanced;
    } catch(e) {
      alert("Failed to enhance: " + e.message);
      document.getElementById('postContent').value = text;
    }
};

window.getStockPhoto = async function() {
    console.log("Stock Photo triggered");
    const query = prompt("Enter a search term for a stock photo:");
    if(!query) return;
    
    document.getElementById('mediaUrl').value = "Searching Pexels...";
    
    try {
        const res = await require('electron').ipcRenderer.invoke('search-stock-photo', query);
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
    console.log("FAL Image triggered");
    const query = prompt("Describe the image you want AI to generate:");
    if(!query) return;
    
    document.getElementById('mediaUrl').value = "Generating via FAL AI...";
    
    try {
        const res = await require('electron').ipcRenderer.invoke('generate-image', query);
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
  console.log("Publish triggered");
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
     const res = await require('electron').ipcRenderer.invoke('publish-post', { 
       platform, accountId, content, hasMedia: !!mediaUrl, mediaUrl, scheduledDate: scheduleTime 
     });
     
     alert('Successfully published to ' + platform + '!');
     document.getElementById('postContent').value = '';
     document.getElementById('mediaUrl').value = '';
     if(document.getElementById('scheduleTime')) document.getElementById('scheduleTime').value = '';
     
  } catch(e) {
     alert('Error: ' + e.message);
  }
  
  btn.innerHTML = '<i class="fas fa-paper-plane"></i> Publish Now';
  btn.disabled = false;
};
`;

// Replace the previous block
const startBlock = html.indexOf('window.enhanceText = async function() {');
if(startBlock > -1) {
    const endBlock = html.indexOf('</script>', startBlock);
    html = html.substring(0, startBlock) + jsBlock + "\n" + html.substring(endBlock);
}

fs.writeFileSync('content-hub.html', html, 'utf8');
console.log('Fixed window namespace wiring');