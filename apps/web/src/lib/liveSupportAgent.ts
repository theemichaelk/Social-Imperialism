/**
 * Imperialism Brain (Live Support) — prompt, routing, and approval helpers.
 * Canonical doc: brain/LIVE_SUPPORT_AGENT.md
 */

import { OVERLORD_SYSTEM_APPEND } from '@/lib/theeMichaelOverlord';
import { recordApprovalResolution } from '@/lib/theeMichaelNotificationLedger';
import { isSeoIntelligencePrompt, THEE_MICHAEL_SEO_EXPERT_APPEND, SEO_QUICK_PROMPTS } from '@/lib/theeMichaelSeoExpert';
import { SELF_HEAL_EXPERT_APPEND } from '@/lib/selfHealIntelligence';
import { ONBOARDING_EXPERT_APPEND } from '@/lib/theeMichaelOnboardingExpert';
import { isMasteryRequest, MASTERY_EXPERT_APPEND, MASTERY_QUICK_PROMPTS } from '@/lib/theeMichaelMasteryExpert';

export const ADMIN_IDENTITY = 'THEE_MICHAEL';

export const INIT_MESSAGE_VERSION = 4;

export const INIT_MESSAGE =
  'Welcome to Social Imperialism — I\'m **Imperialism Brain**. I can walk you A→Z through every module (26 steps) and remember where you left off. New here? Tap **Walk me through A-Z setup now** or say "help me start from the beginning." What should we tackle first?';

export const LIVE_SUPPORT_SYSTEM_PROMPT = `You are Imperialism Brain, the official live support agent for Social Imperialism (socialimperialism.com).
Help users set up, troubleshoot, optimize, and launch social media growth workflows.
Speak like a helpful technical growth partner: confident, concise, human.
Keep answers short and scannable. Focus on the next useful action inside Social Imperialism.
If stuck, ask ONE focused question before a long answer.
Never say "As an AI language model" or robotic phrases.
Never introduce yourself as ${ADMIN_IDENTITY}. Never open with "Hey, I'm ${ADMIN_IDENTITY}" or any self-introduction — jump straight to the answer.
You are Imperialism Brain (Live Support), not ${ADMIN_IDENTITY}. ${ADMIN_IDENTITY} is the admin identity for approvals only.
Never expose credentials, tokens, API keys, or passwords.
For sensitive global changes (billing, server settings, mass auto-reply rules, deleting core data), say approval from ${ADMIN_IDENTITY} is required before going live.
Reference ${ADMIN_IDENTITY} sparingly — only for admin approval context, never as a greeting.
Use user-facing labels: Connect Platform, Review Replies, Open Engagement Queue, Schedule Campaign, Ask ${ADMIN_IDENTITY}, Create Drafts, Refresh Feed, Generate Report.
Modules: Mission Control, Setup Wizard, Integrations Hub, Content Hub, Calendar, AI Replies, Keywords, SEO Tools, Growth Lab, Quora Ops, Auto-Rules, Accounts, Settings, Analytics.
SEO intelligence: You have live AEO, GEO, local, and national SEO frameworks plus multi-engine SERP pulse (Google, Bing, Yahoo, DuckDuckGo, Brave, Edge). When LIVE SEO INTELLIGENCE is appended below, prioritize it over stale priors.

Live navigation: When the user asks you to open, show, take them to, or find something in the left sidebar or a tab, you CAN and SHOULD trigger a live browser redirect. End your reply with exactly one directive on its own line: [[NAV:/path?tab=optional|Human Label]] (example: [[NAV:/integrations?tab=connections|Integrations]]). Use real paths from the product: /dashboard, /integrations, /settings?tab=billing, /history?tab=pending, /campaign-manager, /support, etc. Say "Taking you there now" briefly — do not only paste a link when navigation was requested.`;

/** Strip repetitive THEE_MICHAEL self-intros from model output. */
export function sanitizeAgentReply(text: string): string {
  let out = String(text || '').trim();
  const introPattern = /^(?:hey|hi|hello)[,!]?\s*(?:i['']?m\s+)?thee_michael\s*[—–\-:,]?\s*/i;
  while (introPattern.test(out)) {
    out = out.replace(introPattern, '').trim();
  }
  return out;
}

export type SupportMessage = {
  role: 'user' | 'assistant';
  content: string;
  ts?: string;
};

export type ApprovalTicket = {
  id: string;
  request: string;
  module: string;
  riskLevel: 'low' | 'medium' | 'high';
  recommendedAction: string;
  rollbackNote: string;
  status: 'pending' | 'approved' | 'rejected' | 'routed';
  routedTo: typeof ADMIN_IDENTITY;
  createdAt: string;
};

export type SearchRoute = {
  label: string;
  href: string;
  action?: string;
};

const APPROVAL_STORAGE_KEY = 'si_support_approvals';

function normalizeApprovalRequest(request: string): string {
  return request.trim().toLowerCase().replace(/\s+/g, ' ').slice(0, 240);
}

function readAllApprovals(): ApprovalTicket[] {
  if (typeof window === 'undefined') return [];
  try {
    return JSON.parse(localStorage.getItem(APPROVAL_STORAGE_KEY) || '[]') as ApprovalTicket[];
  } catch {
    return [];
  }
}

function writeAllApprovals(tickets: ApprovalTicket[]) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(APPROVAL_STORAGE_KEY, JSON.stringify(tickets.slice(0, 30)));
  } catch { /* ignore */ }
}

const SENSITIVE_PATTERNS = [
  /\bglobal\s+auto[- ]?reply\b/i,
  /\bevery\s+account\b/i,
  /\ball\s+accounts\b/i,
  /\bchange\s+(billing|subscription|plan)\b/i,
  /\bdelete\s+(all|core|campaign)\b/i,
  /\bserver\s+settings?\b/i,
  /\bproduction\s+code\b/i,
  /\bgo\s+live\b.*\bevery\b/i,
  /\bmass\s+post/i,
];

export const SEARCH_ROUTES: Array<{ patterns: RegExp[]; route: SearchRoute }> = [
  {
    patterns: [/thee_michael/i, /ask\s+thee/i, /admin\s+approval/i, /admin\s+help/i],
    route: { label: 'Ask THEE_MICHAEL', href: '/support', action: 'admin-approval' },
  },
  {
    patterns: [/connect\s+(a\s+)?platform/i, /link\s+(a\s+)?platform/i, /oauth\s+connect/i, /expired\s+token/i],
    route: { label: 'Account Hub', href: '/account-hub', action: 'connect-platform' },
  },
  {
    patterns: [/integration/i, /api\s+keys?/i],
    route: { label: 'Integrations · Connections', href: '/integrations?tab=connections' },
  },
  {
    patterns: [/reply\s+engine/i, /fix\s+reply/i, /ai\s+repl/i, /engagement\s+queue/i],
    route: { label: 'Review Replies', href: '/history' },
  },
  {
    patterns: [/posts?\s+not\s+schedul/i, /not\s+schedul/i, /campaign\s+not\s+post/i, /won'?t\s+post/i, /failed\s+to\s+publish/i],
    route: { label: 'Content Calendar', href: '/calendar', action: 'scheduling-troubleshoot' },
  },
  {
    patterns: [/schedule\s+post/i, /content\s+calendar/i],
    route: { label: 'Content Calendar', href: '/calendar' },
  },
  {
    patterns: [/mission\s+control/i, /live\s+feed/i, /dashboard/i, /worker\s+status/i],
    route: { label: 'Refresh Feed', href: '/dashboard' },
  },
  {
    patterns: [/\bae[no]\b/i, /answer\s+engine/i, /featured\s+snippet/i, /\bpaa\b/i, /people\s+also\s+ask/i],
    route: { label: 'SEO Tools · AEO', href: '/seo-tools' },
  },
  {
    patterns: [/\bgeo\b/i, /generative\s+engine/i, /ai\s+overview/i, /llm\s+visibility/i],
    route: { label: 'SEO Tools · GEO', href: '/seo-tools' },
  },
  {
    patterns: [/local\s+seo/i, /near\s+me/i, /google\s+business/i, /\bgmb\b/i, /map\s+pack/i],
    route: { label: 'Keywords · Local', href: '/keywords' },
  },
  {
    patterns: [/\bkgr\b/i, /keyword\s+research/i, /serp\s+research/i, /national\s+seo/i],
    route: { label: 'SEO Tools', href: '/seo-tools' },
  },
  {
    patterns: [/keyword/i, /seo/i, /discover/i, /browse\s+post/i],
    route: { label: 'Open Discovery', href: '/browse-posts' },
  },
  {
    patterns: [/walk\s+(me\s+)?through/i, /a[\s-]?z\s+setup/i, /show\s+campaign\s+mastery/i, /campaign\s+mastery/i, /continue\s+(my\s+)?(next\s+)?setup/i, /where\s+am\s+i/i, /finish\s+setup/i, /start\s+from\s+(the\s+)?beginn?ing/i, /from\s+(the\s+)?beginn?ing/i, /from\s+scratch/i, /help\s+me\s+start(?:\s+from)?/i, /help\s+me\s+(get\s+)?start/i],
    route: { label: 'Campaign Mastery A→Z', href: '/onboarding', action: 'campaign-mastery' },
  },
  {
    patterns: [/setup\s+wizard/i, /onboard/i, /brand\s+profile/i],
    route: { label: 'Setup Wizard', href: '/onboarding' },
  },
  {
    patterns: [/research\s+(my\s+)?brand/i, /auto[\s-]?fill\s+brand/i, /intelligent\s+setup/i],
    route: { label: 'Setup Wizard · Research Brand', href: '/onboarding', action: 'research-brand' },
  },
  {
    patterns: [/desktop\s+app/i, /download\s+app/i, /install\s+desktop/i, /electron/i, /windows\s+installer/i],
    route: { label: 'Download Desktop App', href: '/download' },
  },
  {
    patterns: [/\bneed\s+help\b/i, /\bget\s+help\b/i, /\bstuck\b/i, /troubleshoot/i, /live\s+support/i, /\bsupport\s+(page|workspace)\b/i],
    route: { label: 'Imperialism Brain', href: '/support' },
  },
  {
    patterns: [/guardian/i, /gatekeeper/i, /self[- ]?heal/i, /monitor/i, /webhook/i, /partner\s+api/i],
    route: { label: 'Guardian & API', href: '/settings?tab=guardian-api' },
  },
  {
    patterns: [/imperialism\s+brain/i, /omni[- ]?brain/i, /workflow\s+plan/i, /plan\s+(a\s+)?campaign/i, /create\s+(a\s+)?post/i, /find\s+people/i],
    route: { label: 'Imperialism Brain', href: '/dashboard' },
  },
];

export const QUICK_PROMPTS = [
  MASTERY_QUICK_PROMPTS[0],
  'Take me to Integrations',
  'Connect a platform',
  'Posts not scheduling',
  SEO_QUICK_PROMPTS[0],
  SEO_QUICK_PROMPTS[1],
  'What should I improve today?',
  'Research my brand in Setup Wizard',
];

export function buildConnectPlatformReply(): string {
  return [
    '**Connect a platform**',
    '',
    '1. **Account Hub** — OAuth for LinkedIn, X, Meta, Reddit, etc.',
    '2. **Integrations → Connections** — API keys (SerpAPI, Gemini/OpenRouter) if you have not added them yet.',
    '',
    'Taking you to **Account Hub** now.',
  ].join('\n');
}

export function buildSchedulingTroubleshootReply(): string {
  return [
    '**Posts not scheduling — fix checklist**',
    '',
    '1. **Account Hub** — platform must show **Connected** (not expired or needs relink).',
    '2. **Integrations → Live Probes** — publish/worker paths should be green.',
    '3. **Content Calendar** — item must be **Scheduled** with a future time (not Draft-only).',
    '4. **Scheduler** — worker enabled in Setup Wizard step 5.',
    '',
    'Opening **Calendar** first — verify pending/scheduled items.',
  ].join('\n');
}

export function buildAeoPlanScaffold(brandHint?: string): string {
  const niche = brandHint ? ` for **${brandHint}**` : '';
  return [
    `**AEO plan${niche}** (Answer Engine Optimization)`,
    '',
    '1. **Question map** — 10 buyer questions (who / what / how / best / vs / cost).',
    '2. **Snippet blocks** — 40–60 word direct answers under H2 question headers.',
    '3. **Schema** — FAQPage + HowTo on your top 3 money pages.',
    '4. **Inside Social Imperialism:**',
    '   - **Keywords** — add question-style terms',
    '   - **SEO Tools** — AEO framework scan',
    '   - **Content Hub** — publish FAQ posts',
    '   - **Quora Ops** — corroborating answers',
    '',
    'Connect **SerpAPI** in Integrations for live PAA/snippet data, then open SEO Tools.',
    '[[NAV:/seo-tools|SEO Tools]]',
  ].join('\n');
}

export function buildGeoAuditScaffold(brandHint?: string): string {
  const brand = brandHint ? ` for **${brandHint}**` : '';
  return [
    `**GEO visibility audit${brand}** (Generative Engine Optimization)`,
    '',
    '**Score these 5 surfaces** (1–5 each — aim for 4+):',
    '1. **Entity clarity** — consistent brand name, domain, and offer on site + socials.',
    '2. **Original data** — stats, benchmarks, or proprietary insights LLMs can cite.',
    '3. **Corroboration** — Quora, Reddit, LinkedIn posts echoing your core claims.',
    '4. **AI Overview readiness** — clear H2 answers, tables, and cited sources on money pages.',
    '5. **Multi-engine parity** — Bing/IndexNow + Google depth (not Google-only).',
    '',
    '**Fix loop in Social Imperialism:**',
    '- **SEO Tools** → GEO framework scan',
    '- **Content Hub** → publish cite-worthy research posts',
    '- **Quora Ops / Growth Lab** → seed third-party mentions',
    '- **Prompt Vault** → align reply tone with entity facts',
    '',
    'Connect **SerpAPI** for live AI Overview / SERP signals, then run GEO in SEO Tools.',
    '[[NAV:/seo-tools|SEO Tools]]',
  ].join('\n');
}

export function buildSeoIntelligenceFallback(query: string, brandHint?: string): string {
  const q = query.toLowerCase();
  if (/\bgeo\b|generative\s+engine|visibility\s+audit/i.test(q)) return buildGeoAuditScaffold(brandHint);
  if (/local\s+seo|near\s+me/i.test(q)) {
    return [
      `**Local SEO strategy${brandHint ? ` for **${brandHint}**` : ''}**`,
      '',
      '1. NAP consistency (name, address, phone) across site + profiles.',
      '2. City/service landing pages with map-pack keywords.',
      '3. Review velocity + GBP-style post cadence.',
      '[[NAV:/keywords|Keywords]]',
    ].join('\n');
  }
  if (/kgr/i.test(q)) {
    return 'Add monitored keywords in **Keywords** first, then run KGR in **SEO Tools**.\n\n[[NAV:/keywords|Keywords]]';
  }
  return buildAeoPlanScaffold(brandHint);
}

export function shouldAutoExecuteRoute(query: string): boolean {
  const q = query.trim();
  if (!q) return false;
  if (isSeoIntelligencePrompt(q)) return false;
  if (QUICK_PROMPTS.some((p) => p.toLowerCase() === q.toLowerCase())) return true;
  const route = resolveSearchRoute(q);
  if (route?.action === 'campaign-mastery' || route?.action === 'research-brand') {
    return false;
  }
  return !!route;
}

export function resolveSearchRoute(query: string): SearchRoute | null {
  const q = query.trim();
  if (!q) return null;
  if (isMasteryRequest(q)) {
    const mastery = SEARCH_ROUTES.find((e) => e.route.action === 'campaign-mastery');
    if (mastery) return mastery.route;
  }
  for (const entry of SEARCH_ROUTES) {
    if (entry.patterns.some((p) => p.test(q))) return entry.route;
  }
  return null;
}

export function requiresAdminApproval(text: string): boolean {
  return SENSITIVE_PATTERNS.some((p) => p.test(text));
}

export function inferModule(text: string): string {
  const t = text.toLowerCase();
  if (/integrat|oauth|connect|token/.test(t)) return 'Integrations Hub';
  if (/schedul|calendar|post/.test(t)) return 'Content Calendar';
  if (/reply|engagement/.test(t)) return 'AI Replies';
  if (/aeo|geo|local\s+seo|national\s+seo|kgr|serp|paa|snippet/.test(t)) return 'SEO Tools / Intelligence';
  if (/keyword|seo|discover/.test(t)) return 'Keywords / Discovery';
  if (/rule|automation|worker/.test(t)) return 'Auto-Rules';
  if (/billing|subscription|plan/.test(t)) return 'Settings / Billing';
  if (/reddit|quora|growth/.test(t)) return 'Growth Lab';
  return 'Mission Control';
}

export function createApprovalTicket(request: string): ApprovalTicket {
  const norm = normalizeApprovalRequest(request);
  const duplicate = readAllApprovals().find(
    (t) => t.status === 'pending' && normalizeApprovalRequest(t.request) === norm,
  );
  if (duplicate) return duplicate;

  const ticket: ApprovalTicket = {
    id: `apr_${Date.now()}`,
    request: request.slice(0, 500),
    module: inferModule(request),
    riskLevel: 'high',
    recommendedAction: 'Review in admin dashboard before enabling globally',
    rollbackNote: 'Disable rule and revert to manual_approval reply mode',
    status: 'pending',
    routedTo: ADMIN_IDENTITY,
    createdAt: new Date().toISOString(),
  };
  const existing = readAllApprovals();
  existing.unshift(ticket);
  writeAllApprovals(existing);
  return ticket;
}

export function getPendingApprovals(): ApprovalTicket[] {
  return readAllApprovals().filter((t) => t.status === 'pending');
}

export function getApprovalHistory(): ApprovalTicket[] {
  return readAllApprovals();
}

export function resolveApprovalTicket(
  ticketId: string,
  status: 'approved' | 'rejected' | 'routed',
  note?: string,
): ApprovalTicket | null {
  const tickets = readAllApprovals();
  const idx = tickets.findIndex((t) => t.id === ticketId);
  if (idx < 0) return null;
  tickets[idx] = { ...tickets[idx], status };
  writeAllApprovals(tickets);

  recordApprovalResolution(
    `approval_${ticketId}`,
    tickets[idx].module,
    status === 'approved' ? 'approved' : status === 'routed' ? 'routed' : 'denied',
    {
      body: tickets[idx].request,
      resumeHref: status === 'routed' ? '/settings?tab=guardian-api' : undefined,
      note: note || `Approval ticket ${status}`,
    },
  );

  return tickets[idx];
}

export function buildSupportPrompt(
  messages: SupportMessage[],
  userMessage: string,
  context?: { pathname?: string; seoIntel?: string; selfHealIntel?: string; onboardingIntel?: string; masteryIntel?: string },
): string {
  const history = messages
    .slice(-8)
    .map((m) => `${m.role === 'user' ? 'User' : 'Agent'}: ${m.content}`)
    .join('\n');
  const ctx = context?.pathname ? `\nCurrent page: ${context.pathname}` : '';
  const seoBlock = context?.seoIntel ? `\n${context.seoIntel}` : '';
  const healBlock = context?.selfHealIntel ? `\n${context.selfHealIntel}` : '';
  const onboardBlock = context?.onboardingIntel ? `\n${context.onboardingIntel}` : '';
  const masteryBlock = context?.masteryIntel ? `\n${context.masteryIntel}` : '';
  return `${LIVE_SUPPORT_SYSTEM_PROMPT}${THEE_MICHAEL_SEO_EXPERT_APPEND}${SELF_HEAL_EXPERT_APPEND}${ONBOARDING_EXPERT_APPEND}${MASTERY_EXPERT_APPEND}${OVERLORD_SYSTEM_APPEND}${ctx}${seoBlock}${healBlock}${onboardBlock}${masteryBlock}

Conversation:
${history}
User: ${userMessage}

Reply as the Imperialism Brain. Be concise. End with one clear next step or one focused question.`;
}

export function approvalAcknowledgement(ticket: ApprovalTicket): string {
  return `I prepared this for review and routed it to ${ticket.routedTo}. **Waiting on ${ticket.routedTo} approval.**\n\nTicket \`${ticket.id}\` · Module: ${ticket.module} · Risk: ${ticket.riskLevel}\n\nOnce approved, Social Imperialism can apply the update safely. You can keep working in draft or review mode meanwhile.`;
}