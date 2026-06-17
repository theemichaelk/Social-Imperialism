
    // Ensure "Loading Campaigns..." is replaced with real data from store (per blueprint - all menu pages should do this)
    // This runs for the Settings page itself.
    (function initCampaignSwitcher() {
      const sel = document.getElementById('sidebarCampaignSwitcher');
      if (!sel) return;
      // Use IPC to load real campaigns
      if (typeof require !== 'undefined') {
        try {
          const { ipcRenderer } = require('electron');
          ipcRenderer.invoke('get-settings').then(camps => {
            sel.innerHTML = '';
            const list = camps || [];
            if (list.length === 0) {
              const o = document.createElement('option');
              o.value = '';
              o.textContent = 'No campaigns - create one above';
              sel.appendChild(o);
              return;
            }
            list.forEach(c => {
              const o = document.createElement('option');
              o.value = c.id;
              o.textContent = c.brandName || c.id;
              sel.appendChild(o);
            });
            // select active
            ipcRenderer.invoke('get-active-campaign').then(active => {
              if (active && active.id) sel.value = active.id;
            });
            sel.onchange = () => {
              ipcRenderer.invoke('set-active-campaign', sel.value).then(() => {
                // reload to apply to current settings view
                window.location.reload();
              });
            };
          });
        } catch(e) { /* fallback to static if no ipc */ }
      }
    })();
  