const fs = require('fs');
let dash = fs.readFileSync('dashboard.html', 'utf8');

// The issue in dashboard.html is multiple script blocks that got mangled.
// We have:
// <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
// <script>
//  some content
// </script>
// <script>
//  more content
// </script>

// Let's just remove the first `</script>\n<script>` separator to merge them.
if(dash.includes('</script>\n<script>')) {
    dash = dash.replace('</script>\n<script>', '\n');
    fs.writeFileSync('dashboard.html', dash, 'utf8');
    console.log('Merged script tags in dashboard.html');
}

let hist = fs.readFileSync('history.html', 'utf8');
if(hist.includes('</script>\n<script>')) {
    hist = hist.replace('</script>\n<script>', '\n');
    fs.writeFileSync('history.html', hist, 'utf8');
    console.log('Merged script tags in history.html');
}