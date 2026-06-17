const fs = require('fs');
let file = "dashboard.html";
let content = fs.readFileSync(file, "utf8");

let newHtml = `
<div class="panel">
  <h3>Social Connection Metrics</h3>
  <table id="apiMetricsTable" style="width: 100%; text-align: left; color: #e2e8e8;">
  </table>
</div>
<div class="panel">
  <h3>Account Growth Intelligence</h3>
  <table id="accountsSummaryTable" style="width: 100%; text-align: left; color: #e2e8e8;">
  </table>
</div>
`;

content = content.replace(/<!-- Account Intelligence Profile -->[\ns\\S]*?<h3/, newHtml + '\n<!-- Account Intelligence Profile -->\n<h3');

let jsLogic = `
if (data.apiMetrics) {
  let tbody = '';
  Object.keys(data.apiMetrics).sort().forEach(platform => {
    let badgeClass = data.apiMetrics[platform].includes('Connected') ? 'success' : 'danger';
    tbody += '<tr><td>' + platform + '</td><td><span class="badge ' + badgeClass + '">' + data.apiMetrics[platform] + '</span></td></tr>';
  });
  document.getElementById('apiMetricsTable').innerHTML = tbody;
}

if (data.accountsSummary) {
  let atbody = '<tr><th>Platform</th><th>Handle</th><th>Followers</th><th>Growth</th></tr>';
  data.accountsSummary.forEach(acc => {
    atbody += '<tr><td>' + acc.platform + '</td><td>' + acc.handle + '</td><td>' + acc.followers + '</td><td><span class="badge success">' + acc.growth + '</span></td></tr>';
  });
  document.getElementById('accountsSummaryTable').innerHTML = atbody;
}
`;

content = content.replace(/document\\.getElementById\\(\'totalEngagement\'\\)\\.innerText = data\\.totalEngagement;/, `document.getElementById('totalEngagement').innerText = data.totalEngagement;` , jsLogic);

fs.writeFileSync(file, content);
console.log('Success');