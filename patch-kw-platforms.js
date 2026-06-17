const fs = require('fs');
let content = fs.readFileSync('C:/Users/theem/OneDrive/Documents/Factory AI.02.20.26/Social Imperialism/apps/desktop/keywords.html', 'utf8');

const htmlToReplace = `<label class="platform-toggle"><input type="checkbox" value="Quora" \${hasPlatform('Quora') ? 'checked' : ''}> Quora</label>
    </div>`;

const newHtml = `<label class="platform-toggle"><input type="checkbox" value="Quora" \${hasPlatform('Quora') ? 'checked' : ''}> Quora</label>
      <label class="platform-toggle"><input type="checkbox" value="WhatsApp" \${hasPlatform('WhatsApp') ? 'checked' : ''}> WhatsApp</label>
      <label class="platform-toggle"><input type="checkbox" value="Snapchat" \${hasPlatform('Snapchat') ? 'checked' : ''}> Snapchat</label>
      <label class="platform-toggle"><input type="checkbox" value="Threads" \${hasPlatform('Threads') ? 'checked' : ''}> Threads</label>
    </div>`;

content = content.replace(htmlToReplace, newHtml);

fs.writeFileSync('C:/Users/theem/OneDrive/Documents/Factory AI.02.20.26/Social Imperialism/apps/desktop/keywords.html', content, 'utf8');
console.log('Added missing platforms to keywords.html');
