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
  type SupportMessage,
} from '@/lib/liveSupportAgent';

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
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!embedded) {
      try { setOpen(localStorage.getItem(PANEL_KEY) === '1'); } catch { /* ignore */ }
    }
    setPendingCount(getPendingApprovals().length);
  }, [embedded, open]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, loading]);

  const send = useCallback(async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || loading) return;

    const route = resolveSearchRoute(trimmed);
    const userMsg: SupportMessage = { role: 'user', content: trimmed, ts: new Date().toISOString() };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      if (requiresAdminApproval(trimmed)) {
        const ticket = createApprovalTicket(trimmed);
        setPendingCount(getPendingApprovals().length);
        setMessages((prev) => [
          ...prev,
          { role: 'assistant', content: approvalAcknowledgement(ticket), ts: new Date().toISOString() },
        ]);
        return;
      }

      const prompt = buildSupportPrompt(messages, trimmed, { pathname });
      const reply = await invoke<string>('generate-ai', prompt);
      let content = String(reply || '').trim() || 'Hmm — I did not get a response. Try again or open Integrations to check connections.';

      if (route) {
        content += `\n\n**${route.label}** → [${route.href}](${route.href})`;
      }

      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content, ts: new Date().toISOString() },
      ]);
    } catch (e) {
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: `Connection hiccup — ${(e as Error).message}. Check Integrations Hub or try again in a moment.`,
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
      <button type="button" className="live-support-fab" onClick={toggle} title="Live Support">
        <span className="live-support-fab-icon">💬</span>
        {pendingCount > 0 && <span className="live-support-fab-badge">{pendingCount}</span>}
      </button>
    );
  }

  return (
    <div className={`live-support-panel ${embedded ? 'live-support-embedded' : ''}`}>
      <div className="live-support-header">
        <div>
          <p className="live-support-eyebrow">Imperialism Brain</p>
          <h3 className="live-support-title">Live Support</h3>
        </div>
        <div className="live-support-header-actions">
          {pendingCount > 0 && (
            <span className="live-support-pending">Waiting on THEE_MICHAEL approval ({pendingCount})</span>
          )}
          {!embedded && (
            <button type="button" className="live-support-close" onClick={toggle} aria-label="Close support">×</button>
          )}
        </div>
      </div>

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
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask about setup, posts, replies, integrations…"
          disabled={loading}
          className="live-support-input"
        />
        <button type="submit" className="btn live-support-send" disabled={loading || !input.trim()}>Send</button>
      </form>

      <p className="live-support-footer">
        <Link href="/support">Full support page</Link>
        {' · '}
        <Link href="/integrations">Integrations</Link>
        {' · '}
        <Link href="/dashboard">Mission Control</Link>
      </p>
    </div>
  );
}