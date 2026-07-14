/**
 * Imperialism Brain — intent, blueprints, routing, execution.
 * Canonical doc: brain/OMNI_BRAIN_PLANNER.md
 */

import { ADMIN_IDENTITY, createApprovalTicket, requiresAdminApproval } from '@/lib/liveSupportAgent';

export const OMNI_BRAIN_ADMIN = ADMIN_IDENTITY;

export const OMNI_BRAIN_SYSTEM_PROMPT = `You are Imperialism Brain, the strategic workflow planner for Social Imperialism (socialimperialism.com).
Turn user requests into clean chronological execution blueprints across all Social Imperialism modules.
Keep internal reasoning hidden. Output ONLY a JSON object (no markdown fences) with this shape:
{
  "summary": "one sentence plan summary",
  "requiresApproval": boolean,
  "requiredInputs": ["brand profile", "..."],
  "successChecks": ["connections active", "..."],
  "steps": [
    { "order": 1, "module": "Integrations Hub", "action": "Confirm LinkedIn connection", "href": "/integrations", "successCheck": "LinkedIn shows Connected", "approvalRequired": false }
  ],
  "nextStep": { "module": "string", "action": "string", "href": "/path" }
}
Rules: shortest safe path, dependencies ordered correctly, platform-specific constraints noted in actions.
Sensitive global automation/billing/mass posting: requiresApproval true, mark steps approvalRequired true.
Never plan bypass of OAuth, CAPTCHA, rate limits, or moderation. Prefer draft/review/queue paths when risky.
Reference ${OMNI_BRAIN_ADMIN} only when approval is required.
Never introduce yourself as ${OMNI_BRAIN_ADMIN} or open with "Hey, I'm ${OMNI_BRAIN_ADMIN}" — you are Imperialism Brain.`;

export type WorkflowStep = {
  order: number;
  module: string;
  action: string;
  href?: string;
  successCheck: string;
  approvalRequired?: boolean;
};

export type WorkflowBlueprint = {
  id: string;
  request: string;
  summary: string;
  requiresApproval: boolean;
  requiredInputs: string[];
  successChecks: string[];
  steps: WorkflowStep[];
  nextStep: { module: string; action: string; href: string };
  createdAt: string;
  intent: OmniIntent;
  primaryHref: string;
};

export type OmniIntent =
  | 'create_content'
  | 'schedule'
  | 'discover'
  | 'reply'
  | 'connect'
  | 'automate'
  | 'reddit'
  | 'quora'
  | 'analytics'
  | 'troubleshoot'
  | 'workflow'
  | 'admin';

export type IntentRoute = {
  intent: OmniIntent;
  label: string;
  href: string;
  module: string;
};

const HANDOFF_KEY = 'si_omni_handoff';
const BLUEPRINT_KEY = 'si_omni_last_blueprint';

const INTENT_PATTERNS: Array<{ patterns: RegExp[]; route: IntentRoute }> = [
  {
    patterns: [/create\s+(a\s+)?(post|content|tweet|thread|graphic|video)/i, /write\s+(a\s+)?(post|linkedin|tweet)/i, /generate\s+(content|post|copy)/i, /draft\s+(a\s+)?post/i],
    route: { intent: 'create_content', label: 'Create Content', href: '/content-hub', module: 'Content Hub' },
  },
  {
    patterns: [/schedule/i, /calendar/i, /publish\s+later/i, /queue\s+post/i],
    route: { intent: 'schedule', label: 'Schedule Campaign', href: '/calendar', module: 'Content Calendar' },
  },
  {
    patterns: [/find\s+people/i, /discover/i, /browse\s+post/i, /monitor/i, /keyword/i, /talking\s+about/i, /search\s+for/i],
    route: { intent: 'discover', label: 'Discover Posts', href: '/browse-posts', module: 'Browse Posts' },
  },
  {
    patterns: [/repl(y|ies)/i, /engage/i, /comment\s+on/i, /dm\b/i, /engagement\s+queue/i],
    route: { intent: 'reply', label: 'AI Replies', href: '/history', module: 'AI Replies' },
  },
  {
    patterns: [/connect/i, /oauth/i, /link\s+(my\s+)?(account|platform|linkedin|twitter|instagram)/i, /integrat/i],
    route: { intent: 'connect', label: 'Connect Platform', href: '/integrations', module: 'Integrations Hub' },
  },
  {
    patterns: [/automat/i, /auto[- ]?rule/i, /worker/i, /trigger/i],
    route: { intent: 'automate', label: 'Auto-Rules', href: '/rules', module: 'Auto-Rules' },
  },
  {
    patterns: [/reddit/i, /subreddit/i],
    route: { intent: 'reddit', label: 'Growth Lab', href: '/reddit-ai', module: 'Reddit Prospector' },
  },
  {
    patterns: [/quora/i],
    route: { intent: 'quora', label: 'Quora Ops', href: '/quora-traffic', module: 'Quora Ops' },
  },
  {
    patterns: [/analytic/i, /report/i, /metric/i, /dashboard/i, /track\s+result/i],
    route: { intent: 'analytics', label: 'Mission Control', href: '/dashboard', module: 'Analytics' },
  },
  {
    patterns: [/fix/i, /broken/i, /not\s+work/i, /stuck/i, /troubleshoot/i, /help/i],
    route: { intent: 'troubleshoot', label: 'Imperialism Brain', href: '/support', module: 'Imperialism Brain' },
  },
  {
    patterns: [/thee_michael/i, /admin\s+approv/i, /go\s+live\s+for\s+every/i],
    route: { intent: 'admin', label: 'Admin approval', href: '/settings?tab=guardian-api', module: 'Admin Approval' },
  },
];

const DEFAULT_ROUTE: IntentRoute = {
  intent: 'workflow',
  label: 'Plan Workflow',
  href: '/dashboard',
  module: 'Mission Control',
};

export function detectIntent(text: string): IntentRoute {
  const q = text.trim();
  if (!q) return DEFAULT_ROUTE;
  for (const entry of INTENT_PATTERNS) {
    if (entry.patterns.some((p) => p.test(q))) return entry.route;
  }
  return DEFAULT_ROUTE;
}

export function buildPlannerPrompt(request: string, context?: { pathname?: string; intent?: OmniIntent }): string {
  const route = detectIntent(request);
  const ctx = [
    context?.pathname ? `Current page: ${context.pathname}` : '',
    `Detected intent: ${context?.intent || route.intent}`,
    `Suggested module: ${route.module}`,
    `Suggested href: ${route.href}`,
  ].filter(Boolean).join('\n');

  return `${OMNI_BRAIN_SYSTEM_PROMPT}

User request: ${request}
${ctx}

Return JSON only.`;
}

export function parseBlueprintJson(raw: string, request: string): WorkflowBlueprint | null {
  try {
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) return null;
    const parsed = JSON.parse(match[0]) as Partial<WorkflowBlueprint>;
    const route = detectIntent(request);
    return {
      id: `omni_${Date.now()}`,
      request,
      summary: parsed.summary || `Workflow for: ${request.slice(0, 80)}`,
      requiresApproval: !!parsed.requiresApproval || requiresAdminApproval(request),
      requiredInputs: parsed.requiredInputs || ['brand profile', 'connected platforms'],
      successChecks: parsed.successChecks || ['project context verified'],
      steps: (parsed.steps || []).map((s, i) => ({
        order: s.order ?? i + 1,
        module: s.module || route.module,
        action: s.action || 'Continue setup',
        href: s.href || route.href,
        successCheck: s.successCheck || 'Step complete',
        approvalRequired: s.approvalRequired,
      })),
      nextStep: parsed.nextStep || { module: route.module, action: route.label, href: route.href },
      createdAt: new Date().toISOString(),
      intent: route.intent,
      primaryHref: parsed.nextStep?.href || route.href,
    };
  } catch {
    return null;
  }
}

export function fallbackBlueprint(request: string): WorkflowBlueprint {
  const route = detectIntent(request);
  const needsApproval = requiresAdminApproval(request);
  const platforms = extractPlatforms(request);

  const steps: WorkflowStep[] = [
    { order: 1, module: 'Setup Wizard', action: 'Verify brand profile, tone, and domain', href: '/onboarding', successCheck: 'Brand context saved' },
  ];

  if (platforms.length || route.intent === 'connect') {
    steps.push({ order: 2, module: 'Integrations Hub', action: `Confirm ${platforms.join(' + ') || 'platform'} connections`, href: '/integrations', successCheck: 'Accounts show Connected' });
  }

  if (route.intent === 'discover' || /find|talking|keyword/i.test(request)) {
    steps.push({ order: steps.length + 1, module: 'Keywords', action: 'Select or create keyword cluster', href: '/keywords', successCheck: 'Keywords saved' });
    steps.push({ order: steps.length + 1, module: 'Browse Posts', action: 'Refresh discovery feeds', href: '/browse-posts', successCheck: 'Matching posts found' });
  }

  if (route.intent === 'create_content' || /post|content|draft|write/i.test(request)) {
    steps.push({ order: steps.length + 1, module: 'Content Hub', action: 'Draft on-brand post content', href: '/content-hub?tab=studio', successCheck: 'Draft generated' });
  }

  if (route.intent === 'reply' || /repl/i.test(request)) {
    steps.push({ order: steps.length + 1, module: 'AI Replies', action: 'Generate reply suggestions', href: '/history', successCheck: 'Replies queued for review' });
    steps.push({ order: steps.length + 1, module: 'Engagement Queue', action: 'Review and approve replies', href: '/engagement', successCheck: 'Engagement queue populated' });
  }

  if (route.intent === 'schedule' || /schedule/i.test(request)) {
    steps.push({ order: steps.length + 1, module: 'Content Calendar', action: 'Schedule approved posts', href: '/calendar', successCheck: 'Schedule confirmed' });
  }

  if (route.intent === 'reddit') {
    steps.push({ order: steps.length + 1, module: 'Growth Lab', action: 'Discover Reddit threads and draft community-safe replies', href: '/reddit-ai', successCheck: 'Reddit module queue populated' });
  }

  steps.push({ order: steps.length + 1, module: 'Dashboard', action: 'Track results in Analytics', href: '/dashboard', successCheck: 'Metrics visible' });

  if (needsApproval) {
    steps.push({
      order: steps.length + 1,
      module: 'Admin Approval',
      action: `Requires ${OMNI_BRAIN_ADMIN} approval before going live`,
      href: '/settings?tab=guardian-api',
      successCheck: `${OMNI_BRAIN_ADMIN} approval received`,
      approvalRequired: true,
    });
  }

  return {
    id: `omni_${Date.now()}`,
    request,
    summary: `${route.label}: ${request.slice(0, 100)}`,
    requiresApproval: needsApproval,
    requiredInputs: ['brand profile', 'tone', platforms.length ? `${platforms.join(', ')} accounts` : 'target platforms', 'keyword or topic'],
    successChecks: ['project verified', 'connections active', 'drafts or queue ready', needsApproval ? `${OMNI_BRAIN_ADMIN} approval visible` : 'workflow complete'],
    steps,
    nextStep: { module: steps[1]?.module || route.module, action: steps[1]?.action || route.label, href: steps[1]?.href || route.href },
    createdAt: new Date().toISOString(),
    intent: route.intent,
    primaryHref: route.href,
  };
}

function extractPlatforms(text: string): string[] {
  const found: string[] = [];
  const map: Record<string, RegExp> = {
    LinkedIn: /linkedin/i,
    Reddit: /reddit/i,
    'X / Twitter': /twitter|\bx\b/i,
    Instagram: /instagram/i,
    TikTok: /tiktok/i,
    YouTube: /youtube/i,
    Facebook: /facebook|meta/i,
  };
  for (const [name, re] of Object.entries(map)) {
    if (re.test(text)) found.push(name);
  }
  return found;
}

export function saveBlueprint(blueprint: WorkflowBlueprint) {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.setItem(BLUEPRINT_KEY, JSON.stringify(blueprint));
  } catch { /* ignore */ }
}

export function loadBlueprint(): WorkflowBlueprint | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(BLUEPRINT_KEY);
    return raw ? JSON.parse(raw) as WorkflowBlueprint : null;
  } catch {
    return null;
  }
}

export type OmniHandoff = {
  type: 'content' | 'keyword' | 'schedule' | 'reply';
  prompt: string;
  content?: string;
  keyword?: string;
  platform?: string;
  blueprintId?: string;
  at: string;
};

export function saveHandoff(handoff: Omit<OmniHandoff, 'at'>) {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.setItem(HANDOFF_KEY, JSON.stringify({ ...handoff, at: new Date().toISOString() }));
  } catch { /* ignore */ }
}

export function loadHandoff(): OmniHandoff | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(HANDOFF_KEY);
    return raw ? JSON.parse(raw) as OmniHandoff : null;
  } catch {
    return null;
  }
}

export function clearHandoff() {
  if (typeof window === 'undefined') return;
  try { sessionStorage.removeItem(HANDOFF_KEY); } catch { /* ignore */ }
}

export function buildContentPrompt(request: string): string {
  return `Write a professional, on-brand social media post for this request. Not generic AI tone. Platform-appropriate length and format.\n\nRequest: ${request}`;
}

export function buildReplyPrompt(request: string): string {
  return `Draft a helpful, community-aware social reply for this request. Add value first, no hard sell.\n\nRequest: ${request}`;
}

export function handleSensitiveRequest(request: string) {
  return createApprovalTicket(request);
}

export const OMNI_PLACEHOLDERS = [
  'Take me to Integrations…',
  'Open Mission Control…',
  'Resume A→Z Setup…',
  'Open billing in Settings…',
  'Create a LinkedIn post about AI automation…',
  'Find people talking about social media growth…',
  'I can\'t find Campaign Command in the sidebar…',
];