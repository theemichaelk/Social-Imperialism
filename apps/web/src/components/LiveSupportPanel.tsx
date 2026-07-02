'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { invoke } from '@/lib/api';
import {
  INIT_MESSAGE,
  QUICK_PROMPTS,
  approvalAcknowledgement,
  buildSupportPrompt,
  createApprovalTicket,
  getPendingApprovals,
  requiresAdminApproval,
  resolveSearchRoute,
  sanitizeAgentReply,
  type SupportMessage,
} from '@/lib/liveSupportAgent';
import {
  executeLiveSupportAction,
  parseAgentNavigateDirective,
  resolveNavigationIntent,
  searchRouteToAction,
  stripNavigateDirectives,
} from '@/lib/liveSupportActions';
import {
  guardedExecute,
  failTrace,
  ingestFile,
  ingestTextPayload,
  pushTrace,
  completeTrace,
  runIngestPipeline,
  redactSecrets,
} from '@/lib/theeMichaelOverlord';
import { executeGuideActions, planGuideActions } from '@/lib/guide_executor';
import { isNavigationRequest } from '@/lib/liveSupportActions';
import { isSeoRelatedQuery } from '@/lib/theeMichaelSeoExpert';
import { buildSeoAugmentedContext, fetchSeoBrief } from '@/lib/seoIntelligence';
import {
  buildSelfHealAugmentedContext,
  fetchDailyRecommendations,
  fetchSelfHealStatus,
  formatRecommendationsBanner,
  runSelfHealAudit,
} from '@/lib/selfHealIntelligence';
import { listEnclaveEntries } from '@/lib/overlordEnclave';
import { OverlordCognitiveTrace } from './OverlordCognitiveTrace';

const PANEL_KEY = 'si_support_panel_open';

export function LiveSupportPanel({ embedded = false }: { embedded?: boolean }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(embedded);
  const [messages, setMessages] = useState<SupportMessage[]>([
    { role: 'assistant', content: INIT_MESSAGE, ts: new Date().toISOString() },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [dragOver, setDragOver] = useState(false);
  const [showTrace, setShowTrace] = useState(true);
  const [dailyRecsBanner, setDailyRecsBanner] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!embedded) {
      try { setOpen(localStorage.getItem(PANEL_KEY) === '1'); } catch { /* ignore */ }
    }
    setPendingCount(getPendingApprovals().length);
  }, [embedded, open]);

  useEffect(() => {
    if (!open && !embedded) return;
    let cancelled = false;
    (async () => {
      const recs = await fetchDailyRecommendations();
      if (!cancelled) setDailyRecsBanner(formatRecommendationsBanner(recs));
    })();
    return () => { cancelled = true; };
  }, [open, embedded]);

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

    const navAction = resolveNavigationIntent(trimmed, { pathname, preferExecute: true });
    const route = resolveSearchRoute(trimmed);
    const userMsg: SupportMessage = { role: 'user', content: trimmed, ts: new Date().toISOString() };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setLoading(true);

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

      const wantsLiveGuide = isNavigationRequest(trimmed)
        || /don'?t\s+see|can'?t\s+find|prompt\s+vault|integrations|browse\s+posts|open\s+https?:\/\//i.test(trimmed);

      if (wantsLiveGuide) {
        try {
          const planned = await planGuideActions(trimmed, pathname);
          if (planned.actions.length) {
            const t = pushTrace('THEE_MICHAEL live action plan');
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

      if (navAction?.autoExecute) {
        const t = pushTrace(`Spatial navigation → ${navAction.label}`);
        executeLiveSupportAction(navAction);
        completeTrace(t);
        setMessages((prev) => [
          ...prev,
          {
            role: 'assistant',
            content: `${navAction.message || `Taking you to ${navAction.label}…`}\n\nYou should see **${navAction.label}** in the left sidebar. Tell me if the screen looks wrong and I will audit it.`,
            ts: new Date().toISOString(),
          },
        ]);
        return;
      }

      let seoIntel = '';
      if (isSeoRelatedQuery(trimmed)) {
        const tSeo = pushTrace('SEO Intelligence · live SERP pulse');
        const brief = await fetchSeoBrief(trimmed, pathname);
        seoIntel = buildSeoAugmentedContext(brief);
        completeTrace(tSeo);
      }

      const wantsImprovement = /improve|betterment|recommend|what\s+should\s+i|audit|optimize/i.test(trimmed);
      let selfHealIntel = '';
      if (wantsImprovement || seoIntel) {
        const tHeal = pushTrace('Self-heal · daily recommendations + journal');
        const status = await fetchSelfHealStatus();
        selfHealIntel = buildSelfHealAugmentedContext(status);
        completeTrace(tHeal);
      }

      const tAi = pushTrace(seoIntel || selfHealIntel ? 'Authority brief + self-heal synthesis' : 'Evaluating request with live context');
      const prompt = buildSupportPrompt(messages, redactSecrets(trimmed), { pathname, seoIntel, selfHealIntel });
      const reply = await invoke<string>('generate-ai', prompt);
      let raw = sanitizeAgentReply(String(reply || '').trim()) || 'Hmm — I did not get a response. Try again or open Integrations to check connections.';
      completeTrace(tAi);

      const directive = parseAgentNavigateDirective(raw);
      if (directive) {
        const tNav = pushTrace(`Executing [[NAV]] → ${directive.label}`);
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
  }, [loading, messages, pathname]);

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
      <button type="button" className="live-support-fab" onClick={toggle} title="THEE_MICHAEL Live Support">
        <span className="live-support-fab-icon">🛡️</span>
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
        <div>
          <p className="live-support-eyebrow">THEE_MICHAEL · Overlord Protocol</p>
          <h3 className="live-support-title">Imperialism Brain</h3>
        </div>
        <div className="live-support-header-actions">
          {pendingCount > 0 && (
            <span className="live-support-pending">Waiting on THEE_MICHAEL approval ({pendingCount})</span>
          )}
          <button
            type="button"
            className="live-support-trace-toggle"
            onClick={() => setShowTrace((s) => !s)}
            title="Toggle cognitive trace"
          >
            {showTrace ? 'Trace ▾' : 'Trace ▸'}
          </button>
          {!embedded && (
            <button type="button" className="live-support-close" onClick={toggle} aria-label="Close support">×</button>
          )}
        </div>
      </div>

      {showTrace && <OverlordCognitiveTrace compact />}

      {dailyRecsBanner && (
        <div className="live-support-daily-recs">
          <p className="live-support-daily-recs-body">{dailyRecsBanner}</p>
        </div>
      )}

      <div className="live-support-messages" ref={scrollRef}>
        {messages.map((m, i) => (
          <div key={i} className={`live-support-bubble ${m.role}`}>
            <div className="live-support-bubble-body">{m.content}</div>
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
          placeholder="Ask, navigate, or drop API docs / CSV keys…"
          disabled={loading}
          className="live-support-input"
        />
        <button type="submit" className="btn live-support-send" disabled={loading || !input.trim()}>Send</button>
      </form>

      <p className="live-support-footer">
        <Link href="/support">Full support workspace</Link>
        {' · '}
        <span className="live-support-drop-hint">Drag files here — secrets stay in session enclave</span>
      </p>
    </div>
  );
}