'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { invoke } from '@/lib/api';
import {
  INIT_MESSAGE,
  INIT_MESSAGE_VERSION,
  buildSeoIntelligenceFallback,
  buildConnectPlatformReply,
  buildSchedulingTroubleshootReply,
  shouldAutoExecuteRoute,
  QUICK_PROMPTS,
  approvalAcknowledgement,
  buildSupportPrompt,
  createApprovalTicket,
  getPendingApprovals,
  resolveApprovalTicket,
  requiresAdminApproval,
  resolveSearchRoute,
  sanitizeAgentReply,
  type SupportMessage,
} from '@/lib/liveSupportAgent';
import {
  displayNavLabel,
  executeLiveSupportAction,
  parseAgentNavigateDirective,
  resolveNavigationIntent,
  searchRouteToAction,
  stripNavigateDirectives,
} from '@/lib/liveSupportActions';
import {
  guardedExecute,
  failTrace,
  formatNavigationTraceLabel,
  ingestFile,
  ingestTextPayload,
  pushTrace,
  completeTrace,
  runIngestPipeline,
  redactSecrets,
} from '@/lib/theeMichaelOverlord';
import { executeGuideActions, planGuideActions } from '@/lib/guide_executor';
import { isNavigationRequest } from '@/lib/liveSupportActions';
import { isSeoIntelligencePrompt, isSeoRelatedQuery } from '@/lib/theeMichaelSeoExpert';
import { buildSeoAugmentedContext, fetchSeoBrief } from '@/lib/seoIntelligence';
import {
  buildDailyImprovementReply,
  buildSelfHealAugmentedContext,
  fetchDailyRecommendations,
  fetchSelfHealStatus,
  isDailyImprovementRequest,
  parseDailyRecsPreview,
  recNavigationLabel,
  type DailyRecsPreview,
  runSelfHealAudit,
} from '@/lib/selfHealIntelligence';
import {
  researchBrandWithTheeMichael,
  fetchOnboardingContext,
} from '@/lib/onboardingIntelligence';
import {
  buildOnboardingAugmentedContext,
  extractDomainFromText,
  formatBrandResearchSummary,
  isBrandResearchRequest,
} from '@/lib/theeMichaelOnboardingExpert';
import {
  buildMasteryAugmentedContext,
  fetchCampaignMasteryStatus,
  markMasteryStep,
  planMasteryWalkthrough,
  startMasteryWalkthrough,
  buildMasteryProgressReply,
} from '@/lib/campaignMastery';
import { isMasteryDetailedProgress, isMasteryRequest, isMasteryProgressOnly } from '@/lib/theeMichaelMasteryExpert';
import { SI_NOTIFICATION_CHANGED } from '@/lib/theeMichaelNotificationLedger';
import { listEnclaveEntries } from '@/lib/overlordEnclave';
import { OverlordCognitiveTrace } from './OverlordCognitiveTrace';

const PANEL_KEY = 'si_support_panel_open';
const INIT_MSG_VERSION_KEY = 'si_support_init_version';

/** Renders assistant/user text with basic **bold** (no raw markdown in UI). */
function SupportMessageBody({ content }: { content: string }) {
  const parts: ReactNode[] = [];
  const re = /\*\*([^*]+)\*\*/g;
  let last = 0;
  let match: RegExpExecArray | null;
  let key = 0;
  while ((match = re.exec(content)) !== null) {
    if (match.index > last) parts.push(content.slice(last, match.index));
    parts.push(<strong key={key++}>{match[1]}</strong>);
    last = match.index + match[0].length;
  }
  if (last < content.length) parts.push(content.slice(last));
  return <div className="live-support-bubble-body">{parts.length ? parts : content}</div>;
}

export function LiveSupportPanel({ embedded = false }: { embedded?: boolean }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(embedded);
  const [messages, setMessages] = useState<SupportMessage[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const v = Number(localStorage.getItem(INIT_MSG_VERSION_KEY) || '0');
        if (v !== INIT_MESSAGE_VERSION) {
          localStorage.setItem(INIT_MSG_VERSION_KEY, String(INIT_MESSAGE_VERSION));
        }
      } catch { /* ignore */ }
    }
    return [{ role: 'assistant', content: INIT_MESSAGE, ts: new Date().toISOString() }];
  });
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [dragOver, setDragOver] = useState(false);
  const [showTrace, setShowTrace] = useState(false);
  const [dailyRecs, setDailyRecs] = useState<DailyRecsPreview | null>(null);
  const [dailyRecsDismissed, setDailyRecsDismissed] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!embedded) {
      try { setOpen(localStorage.getItem(PANEL_KEY) === '1'); } catch { /* ignore */ }
    }
    const refreshPending = () => setPendingCount(getPendingApprovals().length);
    refreshPending();
    window.addEventListener(SI_NOTIFICATION_CHANGED, refreshPending);
    return () => window.removeEventListener(SI_NOTIFICATION_CHANGED, refreshPending);
  }, [embedded, open]);

  useEffect(() => {
    if (!pathname.startsWith('/settings')) return;
    const tab = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('tab') : null;
    if (tab !== 'guardian-api') return;
    for (const ticket of getPendingApprovals()) {
      resolveApprovalTicket(ticket.id, 'routed', 'Opened THEE_MICHAEL Security Control for review');
    }
    setPendingCount(0);
  }, [pathname]);

  useEffect(() => {
    if (!open && !embedded) return;
    try {
      const dismissed = sessionStorage.getItem('si_daily_recs_dismissed');
      if (dismissed === new Date().toISOString().slice(0, 10)) setDailyRecsDismissed(true);
    } catch { /* ignore */ }
    let cancelled = false;
    (async () => {
      const recs = await fetchDailyRecommendations();
      if (!cancelled) setDailyRecs(parseDailyRecsPreview(recs));
    })();
    return () => { cancelled = true; };
  }, [open, embedded]);

  const dismissDailyRecs = useCallback(() => {
    setDailyRecsDismissed(true);
    try {
      sessionStorage.setItem('si_daily_recs_dismissed', new Date().toISOString().slice(0, 10));
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, loading]);

  const handleIngest = useCallback(async (file: File) => {
    setLoading(true);
    const t = pushTrace(`Ingesting ${file.name}`);
    try {
      const result = await ingestFile(file);
      runIngestPipeline(result);
      const enclave = listEnclaveEntries().slice(0, 3).map((e) => `${e.label} (${e.fingerprint})`).join(', ');
      setMessages((prev) => [
        ...prev,
        {
          role: 'user',
          content: `[File drop: ${file.name}]`,
          ts: new Date().toISOString(),
        },
        {
          role: 'assistant',
          content: `${result.summary}\n\n${enclave ? `Enclave fingerprints: ${enclave}\n\n` : ''}Navigating to the right module now — secrets never entered chat logs.`,
          ts: new Date().toISOString(),
        },
      ]);
      completeTrace(t);
    } catch (e) {
      failTrace(t, (e as Error).message);
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: `Ingest failed — ${(e as Error).message}`, ts: new Date().toISOString() },
      ]);
    } finally {
      setLoading(false);
    }
  }, []);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleIngest(file);
  }, [handleIngest]);

  const send = useCallback(async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || loading) return;

    const route = resolveSearchRoute(trimmed);
    const navAction = resolveNavigationIntent(trimmed, {
      pathname,
      preferExecute: isNavigationRequest(trimmed)
        || /take\s+me\s+to|open\s+|go\s+to/i.test(trimmed)
        || shouldAutoExecuteRoute(trimmed),
    });
    const userMsg: SupportMessage = { role: 'user', content: trimmed, ts: new Date().toISOString() };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    const dailyPick = /^[123]$/.test(trimmed) ? Number(trimmed) - 1 : -1;
    if (dailyPick >= 0 && dailyRecs?.items[dailyPick]) {
      const item = dailyRecs.items[dailyPick];
      const navLabel = recNavigationLabel(item);
      const t = pushTrace(formatNavigationTraceLabel(navLabel));
      executeLiveSupportAction({
        type: 'navigate',
        label: navLabel,
        href: item.href,
        autoExecute: true,
        message: `Opening ${navLabel}…`,
      });
      completeTrace(t);
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: `**${item.title}** — ${item.action}\n\nTaking you to **${navLabel}** now.`,
          ts: new Date().toISOString(),
        },
      ]);
      setLoading(false);
      return;
    }

    const wantsMastery = isMasteryRequest(trimmed) || /^(done|next\s+step|mark\s+done)$/i.test(trimmed);
    if (wantsMastery) {
      const tMastery = pushTrace('Imperialism Brain · Campaign Mastery A→Z');
      try {
        let mastery = await fetchCampaignMasteryStatus();
        if (/^(done|next\s+step|mark\s+done)$/i.test(trimmed) && mastery?.currentStep?.id) {
          mastery = await markMasteryStep(mastery.currentStep.id, true);
        }
        if (mastery) {
          if (isMasteryProgressOnly(trimmed)) {
            const progressReply = buildMasteryProgressReply(mastery, {
              detailed: isMasteryDetailedProgress(trimmed),
            });
            setMessages((prev) => [
              ...prev,
              {
                role: 'assistant',
                content: progressReply,
                ts: new Date().toISOString(),
              },
            ]);
          } else {
            const plan = planMasteryWalkthrough(mastery);
            await executeGuideActions(plan.actions);
            setMessages((prev) => [
              ...prev,
              {
                role: 'assistant',
                content: `${plan.reply}\n\nProgress: **${mastery.doneCount}/${mastery.totalSteps}** (${mastery.percent}%). Say **done** when finished to advance.`,
                ts: new Date().toISOString(),
              },
            ]);
          }
        } else {
          const reply = await startMasteryWalkthrough(null);
          setMessages((prev) => [
            ...prev,
            {
              role: 'assistant',
              content: reply || 'Starting A→Z at Setup Wizard — enter your brand domain.',
              ts: new Date().toISOString(),
            },
          ]);
        }
      } catch (e) {
        setMessages((prev) => [
          ...prev,
          { role: 'assistant', content: `Mastery walkthrough error — ${(e as Error).message}`, ts: new Date().toISOString() },
        ]);
      } finally {
        completeTrace(tMastery);
        setLoading(false);
      }
      return;
    }

    const wantsBrandResearch = isBrandResearchRequest(trimmed);
    if (wantsBrandResearch) {
      const tBrand = pushTrace('Imperialism Brain · brand research · web + SEO + module propagation');
      let domain = extractDomainFromText(trimmed);
      if (!domain) {
        try {
          const camp = await invoke<{ domain?: string }>('get-active-campaign');
          domain = camp?.domain?.trim() || null;
        } catch { /* optional */ }
      }
      if (!domain) {
        completeTrace(tBrand);
        setMessages((prev) => [
          ...prev,
          {
            role: 'assistant',
            content: 'I can research your brand and auto-fill every Setup Wizard field.\n\n**Reply with your domain** (e.g. `acme.com`) or enter it in Setup Wizard step 1, then tap **Imperialism Brain — Research & Auto-Fill from Web**.\n\nOpening Setup Wizard now.',
            ts: new Date().toISOString(),
          },
        ]);
        executeLiveSupportAction(searchRouteToAction({ label: 'Setup Wizard', href: '/onboarding' }, true));
        setLoading(false);
        return;
      }
      const result = await researchBrandWithTheeMichael(domain);
      completeTrace(tBrand);
      if (result) {
        setMessages((prev) => [
          ...prev,
          {
            role: 'assistant',
            content: `${formatBrandResearchSummary(result)}\n\n[[NAV:/onboarding|Setup Wizard]] — fields are pre-filled. Finish Integrations then Campaign Command.`,
            ts: new Date().toISOString(),
          },
        ]);
        executeLiveSupportAction(searchRouteToAction({ label: 'Setup Wizard', href: '/onboarding' }, true));
      } else {
        setMessages((prev) => [
          ...prev,
          {
            role: 'assistant',
            content: `Research failed for **${domain}** — open Setup Wizard and try again, or check Integrations for API keys.\n\n[[NAV:/onboarding|Setup Wizard]]`,
            ts: new Date().toISOString(),
          },
        ]);
      }
      setLoading(false);
      return;
    }

    if (isDailyImprovementRequest(trimmed)) {
      const tImprove = pushTrace('Daily improvement recommendations');
      try {
        let recs = await fetchDailyRecommendations();
        if (!recs?.items?.length) {
          const tAudit = pushTrace('Self-heal audit · generating daily recommendations');
          await runSelfHealAudit();
          completeTrace(tAudit);
          recs = await fetchDailyRecommendations();
        }
        const preview = parseDailyRecsPreview(recs);
        if (preview) setDailyRecs(preview);
        setMessages((prev) => [
          ...prev,
          {
            role: 'assistant',
            content: buildDailyImprovementReply(recs),
            ts: new Date().toISOString(),
          },
        ]);
      } catch (e) {
        setMessages((prev) => [
          ...prev,
          {
            role: 'assistant',
            content: `Could not load daily recommendations — ${(e as Error).message}. Try **run audit now**.`,
            ts: new Date().toISOString(),
          },
        ]);
      } finally {
        completeTrace(tImprove);
        setLoading(false);
      }
      return;
    }

    const wantsAudit = /run\s+(?:self[\s-]?)?audit|self[\s-]?heal\s+audit|audit\s+now|daily\s+audit/i.test(trimmed);

    if (wantsAudit) {
      const tAudit = pushTrace('Self-heal audit · Guardian + SEO rollup');
      const audit = await runSelfHealAudit();
      completeTrace(tAudit);
      const recs = audit.recommendations?.slice(0, 5) || [];
      const lines = recs.length
        ? recs.map((r, i) => `${i + 1}. **${r.title}** — ${r.action}`).join('\n')
        : 'Audit complete — no urgent items. Keep your daily SEO + engagement rhythm.';
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: `**Self-heal audit complete.**\n\n${lines}\n\nDocumented in error journal with learnings for next session.`,
          ts: new Date().toISOString(),
        },
      ]);
      setLoading(false);
      return;
    }

    const isBulkSetup = /set\s+up\s+(my\s+)?(entire\s+)?(agency|profile|account)/i.test(trimmed)
      || /from\s+this\s+(text|dump|payload)/i.test(trimmed);

    if (isBulkSetup && trimmed.length > 80) {
      const t = pushTrace('Protocol Beta: autonomous setup parse');
      const result = ingestTextPayload(trimmed);
      runIngestPipeline(result);
      completeTrace(t);
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: `${result.summary}\n\n**Autonomous setup** routed — ${result.keyCount} secrets sealed in session enclave. Review Integrations connections next.`,
          ts: new Date().toISOString(),
        },
      ]);
      setLoading(false);
      return;
    }

    if (isSeoIntelligencePrompt(trimmed) || (isSeoRelatedQuery(trimmed) && /plan|audit|strategy/i.test(trimmed))) {
      const tSeo = pushTrace('SEO Intelligence · live SERP pulse');
      let brandHint: string | undefined;
      try {
        const camp = await invoke<{ brandName?: string; domain?: string }>('get-active-campaign');
        brandHint = camp?.brandName || camp?.domain || undefined;
      } catch { /* optional */ }
      const brief = await fetchSeoBrief(trimmed, pathname);
      const seoIntel = buildSeoAugmentedContext(brief);
      completeTrace(tSeo);
      try {
        const tAi = pushTrace(/\bgeo\b/i.test(trimmed) ? 'GEO visibility audit synthesis' : 'SEO intelligence synthesis');
        const prompt = buildSupportPrompt(messages, redactSecrets(trimmed), {
          pathname,
          seoIntel,
          selfHealIntel: '',
          onboardingIntel: '',
          masteryIntel: '',
        });
        const reply = await invoke<string>('generate-ai', prompt);
        let raw = sanitizeAgentReply(String(reply || '').trim());
        completeTrace(tAi);
        if (!raw) raw = buildSeoIntelligenceFallback(trimmed, brandHint);
        const directive = parseAgentNavigateDirective(raw);
        if (directive) {
          executeLiveSupportAction(directive);
          raw = stripNavigateDirectives(raw);
          raw += `\n\n**${directive.label}** — opening now.`;
        } else {
          executeLiveSupportAction(searchRouteToAction({ label: 'SEO Tools', href: '/seo-tools' }, true));
        }
        setMessages((prev) => [...prev, { role: 'assistant', content: raw, ts: new Date().toISOString() }]);
      } catch (e) {
        setMessages((prev) => [
          ...prev,
          {
            role: 'assistant',
            content: `${buildSeoIntelligenceFallback(trimmed, brandHint)}\n\n_(Live AI unavailable — ${(e as Error).message})_`,
            ts: new Date().toISOString(),
          },
        ]);
        executeLiveSupportAction(searchRouteToAction({ label: 'SEO Tools', href: '/seo-tools' }, true));
      } finally {
        setLoading(false);
      }
      return;
    }

    const navHref = navAction?.href?.split('?')[0];
    const onSamePage = navHref && pathname.replace(/\/$/, '') === navHref;

    if (navAction?.autoExecute && !onSamePage) {
      const sidebarLabel = displayNavLabel(navAction);
      const t = pushTrace(formatNavigationTraceLabel(sidebarLabel));
      executeLiveSupportAction({ ...navAction, label: sidebarLabel });
      completeTrace(t);
      let content: string;
      if (route?.action === 'connect-platform') {
        content = buildConnectPlatformReply();
      } else if (route?.action === 'scheduling-troubleshoot') {
        content = buildSchedulingTroubleshootReply();
      } else {
        const tabHint = navAction.tab === 'connections'
          ? '\n\nOpen the **Connections** tab to add API keys and OAuth.'
          : navAction.href?.startsWith('/integrations')
            ? '\n\nUse **Connections** for API keys/OAuth and **Live Probes** to verify health.'
            : '';
        content = `${navAction.message || `Taking you to ${sidebarLabel}…`}\n\nYou should see **${sidebarLabel}** in the left sidebar.${tabHint} Tell me if the screen looks wrong and I will audit it.`;
      }
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content, ts: new Date().toISOString() },
      ]);
      setLoading(false);
      return;
    }

    try {
      if (requiresAdminApproval(trimmed)) {
        guardedExecute('Sensitive change request', trimmed, () => {
          const ticket = createApprovalTicket(trimmed);
          setPendingCount(getPendingApprovals().length);
          setMessages((prev) => [
            ...prev,
            { role: 'assistant', content: approvalAcknowledgement(ticket), ts: new Date().toISOString() },
          ]);
        });
        setLoading(false);
        return;
      }

      const wantsLiveGuide = /don'?t\s+see|can'?t\s+find|prompt\s+vault|open\s+https?:\/\//i.test(trimmed)
        || (!/take\s+me\s+to|go\s+to|open\s+(?:the\s+)?\w/i.test(trimmed) && /integrations|browse\s+posts/i.test(trimmed));

      if (wantsLiveGuide) {
        try {
          const planned = await planGuideActions(trimmed, pathname);
          if (planned.actions.length) {
            const t = pushTrace('Imperialism Brain · live action plan');
            await executeGuideActions(planned.actions);
            completeTrace(t);
            setMessages((prev) => [
              ...prev,
              {
                role: 'assistant',
                content: planned.reply || 'Live actions executed.',
                ts: new Date().toISOString(),
              },
            ]);
            return;
          }
        } catch {
          /* fall through to legacy nav */
        }
      }

      let seoIntel = '';
      if (isSeoRelatedQuery(trimmed)) {
        const tSeo = pushTrace('SEO Intelligence · live SERP pulse');
        const brief = await fetchSeoBrief(trimmed, pathname);
        seoIntel = buildSeoAugmentedContext(brief);
        completeTrace(tSeo);
      }

      const wantsImprovement = /improve|betterment|recommend|what\s+should\s+i|audit|optimize/i.test(trimmed);
      const wantsOnboarding = /setup|onboard|brand|wizard|campaign\s+command/i.test(trimmed);
      let selfHealIntel = '';
      if (wantsImprovement || seoIntel) {
        const tHeal = pushTrace('Self-heal · daily recommendations + journal');
        const status = await fetchSelfHealStatus();
        selfHealIntel = buildSelfHealAugmentedContext(status);
        completeTrace(tHeal);
      }

      let onboardingIntel = '';
      if (wantsOnboarding) {
        const tOb = pushTrace('Onboarding context · module wiring status');
        const obCtx = await fetchOnboardingContext();
        onboardingIntel = buildOnboardingAugmentedContext(obCtx);
        completeTrace(tOb);
      }

      let masteryIntel = '';
      const tMasteryCtx = pushTrace('Campaign Mastery progress snapshot');
      const masteryStatus = await fetchCampaignMasteryStatus();
      masteryIntel = buildMasteryAugmentedContext(masteryStatus);
      completeTrace(tMasteryCtx);

      const tAi = pushTrace(seoIntel || selfHealIntel || onboardingIntel || masteryIntel ? 'Authority brief + live context synthesis' : 'Evaluating request with live context');
      const prompt = buildSupportPrompt(messages, redactSecrets(trimmed), { pathname, seoIntel, selfHealIntel, onboardingIntel, masteryIntel });
      const reply = await invoke<string>('generate-ai', prompt);
      let raw = sanitizeAgentReply(String(reply || '').trim()) || 'Hmm — I did not get a response. Try again or open Integrations to check connections.';
      completeTrace(tAi);

      const directive = parseAgentNavigateDirective(raw);
      if (directive) {
        const tNav = pushTrace(formatNavigationTraceLabel(directive.label));
        executeLiveSupportAction(directive);
        completeTrace(tNav);
        raw = stripNavigateDirectives(raw);
      } else if (route) {
        executeLiveSupportAction(searchRouteToAction(route, true));
      }

      let content = raw;
      if (directive) {
        content += `\n\n**${directive.label}** — navigating now.`;
      } else if (route && !navAction) {
        content += `\n\n**${route.label}** — opening now.`;
      }

      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content, ts: new Date().toISOString() },
      ]);
    } catch (e) {
      if (navAction || route) {
        const fallback = navAction || (route ? searchRouteToAction(route, true) : null);
        if (fallback) executeLiveSupportAction(fallback);
      }
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: navAction || route
            ? `AI hiccup — still taking you to ${(navAction || route)!.label}. ${(e as Error).message}`
            : `Connection hiccup — ${(e as Error).message}. Check Integrations Hub or try again in a moment.`,
          ts: new Date().toISOString(),
        },
      ]);
    } finally {
      setLoading(false);
    }
  }, [loading, messages, pathname, dailyRecs]);

  const toggle = useCallback(() => {
    setOpen((o) => {
      const next = !o;
      if (!embedded) {
        try { localStorage.setItem(PANEL_KEY, next ? '1' : '0'); } catch { /* ignore */ }
      }
      return next;
    });
  }, [embedded]);

  if (!embedded && !open) {
    return (
      <button type="button" className="live-support-fab" onClick={toggle} title="Imperialism Brain · Live Support">
        <span className="live-support-fab-icon" aria-hidden>🧠</span>
        {pendingCount > 0 && <span className="live-support-fab-badge">{pendingCount}</span>}
      </button>
    );
  }

  return (
    <div
      className={`live-support-panel ${embedded ? 'live-support-embedded' : ''} ${dragOver ? 'live-support-drag-over' : ''}`}
      onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={onDrop}
    >
      <div className="live-support-header">
        <div className="live-support-header-brand">
          <div className="imperialism-brain-badge live-support-header-badge" title="Imperialism Brain">
            <span className="imperialism-brain-icon" aria-hidden>🧠</span>
          </div>
          <div>
            <p className="live-support-eyebrow">Live Support</p>
            <h3 className="live-support-title">Imperialism Brain</h3>
            <p className="live-support-sub">Setup, troubleshooting, SEO intelligence, and growth guidance</p>
          </div>
        </div>
        <div className="live-support-header-actions">
          {pendingCount > 0 && (
            <span className="live-support-pending">Admin approval pending ({pendingCount})</span>
          )}
          <button
            type="button"
            className="live-support-trace-toggle"
            onClick={() => setShowTrace((s) => !s)}
            aria-expanded={showTrace}
            aria-label={showTrace ? 'Hide live trace' : 'Show live trace'}
            title="Live trace — steps while Brain navigates, audits, or ingests files (optional)"
          >
            {showTrace ? 'Trace ▾' : 'Trace ▸'}
          </button>
          {!embedded && (
            <button type="button" className="live-support-close" onClick={toggle} aria-label="Close Imperialism Brain panel" title="Close">×</button>
          )}
        </div>
      </div>

      {showTrace && (
        <div className="live-support-activity-panel">
          <OverlordCognitiveTrace compact showEmptyHint />
        </div>
      )}

      {dailyRecs && !dailyRecsDismissed && (
        <div className="live-support-daily-recs">
          <div className="live-support-daily-recs-head">
            <span className="live-support-daily-recs-title">
              Today&apos;s top improvements ({dailyRecs.dateLabel})
            </span>
            <button type="button" className="live-support-daily-recs-dismiss" onClick={dismissDailyRecs} aria-label="Dismiss daily tips">
              ×
            </button>
          </div>
          <ol className="live-support-daily-recs-list">
            {dailyRecs.items.map((r, i) => (
              <li key={`${r.category}-${r.title}`}>
                <button
                  type="button"
                  className="live-support-daily-recs-item"
                  onClick={() => send(String(i + 1))}
                  disabled={loading}
                  title={r.action}
                >
                  <span className="live-support-daily-recs-num">{i + 1}.</span>
                  <strong>{r.title}</strong>
                  <span> — {r.action}</span>
                </button>
              </li>
            ))}
          </ol>
        </div>
      )}

      <div className="live-support-messages" ref={scrollRef}>
        {messages.map((m, i) => (
          <div key={i} className={`live-support-bubble ${m.role}`}>
            <SupportMessageBody content={m.content} />
          </div>
        ))}
        {loading && <div className="live-support-bubble assistant"><div className="live-support-typing">Thinking…</div></div>}
      </div>

      <div className="live-support-quick">
        {QUICK_PROMPTS.map((q) => (
          <button key={q} type="button" className="live-support-chip" onClick={() => send(q)} disabled={loading}>
            {q}
          </button>
        ))}
      </div>

      <form
        className="live-support-input-row"
        onSubmit={(e) => { e.preventDefault(); send(input); }}
      >
        <input
          ref={fileRef}
          type="file"
          accept=".txt,.csv,.json,.md,.env,.tsv"
          className="live-support-file-input"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleIngest(f);
            e.target.value = '';
          }}
        />
        <button
          type="button"
          className="btn live-support-attach"
          onClick={() => fileRef.current?.click()}
          disabled={loading}
          title="Drop API sheet, .env, CSV, or config"
        >
          📎
        </button>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask anything, navigate, or attach keys (📎)…"
          aria-label="Message Imperialism Brain — ask a question, request navigation, or attach API keys with the paperclip"
          disabled={loading}
          className="live-support-input"
        />
        <button
          type="submit"
          className={`btn live-support-send${input.trim() ? ' primary' : ''}`}
          disabled={loading || !input.trim()}
          aria-label={input.trim() ? 'Send message' : 'Type a message to send'}
          title={input.trim() ? 'Send (Enter)' : 'Type a message or use a quick action above'}
        >
          {loading ? '…' : 'Send'}
        </button>
      </form>

      {!embedded && (
        <p className="live-support-footer">
          <Link href="/support">Open full support workspace</Link>
          <span className="live-support-drop-hint"> · 📎 attach or drag API keys onto this panel</span>
        </p>
      )}
    </div>
  );
}