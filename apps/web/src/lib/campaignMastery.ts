import { invoke } from '@/lib/api';
import { executeGuideActions, type GuideAction } from '@/lib/guide_executor';

export type MasteryStep = {
  id: string;
  phase: string;
  section: string;
  label: string;
  href: string;
  navId?: string;
  tab?: string;
  instructions: string[];
  order: number;
  done: boolean;
  autoDone?: boolean;
  manualDone?: boolean;
  status: 'complete' | 'pending';
};

export type CampaignMasteryStatus = {
  success?: boolean;
  campaignId?: string;
  campaignName?: string;
  steps: MasteryStep[];
  doneCount: number;
  totalSteps: number;
  percent: number;
  currentStep: MasteryStep;
  currentIndex: number;
  complete: boolean;
  phases: string[];
  requiredDone?: number;
  requiredTotal?: number;
  signals?: {
    apisConnected?: number;
    keywordCount?: number;
    linkedAccountsCount?: number;
  };
};

const REMINDER_KEY = 'si_mastery_reminder_dismissed';
const LAST_STEP_KEY = 'si_mastery_last_step';

export async function fetchCampaignMasteryStatus(): Promise<CampaignMasteryStatus | null> {
  try {
    const res = await invoke<CampaignMasteryStatus>('get-campaign-mastery-status');
    return res?.steps?.length ? res : null;
  } catch {
    return null;
  }
}

export async function markMasteryStep(stepId: string, done = true) {
  return invoke<CampaignMasteryStatus>('mark-campaign-mastery-step', { stepId, done });
}

export function rememberMasteryStep(stepId: string) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(LAST_STEP_KEY, stepId);
  } catch { /* ignore */ }
}

export function getRememberedMasteryStep(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return localStorage.getItem(LAST_STEP_KEY);
  } catch {
    return null;
  }
}

export function isMasteryReminderDismissed(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return sessionStorage.getItem(REMINDER_KEY) === '1';
  } catch {
    return false;
  }
}

export function dismissMasteryReminderForSession() {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.setItem(REMINDER_KEY, '1');
  } catch { /* ignore */ }
}

export function buildMasteryAugmentedContext(status: CampaignMasteryStatus | null): string {
  if (!status?.steps?.length) return '';
  const current = status.currentStep;
  const nextThree = status.steps.filter((s) => !s.done).slice(0, 3);
  return `LIVE CAMPAIGN MASTERY (THEE_MICHAEL A→Z):
Campaign: ${status.campaignName || 'active'} · Progress: ${status.doneCount}/${status.totalSteps} (${status.percent}%)
Current step: ${current?.order}. ${current?.label} — ${current?.phase}
Instructions: ${(current?.instructions || []).join(' → ')}
Next modules: ${nextThree.map((s) => s.label).join(', ') || 'Complete'}
When user asks to continue setup, walk A→Z, or where they left off — give ONLY the current step actions, then offer [[NAV:${current?.href}|${current?.label}]].`;
}

export function planMasteryWalkthrough(status: CampaignMasteryStatus): { actions: GuideAction[]; reply: string } {
  const step = status.currentStep;
  if (!step) {
    return {
      actions: [{ type: 'navigate', href: '/onboarding', label: 'Setup Wizard', navId: 'onboarding', sectionId: 'create' }],
      reply: 'Starting **A→Z Campaign Mastery** at Setup Wizard — enter your brand domain first.',
    };
  }
  rememberMasteryStep(step.id);
  const actions: GuideAction[] = [
    { type: 'message', text: `THEE_MICHAEL A→Z · Step ${step.order}/${status.totalSteps}: ${step.label}` },
    { type: 'disable_simple_mode' },
  ];
  if (step.navId) {
    const sectionMap: Record<string, string> = {
      dashboard: 'mission', 'browse-posts': 'mission', onboarding: 'create', 'content-hub': 'create',
      'content-library': 'create', 'design-studio': 'create', brand: 'create', calendar: 'create',
      scheduler: 'create', 'prompt-vault': 'discovery', engagement: 'discovery', history: 'discovery',
      keywords: 'discovery', 'seo-tools': 'discovery', 'reddit-ai': 'labs', 'quora-traffic': 'labs',
      automations: 'automation', rules: 'automation', 'account-hub': 'accounts', 'account-creator': 'accounts',
      'campaign-manager': 'system', integrations: 'system', settings: 'system', dns: 'system', support: 'system',
    };
    const sectionId = sectionMap[step.navId] || 'system';
    actions.push({ type: 'expand_sidebar_section', sectionId });
    actions.push({
      type: 'navigate',
      href: step.href,
      label: step.label,
      navId: step.navId,
      sectionId,
      tab: step.tab,
    });
    actions.push({ type: 'highlight', navId: step.navId, sectionId, ms: 4000 });
    actions.push({ type: 'flash_screen' });
  }
  const instr = step.instructions.map((line, i) => `${i + 1}. ${line}`).join('\n');
  return {
    actions,
    reply: `**Step ${step.order} of ${status.totalSteps}** — ${step.label} (${step.phase})\n\n${instr}\n\nTaking you there now. Say **"done"** when finished and I'll advance to the next module.`,
  };
}

export async function startMasteryWalkthrough(status?: CampaignMasteryStatus | null) {
  const st = status || await fetchCampaignMasteryStatus();
  if (!st) return null;
  const plan = planMasteryWalkthrough(st);
  await executeGuideActions(plan.actions);
  return plan.reply;
}