type CsvRow = {
  campaignId?: string;
  source?: string;
  sourceLabel?: string;
  intent?: string;
  originalPost?: string;
  replyContent?: string;
  platform?: string;
  status?: string;
  replyMode?: string;
  beFirst?: boolean;
  hasUtmLink?: boolean;
  timestamp?: string | number;
  author?: string;
  url?: string;
  matchedKeyword?: string;
  searchLabel?: string;
  listName?: string;
};

const SOURCE_LABELS: Record<string, string> = {
  manual: 'Manual (Feed)',
  keyword: 'Keywords',
  monitor: 'Monitors',
  automation: 'Auto-Rules',
  'automation-flow': 'Automations',
  engagement: 'Engagement',
  qa: 'Q&A',
  lead: 'Leads',
  onboarding: 'Setup Wizard',
  'content-hub': 'Content Hub',
};

const INTENT_LABELS: Record<string, string> = {
  brand: 'Brand Promotion',
  affiliate: 'Affiliate Products',
  client: 'Client Brand',
  qa: 'Q&A Discovery',
  mentions: 'Mentions',
};

export function buildCsvExport(rows: CsvRow[]): string {
  const header = 'Campaign ID,Source,Intent,Use Case,Original Post,AI Reply,Platform,Status,Reply Mode,Be First,UTM Link,Date,Author,Post URL,Matched Keyword,Monitor,List\n';
  const body = rows.map((e) => {
    const intent = e.intent || 'brand';
    const useCase = INTENT_LABELS[intent] || intent;
    const src = e.sourceLabel || SOURCE_LABELS[e.source || ''] || e.source || '';
    const esc = (s: string) => (s || '').replace(/"/g, '""');
    return `"${esc(e.campaignId || '')}","${esc(src)}","${esc(intent)}","${esc(useCase)}","${esc(e.originalPost || '')}","${esc(e.replyContent || '')}","${esc(e.platform || '')}","${esc(e.status || '')}","${esc(e.replyMode || '')}","${e.beFirst ? 'yes' : 'no'}","${e.hasUtmLink ? 'yes' : 'no'}","${e.timestamp ? new Date(e.timestamp).toLocaleString() : ''}","${esc(e.author || '')}","${esc(e.url || '')}","${esc(e.matchedKeyword || '')}","${esc(e.searchLabel || '')}","${esc(e.listName || '')}"`;
  }).join('\n');
  return header + body;
}

export function downloadCsv(csv: string, filename: string) {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}