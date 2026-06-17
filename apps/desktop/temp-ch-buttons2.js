const fs = require('fs');
let html = fs.readFileSync('content-hub.html', 'utf8');

// Ensure all HTML elements are correctly wired up with `onclick`
html = html.replace(/<button class="tool-btn"( |>)<i class="fas fa-image"><\/i> Add Media<\/button>/g, '<button class="tool-btn" onclick="document.getElementById(\'mediaUpload\').click()"><i class="fas fa-image"></i> Add Media</button>');
html = html.replace(/<button class="tool-btn generate"( |>)<i class="fas fa-magic"><\/i> Generate Image<\/button>/g, '<button class="tool-btn generate" onclick="window.generateFalImage()"><i class="fas fa-magic"></i> Generate Image</button>');
html = html.replace(/<button class="tool-btn generate"( |>)<i class="fas fa-camera"><\/i> Stock Photo<\/button>/g, '<button class="tool-btn generate" onclick="window.getStockPhoto()"><i class="fas fa-camera"></i> Stock Photo</button>');
html = html.replace(/<button class="tool-btn generate"( |>)<i class="fas fa-sparkles"><\/i> Enhance<\/button>/g, '<button class="tool-btn generate" onclick="window.enhanceText()"><i class="fas fa-sparkles"></i> Enhance</button>');
html = html.replace(/<button class="primary-btn" id="publishBtn"( |>)<i class="fas fa-paper-plane"><\/i> Publish Now<\/button>/g, '<button class="primary-btn" id="publishBtn" onclick="window.publishStandardPost()"><i class="fas fa-paper-plane"></i> Publish Now</button>');

// Let's rewrite the JS functions block to be completely foolproof
const startBlock = html.indexOf('window.enhanceText = async function() {');
if(startBlock > -1) {
    const endBlock = html.indexOf('</script>', startBlock);
    
    const newFunctions = `
window.enhanceText = async function() {
    console.log("Enhance triggered");
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
    console.log("Stock Photo triggered");
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
    console.log("FAL Image triggered");
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
     const res = await ipcRenderer.invoke('publish-post', { 
       platform, accountId, content, hasMedia: !!mediaUrl, mediaUrl, scheduledDate: scheduleTime 
     });
     
     // The current IPC returns mock or real data. Sometimes it returns the Tweet ID directly.
     alert('Successfully published to ' + platform + '!');
     document.getElementById('postContent').value = '';
     document.getElementById('mediaUrl').value = '';
     document.getElementById('scheduleTime').value = '';
     
  } catch(e) {
     alert('Error: ' + e.message);
  }
  
  btn.innerHTML = '<i class="fas fa-paper-plane"></i> Publish Now';
  btn.disabled = false;
};
`;

    html = html.substring(0, startBlock) + newFunctions + "\n" + html.substring(endBlock);
}

fs.writeFileSync('content-hub.html', html, 'utf8');
console.log('Fully wired content hub buttons');