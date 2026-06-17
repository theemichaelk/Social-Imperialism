const fs = require('fs');
let content = fs.readFileSync('C:/Users/theem/OneDrive/Documents/Factory AI.02.20.26/Social Imperialism/apps/desktop/keywords.html', 'utf8');

const regex = /<textarea class="textarea-field" id="customRulePrompt" style="min-height; 60px;"[\s\S]*/;

const replacement = `<textarea class="textarea-field" id="customRulePrompt" style="min-height: 60px; width: 100%; box-sizing: border-box; padding: 0.75rem; border-radius: 6px; background: rgba(15,23,42,0.8); border: 1px solid #475569; color: #f8fafc; font-family: inherit; font-size: 0.9rem;" placeholder="E.g., Always include a link to our help center when responding to technical questions..."></textarea>
        </div>

        <div style="margin-top: 2rem; display: flex; justify-content: flex-end; gap: 1rem;">
          <button class="secondary" onclick="closeAutoRulesModal()">Cancel</button>
          <button class="primary" onclick="saveAutoRules()">Save Rule Engine</button>
        </div>
      </div>
    </div>
</body>
</html>`;

content = content.replace(regex, replacement);

fs.writeFileSync('C:/Users/theem/OneDrive/Documents/Factory AI.02.20.26/Social Imperialism/apps/desktop/keywords.html', content, 'utf8');
console.log('Done');
