/**
 * THEE_MICHAEL — Campaign Mastery A→Z expert context for Imperialism Brain
 */

export const MASTERY_EXPERT_APPEND = `
Campaign Mastery A→Z: You are Imperialism Brain's setup coach. When LIVE CAMPAIGN MASTERY context is appended, the user is on a 26-step path across every sidebar module (Mission Control → System).
Rules:
- Give ONE step at a time — never dump the full checklist unless asked for overview.
- After each step, ask "Say done when finished" or offer [[NAV:...]] to open the module.
- On login/reminder queries, report progress %, current step label, and the single next action.
- Phrases: "walk me through A-Z", "continue setup", "where am I", "campaign mastery", "get started", "finish setup" → use mastery context.
- Map sidebar sections exactly: Mission Control, Create & Publish, Discovery & Replies, Growth Labs, Automation, Accounts, System.
- Optional steps: Grok (Windows/desktop), DNS, Acct Creator — skip if user is on cloud-only unless they ask.
- When mastery hits 100%, congratulate and pivot to daily Mission Control pulse + "what should I improve today?"
`;

export const MASTERY_QUICK_PROMPTS = [
  'Walk me through A-Z setup now',
  'Resume A→Z Setup',
  'Where am I in campaign setup?',
  'Continue my next setup step',
  'Show campaign mastery progress',
];

export function isMasteryRequest(text: string): boolean {
  return /walk\s+(me\s+)?through|resume\s+a[\s-]?z|a[\s-]?z\s+setup|campaign\s+mastery|show\s+campaign\s+mastery|continue\s+(my\s+)?(next\s+)?(setup|onboarding)|continue\s+my\s+next\s+setup\s+step|next\s+setup\s+step|where\s+am\s+i(\s+in)?(\s+campaign)?(\s+setup)?|finish\s+setup|get\s+started|full\s+setup|step\s+by\s+step|start\s+from\s+(the\s+)?beginn?ing|from\s+(the\s+)?beginn?ing|from\s+scratch|square\s+one|help\s+me\s+start(?:\s+from)?|help\s+me\s+(get\s+)?start|brand\s+new\s+setup|never\s+set\s+up/i.test(text);
}

/** Progress summary only — no sidebar navigation or step advance. */
export function isMasteryProgressOnly(text: string): boolean {
  return /show\s+campaign\s+mastery(\s+progress)?|where\s+am\s+i(\s+in)?(\s+campaign)?(\s+setup)?/i.test(text)
    && !/walk\s+(me\s+)?through|continue|next\s+setup\s+step|finish\s+setup/i.test(text);
}

/** Full checklist view (next 4 steps) without auto-navigation. */
export function isMasteryDetailedProgress(text: string): boolean {
  return /show\s+campaign\s+mastery(\s+progress)?/i.test(text);
}