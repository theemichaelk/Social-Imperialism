const fs = require('fs');
let html = fs.readFileSync('content-hub.html', 'utf8');

// I am going to try the most basic implementation possible: binding directly onto the HTML elements without any wrappers
// Because DOMContentLoaded and window functions aren't working, this suggests there's a scope error with `require('electron')`
// or the script block is crashing early on before it even binds them.
// Let's rip out all the old buttons and inject fresh buttons with fresh, fully isolated script blocks inline.

// 1. Let's find the entire standard tab and replace the toolbar and publish buttons completely.
let start = html.indexOf('<div class="toolbar">');
let end = html.indexOf('</textarea>', start);

if (start > -1 && end > -1) {
    let newToolbar = `
      <div class="toolbar">
        <input type="file" id="mediaUpload" style="display:none" accept="image/*,video/*">
        <button class="tool-btn" id="btn-add-media"><i class="fas fa-image"></i> Add Media</button>
        <button class="tool-btn generate" id="btn-gen-image"><i class="fas fa-paint-brush"></i> Generate Image</button>
        <button class="tool-btn generate" id="btn-stock-photo"><i class="fas fa-camera"></i> Stock Photo</button>
        <button class="tool-btn generate" id="btn-enhance"><i class="fas fa-magic"></i> Enhance</button>
      </div>

      <textarea class="textarea-field" id="postContent" placeholder="Draft your content here. The AI Brain will analyze it against brand guidelines before publishing..."></textarea>
      
      <!-- ISOLATED SCRIPT FOR BUTTONS -->
      <script>
      (function() {
          const { ipcRenderer } = require('electron');
          
          document.getElementById('btn-add-media').addEventListener('click', () => {
              document.getElementById('mediaUpload').click();
          });
          
          document.getElementById('mediaUpload').addEventListener('change', async (e) => {
              const file = e.target.files[0];
              if(!file) return;
              try {
                  const base64 = await ipcRenderer.invoke('upload-local-media', file.path);
                  if(base64) document.getElementById('mediaUrl').value = base64;
              } catch(err) { alert(err.message); }
          });

          document.getElementById('btn-enhance').addEventListener('click', async () => {
              const text = document.getElementById('postContent').value;
              if(!text) return alert("Write some draft text first!");
              document.getElementById('btn-enhance').innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
              try {
                  const enhanced = await ipcRenderer.invoke('generate-ai', "Enhance this: " + text);
                  document.getElementById('postContent').value = enhanced;
              } catch(err) { alert(err.message); }
              document.getElementById('btn-enhance').innerHTML = '<i class="fas fa-magic"></i> Enhance';
          });
          
          document.getElementById('btn-stock-photo').addEventListener('click', async () => {
              const query = prompt("Stock photo search term:");
              if(!query) return;
              document.getElementById('btn-stock-photo').innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
              try {
                  const res = await ipcRenderer.invoke('search-stock-photo', query);
                  if(res && res.success) document.getElementById('mediaUrl').value = res.imageUrl;
                  else alert(res.error || "Failed");
              } catch(err) { alert(err.message); }
              document.getElementById('btn-stock-photo').innerHTML = '<i class="fas fa-camera"></i> Stock Photo';
          });
          
          document.getElementById('btn-gen-image').addEventListener('click', async () => {
              const query = prompt("Generate image prompt:");
              if(!query) return;
              document.getElementById('btn-gen-image').innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
              try {
                  const res = await ipcRenderer.invoke('generate-image', query);
                  if(res && res.success) document.getElementById('mediaUrl').value = res.imageUrl;
                  else alert(res.error || "Failed");
              } catch(err) { alert(err.message); }
              document.getElementById('btn-gen-image').innerHTML = '<i class="fas fa-paint-brush"></i> Generate Image';
          });
      })();
      </script>
`;
    html = html.substring(0, start) + newToolbar + html.substring(end + 11); // 11 is length of </textarea>
}

// 2. Publish Button
let startPub = html.indexOf('<div class="action-row">');
let endPub = html.indexOf('</div>', html.indexOf('Publish Now', startPub));

if (startPub > -1 && endPub > -1) {
    let newPub = `
      <div class="action-row">
        <div class="publishing-options">
          <button class="secondary-btn" id="scheduleBtn"><i class="fas fa-clock"></i> Schedule</button>
        </div>
        <button class="primary-btn" id="btn-publish-post"><i class="fas fa-paper-plane"></i> Publish Now</button>
      </div>
      
      <script>
      (function() {
          const { ipcRenderer } = require('electron');
          document.getElementById('btn-publish-post').addEventListener('click', async () => {
              const selectEl = document.getElementById('accountSelect');
              const selectedOption = selectEl.options[selectEl.selectedIndex];
              if(!selectedOption || !selectedOption.value) return alert('Select an account first.');
              
              const accountId = selectedOption.value;
              const platform = selectedOption.getAttribute('data-platform');
              const content = document.getElementById('postContent').value;
              const mediaUrl = document.getElementById('mediaUrl').value;
              
              if(!content && !mediaUrl) return alert('Add text or media.');
              
              const btn = document.getElementById('btn-publish-post');
              btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Publishing...';
              btn.disabled = true;
              
              try {
                 await ipcRenderer.invoke('publish-post', { 
                   platform, accountId, content, hasMedia: !!mediaUrl, mediaUrl 
                 });
                 alert('Successfully published to ' + platform + '!');
                 document.getElementById('postContent').value = '';
                 document.getElementById('mediaUrl').value = '';
              } catch(err) {
                 alert('Error: ' + err.message);
              }
              
              btn.innerHTML = '<i class="fas fa-paper-plane"></i> Publish Now';
              btn.disabled = false;
          });
      })();
      </script>
`;
    // finding the end of the action-row div. Since it contains a nested div, it's safer to just replace
    // up to Publish Now</button>\n      </div>
    
    // We can use regex to safely target the action-row block containing the publish button
    html = html.replace(/<div class="action-row">[\s\S]*?<button class="primary-btn" id="publishBtn"[\s\S]*?Publish Now<\/button>\s*<\/div>/, newPub);
}

fs.writeFileSync('content-hub.html', html, 'utf8');
console.log('Injected fully isolated inline scripts for buttons.');