/**
 * Imperialism Brain (Live Support) — prompt, routing, and approval helpers.
 * Canonical doc: brain/LIVE_SUPPORT_AGENT.md
 */

import { OVERLORD_SYSTEM_APPEND } from '@/lib/theeMichaelOverlord';
import { THEE_MICHAEL_SEO_EXPERT_APPEND, SEO_QUICK_PROMPTS } from '@/lib/theeMichaelSeoExpert';
import { SELF_HEAL_EXPERT_APPEND } from '@/lib/selfHealIntelligence';

export const ADMIN_IDENTITY = 'THEE_MICHAEL';

export const INIT_MESSAGE =
  'Hey — welcome to Social Imperialism. I run daily self-audits, document errors with fixes, learn from them, and recommend improvements across SEO, content, engagement, and integrations. Ask "what should I improve today?" or any growth question.';

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
  status: 'pending' | 'approved' | 'rejected';
  routedTo: typeof ADMIN_IDENTITY;
  createdAt: string;
};

export type SearchRoute = {
  label: string;
  href: string;
  action?: string;
};

const APPROVAL_STORAGE_KEY = 'si_support_approvals';

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
    patterns: [/connect\s+platform/i, /\boauth\b/i, /integration/i, /expired\s+token/i],
    route: { label: 'Connect Platform', href: '/integrations' },
  },
  {
    patterns: [/reply\s+engine/i, /fix\s+reply/i, /ai\s+repl/i, /engagement\s+queue/i],
    route: { label: 'Review Replies', href: '/history' },
  },
  {
    patterns: [/campaign\s+not\s+post/i, /not\s+schedul/i, /calendar/i, /schedule\s+post/i],
    route: { label: 'Schedule Campaign', href: '/calendar' },
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
    patterns: [/setup\s+wizard/i, /onboard/i, /brand\s+profile/i],
    route: { label: 'Setup Wizard', href: '/onboarding' },
  },
  {
    patterns: [/desktop\s+app/i, /download\s+app/i, /install\s+desktop/i, /electron/i, /windows\s+installer/i],
    route: { label: 'Download Desktop App', href: '/download' },
  },
  {
    patterns: [/\bhelp\b/i, /\bsupport\b/i, /\bstuck\b/i, /troubleshoot/i],
    route: { label: 'Live Support', href: '/support' },
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
  'Take me to Integrations',
  'Open billing settings',
  'Connect a platform',
  'Posts not scheduling',
  'Ask THEE_MICHAEL',
  ...SEO_QUICK_PROMPTS.slice(0, 2),
  'What should I improve today?',
  'Research my brand in Setup Wizard',
];

export function resolveSearchRoute(query: string): SearchRoute | null {
  const q = query.trim();
  if (!q) return null;
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
  if (typeof window !== 'undefined') {
    try {
      const existing = JSON.parse(localStorage.getItem(APPROVAL_STORAGE_KEY) || '[]') as ApprovalTicket[];
      existing.unshift(ticket);
      localStorage.setItem(APPROVAL_STORAGE_KEY, JSON.stringify(existing.slice(0, 20)));
    } catch { /* ignore */ }
  }
  return ticket;
}

export function getPendingApprovals(): ApprovalTicket[] {
  if (typeof window === 'undefined') return [];
  try {
    return (JSON.parse(localStorage.getItem(APPROVAL_STORAGE_KEY) || '[]') as ApprovalTicket[])
      .filter((t) => t.status === 'pending');
  } catch {
    return [];
  }
}

export function buildSupportPrompt(
  messages: SupportMessage[],
  userMessage: string,
  context?: { pathname?: string; seoIntel?: string; selfHealIntel?: string },
): string {
  const history = messages
    .slice(-8)
    .map((m) => `${m.role === 'user' ? 'User' : 'Agent'}: ${m.content}`)
    .join('\n');
  const ctx = context?.pathname ? `\nCurrent page: ${context.pathname}` : '';
  const seoBlock = context?.seoIntel ? `\n${context.seoIntel}` : '';
  const healBlock = context?.selfHealIntel ? `\n${context.selfHealIntel}` : '';
  return `${LIVE_SUPPORT_SYSTEM_PROMPT}${THEE_MICHAEL_SEO_EXPERT_APPEND}${SELF_HEAL_EXPERT_APPEND}${OVERLORD_SYSTEM_APPEND}${ctx}${seoBlock}${healBlock}

Conversation:
${history}
User: ${userMessage}

Reply as the Imperialism Brain. Be concise. End with one clear next step or one focused question.`;
}

export function approvalAcknowledgement(ticket: ApprovalTicket): string {
  return `I prepared this for review and routed it to ${ticket.routedTo}. **Waiting on ${ticket.routedTo} approval.**\n\nTicket \`${ticket.id}\` · Module: ${ticket.module} · Risk: ${ticket.riskLevel}\n\nOnce approved, Social Imperialism can apply the update safely. You can keep working in draft or review mode meanwhile.`;
}