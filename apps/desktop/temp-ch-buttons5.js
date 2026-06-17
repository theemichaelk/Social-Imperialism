const fs = require('fs');
let html = fs.readFileSync('content-hub.html', 'utf8');

// There must be a fatal JS error halting execution before the DOM can attach the onclicks,
// OR the onclick attributes are being stripped/ignored. Let's trace it and add a diagnostic script tag
// at the very bottom.

const diagScript = `
<script>
window.onerror = function(msg, url, line) {
    alert("Global Error: " + msg + " at line " + line);
};
document.addEventListener('DOMContentLoaded', () => {
    try {
        const btn = document.getElementById('genImageBtn');
        if(btn) {
            btn.onclick = function() { alert("Hardwired click works!"); };
            btn.style.border = "2px solid red"; // visual confirmation it ran
        } else {
            alert("Could not find genImageBtn");
        }
    } catch(e) {
        alert("DOM load error: " + e.message);
    }
});
</script>
</body>
`;

html = html.replace('</body>', diagScript);
fs.writeFileSync('content-hub.html', html, 'utf8');
console.log('Added diagnostic script to content-hub.html');