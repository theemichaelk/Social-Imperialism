const fs = require('fs');
let html = fs.readFileSync('content-hub.html', 'utf8');

// 1. Add Tab Button
const tabButtonHtml = '<div class="tab" onclick="switchTab(\'brand\')"><i class="fas fa-bullseye"></i> Brand & Keywords</div>';

if (!html.includes('switchTab(\'brand\')')) {
    html = html.replace('<div class="tab" onclick="switchTab(\'comments\')"><i class="fas fa-comments"></i> Manage Comments / Replies</div>', 
                        '<div class="tab" onclick="switchTab(\'comments\')"><i class="fas fa-comments"></i> Manage Comments / Replies</div>\n      ' + tabButtonHtml);
}

// 2. Add Tab Content
const tabContentHtml = `
    <!-- BRAND & KEYWORDS TAB -->
    <div id="brand-tab" class="tab-content">
      <div class="two-col">
        <div style="background: rgba(15, 23, 42, 0.5); padding: 1.5rem; border-radius: 8px; border: 1px solid #334155;">
          <h3 class="section-title">1. Brand Profile</h3>
          <label>Brand Name</label>
          <input type="text" class="input-field" id="chBrandName" placeholder="e.g. Acme Corp">
          <label>Brand Domain</label>
          <input type="text" class="input-field" id="chBrandDomain" placeholder="e.g. acme.com">
          <label>Brand Description</label>
          <textarea class="textarea-field" id="chBrandDesc" style="min-height: 80px;" placeholder="What does your brand do?"></textarea>
          <label>Tone of Voice</label>
          <select class="input-field" id="chBrandTone">
            <option value="professional">Professional</option>
            <option value="casual">Casual / Friendly</option>
            <option value="humorous">Humorous</option>
          </select>
          <label>Target Audience (Optional)</label>
          <input type="text" class="input-field" id="chBrandAudience" placeholder="e.g. Small business owners">
          <button class="primary-btn" style="width: 100%; justify-content: center;" onclick="saveBrandProfile()">Save Profile</button>
        </div>
        
        <div style="background: rgba(15, 23, 42, 0.5); padding: 1.5rem; border-radius: 8px; border: 1px solid #334155;">
          <h3 class="section-title">2. Keywords &amp; Platforms</h3>
          <p style="color: #94a3b8; font-size: 0.9rem; margin-bottom: 1rem;">Let AI suggest keywords based on your brand profile, or add them manually.</p>
          <button class="tool-btn generate" style="margin-bottom: 1rem; width: 100%; justify-content: center;" onclick="suggestKeywords()"><i class="fas fa-magic"></i> AI Suggest Keywords</button>
          
          <div id="keywordSuggestions" style="margin-bottom: 1rem; display: flex; flex-wrap: wrap; gap: 0.5rem;"></div>

          <label>Add Manual Keyword</label>
          <div style="display: flex; gap: 0.5rem; margin-bottom: 1rem;">
            <input type="text" class="input-field" id="chManualKeyword" style="margin-bottom: 0;" placeholder="e.g. marketing automation">
            <button class="secondary-btn" onclick="addManualKeyword()">Add</button>
          </div>

          <label>Per-Platform Keyword Rules</label>
          <div style="background: #020617; border: 1px solid #475569; border-radius: 6px; padding: 1rem; max-height: 200px; overflow-y: auto;" id="platformKeywordsList">
            <p style="color: #475569; text-align: center; margin: 0;">Add keywords to assign them to platforms.</p>
          </div>
        </div>
      </div>
    </div>
`;

if (!html.includes('id="brand-tab"')) {
    html = html.replace('<!-- COMMENTS TAB (Placeholder) -->', tabContentHtml + '\n    <!-- COMMENTS TAB (Placeholder) -->');
}

// 3. Add JS Logic
const jsContentHtml = `
// Brand & Keyword Logic
let currentKeywords = [];

function saveBrandProfile() {
    // Basic LocalStorage save
    const profile = {
        name: document.getElementById('chBrandName').value,
        domain: document.getElementById('chBrandDomain').value,
        desc: document.getElementById('chBrandDesc').value,
        tone: document.getElementById('chBrandTone').value,
        audience: document.getElementById('chBrandAudience').value
    };
    localStorage.setItem('ch_brandProfile', JSON.stringify(profile));
    alert('Brand profile saved successfully!');
}

function loadBrandProfile() {
    try {
        const saved = localStorage.getItem('ch_brandProfile');
        if(saved) {
            const p = JSON.parse(saved);
            document.getElementById('chBrandName').value = p.name || '';
            document.getElementById('chBrandDomain').value = p.domain || '';
            document.getElementById('chBrandDesc').value = p.desc || '';
            document.getElementById('chBrandTone').value = p.tone || 'professional';
            document.getElementById('chBrandAudience').value = p.audience || '';
        }
    } catch(e){}
}

async function suggestKeywords() {
    const desc = document.getElementById('chBrandDesc').value;
    const name = document.getElementById('chBrandName').value;
    if (!desc || !name) return alert('Please fill in Brand Name and Description first.');
    
    document.getElementById('keywordSuggestions').innerHTML = '<span style="color: #38bdf8;">Generating suggestions...</span>';
    
    try {
        const prompt = \`Based on this brand: ${name} - ${desc}. Suggest 5 relevant social media listening keywords as a comma-separated list.\`;
        const res = await ipcRenderer.invoke('generate-ai', prompt);
        
        let kws = res.split(',').map(k => k.trim().replace(/^['\"]|['\"]$/g, '')).filter(k => k);
        let htmlStr = '';
        kws.forEach(k => {
            htmlStr += <span style="background: #1e293b; border: 1px solid #3!�����������������ɕ������ɕ�쁉�ɑ�ȵɅ����������쁙��еͥ������ɕ�쁍��ͽ������ѕ�숁�������􉅑�-��ݽɑQ�1��Сp�����p��������񤁍����􉙅́������̈���屔􉵅ɝ�����������ɕ�����������q��(�����������(�����������յ��й���������	�%������ݽɑM՝���ѥ��̜�������!Q50��ѵ�M���(����􁍅э������(�����������յ��й���������	�%������ݽɑM՝���ѥ��̜�������!Q50����������屔􉍽���耍��������������Ѽ�����Ʌє��������(�����)�()ݥ���ܹ���5��Յ�-��ݽɐ��չ�ѥ������(��������Ё�܀􁑽�յ��й���������	�%�����5��Յ�-��ݽɐ���م�Ք��ɥ����(��������ܤ��(�����������-��ݽɑQ�1��С�ܤ�(�����������յ��й���������	�%�����5��Յ�-��ݽɐ���م�Ք�􀜜�(�����)�()ݥ���ܹ���-��ݽɑQ�1��Ѐ�չ�ѥ����ܤ��(����������ɕ��-��ݽɑ̹����Ց�̡�ܤ��ɕ��ɸ�(�������ɕ��-��ݽɑ̹��͠��ܤ�(����ɕ����A��љ�ɵ-��ݽɑ̠��)�()�չ�ѥ���ɕ����A��љ�ɵ-��ݽɑ̠���(��������Ё���х���Ȁ􁑽�յ��й���������	�%������љ�ɵ-��ݽɑ�1��М��(����������ɕ��-��ݽɑ̹����Ѡ��������(�����������х���ȹ�����!Q50�������屔􉍽���而�������ѕ�е�����聍��ѕ�쁵�ɝ������������ݽɑ́Ѽ���ͥ���ѡ���Ѽ����љ�ɵ̸�����(��������ɕ��ɸ�(�����(����(������Ё�ѵ�M�Ȁ􀜜�(�������ɕ��-��ݽɑ̹���������ܰ���ऀ����(���������ѵ�M�Ȁ��q�(���������؁��屔􉉅���ɽչ�而����Ʉ쁉�ɑ�������ͽ������������������������ɕ�쁉�ɑ�ȵɅ��������쁵�ɝ������ѽ�����ɕ���(�������������؁��屔􉑥�����聙���쁩��ѥ�䵍��ѕ������������ݕ��쁅������ѕ��聍��ѕ�쁵�ɝ������ѽ�����ɕ���(�������������������ɽ�����屔􉍽���耍�Ř՘�����������ɽ���(�������������������ѽ����������ɕ��ٕ-��ݽɐ������������屔􉉅���ɽչ���Ʌ����ɕ��쁉�ɑ��聹���쁍����耍������쁍��ͽ������ѕ���񤁍����􉙅́���ѥ��̈������ѽ��(������������𽑥��(�������������؁��屔􉑥�����聙���쁝����ɕ�쁙��еͥ�����ɕ�쁍����而�ф͈���(����������������񱅉������Ё����􉍡�����������������Qݥ�ѕȽ`𽱅����(����������������񱅉������Ё����􉍡�����������������I�����𽱅����(����������������񱅉������Ё����􉍡���������Q��Q��𽱅����(����������������񱅉������Ё����􉍡���������e��QՉ�𽱅����(������������𽑥��(��������𽑥����(�������(�������х���ȹ�����!Q50��ѵ�M���)�()ݥ���ܹɕ��ٕ-��ݽɐ��չ�ѥ�����ँ�(�������ɕ��-��ݽɑ̹���������ఀĤ�(����ɕ����A��љ�ɵ-��ݽɑ̠��)�()���յ��й���ٕ��1��ѕ��Ƞ�=5��ѕ��1���������������(��������	Ʌ��Aɽ�������)���(���()������ѵ������Ց�̠���Ё���ɕ��-��ݽɑ̀�mt윤���(�����ѵ���ѵ��ɕ����������1����1���������չ�́��Ѽ�ѡ���ɽ���ݸ�������ѕ��!ѵ�����q�q����1����1���������չ�́��Ѽ�ѡ���ɽ���ݸ���)�()�̹�ɥѕ���M幌�����ѕ�е�Ո��ѵ�����ѵ�����ј����)���ͽ��������MՍ���͙ձ�䁥����ѕ��	Ʌ�����-��ݽɑ́х����Ѽ���ѕ�Ё!Ո����