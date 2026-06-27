'use client';

import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { invoke } from '@/lib/api';
import { approvalAcknowledgement, requiresAdminApproval } from '@/lib/liveSupportAgent';
import {
  OMNI_BRAIN_ADMIN,
  OMNI_PLACEHOLDERS,
  buildContentPrompt,
  buildPlannerPrompt,
  buildReplyPrompt,
  detectIntent,
  fallbackBlueprint,
  parseBlueprintJson,
  saveBlueprint,
  saveHandoff,
  handleSensitiveRequest,
  type WorkflowBlueprint,
} from '@/lib/omniBrainPlanner';

export function OmniBrainPromptBar() {
  const router = useRouter();
  const pathname = usePathname();
  const [query, setQuery] = useState('');
  const [expanded, setExpanded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [executing, setExecuting] = useState(false);
  const [blueprint, setBlueprint] = useState<WorkflowBlueprint | null>(null);
  const [msg, setMsg] = useState('');
  const [placeholderIdx, setPlaceholderIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const t = setInterval(() => setPlaceholderIdx((i) => (i + 1) % OMNI_PLACEHOLDERS.length), 5000);
    return () => clearInterval(t);
  }, []);

  const plan = useCallback(async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || loading) return;

    setLoading(true);
    setMsg('');
    setExpanded(true);

    try {
      if (requiresAdminApproval(trimmed)) {
        const ticket = handleSensitiveRequest(trimmed);
        const bp = fallbackBlueprint(trimmed);
        bp.requiresApproval = true;
        setBlueprint(bp);
        saveBlueprint(bp);
        setMsg(approvalAcknowledgement(ticket));
        return;
      }

      const intent = detectIntent(trimmed);
      const prompt = buildPlannerPrompt(trimmed, { pathname, intent: intent.intent });
      const raw = await invoke<string>('generate-ai', prompt);
      const parsed = parseBlueprintJson(String(raw || ''), trimmed);
      const bp = parsed || fallbackBlueprint(trimmed);
      setBlueprint(bp);
      saveBlueprint(bp);
      setMsg(bp.requiresApproval ? `Requires ${OMNI_BRAIN_ADMIN} approval before live execution.` : 'Workflow blueprint ready.');
    } catch {
      const bp = fallbackBlueprint(trimmed);
      setBlueprint(bp);
      saveBlueprint(bp);
      setMsg('Used local Omni-Brain planner — blueprint ready.');
    } finally {
      setLoading(false);
    }
  }, [loading, pathname]);

  const executePrimary = useCallback(async () => {
    if (!blueprint || executing) return;
    setExecuting(true);
    setMsg('Executing…');

    try {
      const { intent, request, primaryHref, nextStep } = blueprint;

      if (intent === 'create_content' || /create|write|draft|post|content/i.test(request)) {
        const content = await invoke<string>('generate-ai', buildContentPrompt(request));
        saveHandoff({ type: 'content', prompt: request, content, blueprintId: blueprint.id });
        router.push('/content-hub?tab=studio');
        setMsg('Draft created — opening Content Hub');
        return;
      }

      if (intent === 'reply' || /repl/i.test(request)) {
        const content = await invoke<string>('generate-ai', buildReplyPrompt(request));
        saveHandoff({ type: 'reply', prompt: request, content, blueprintId: blueprint.id });
        router.push('/history');
        setMsg('Reply draft ready — opening AI Replies');
        return;
      }

      if (intent === 'discover' || /keyword|find|talking/i.test(request)) {
        const kw = request.replace(/find|people|talking|about|discover/gi, '').trim() || request;
        saveHandoff({ type: 'keyword', prompt: request, keyword: kw.slice(0, 120), blueprintId: blueprint.id });
        router.push('/keywords');
        setMsg('Keyword routed — opening Keywords');
        return;
      }

      router.push(nextStep?.href || primaryHref);
      setMsg(`Next: ${nextStep?.action || 'Continue workflow'}`);
    } catch (e) {
      router.push(blueprint.nextStep?.href || blueprint.primaryHref);
      setMsg((e as Error).message || 'Navigating to next step');
    } finally {
      setExecuting(false);
    }
  }, [blueprint, executing, router]);

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    plan(query);
  };

  return (
    <div className={`omni-brain-bar ${expanded ? 'omni-brain-expanded' : ''}`}>
      <form className="omni-brain-form" onSubmit={onSubmit}>
        <div className="omni-brain-badge" title="Omni-Brain Planner">
          <span className="omni-brain-icon">🧠</span>
          <span className="omni-brain-label">Omni-Brain</span>
        </div>
        <input
          ref={inputRef}
          type="text"
          className="omni-brain-input"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setExpanded(true)}
          placeholder={OMNI_PLACEHOLDERS[placeholderIdx]}
          disabled={loading}
          aria-label="Omni-Brain keyword prompt"
        />
        <button type="submit" className="btn omni-brain-plan-btn" disabled={loading || !query.trim()}>
          {loading ? 'Planning…' : 'Plan'}
        </button>
        {blueprint && (
          <button
            type="button"
            className="btn primary omni-brain-run-btn"
            onClick={executePrimary}
            disabled={executing || blueprint.requiresApproval}
            title={blueprint.requiresApproval ? `Requires ${OMNI_BRAIN_ADMIN} approval` : 'Run primary action'}
          >
            {executing ? 'Running…' : 'Run'}
          </button>
        )}
        <button
          type="button"
          className="omni-brain-toggle"
          onClick={() => setExpanded((e) => !e)}
          aria-expanded={expanded}
          title={expanded ? 'Collapse' : 'Expand blueprint'}
        >
          {expanded ? '▾' : '▸'}
        </button>
      </form>

      {expanded && (blueprint || msg) && (
        <div className="omni-brain-panel">
          {msg && <p className="omni-brain-msg">{msg}</p>}
          {blueprint && (
            <>
              <div className="omni-brain-summary">
                <strong>{blueprint.summary}</strong>
                {blueprint.requiresApproval && (
                  <span className="omni-brain-approval-badge">Requires {OMNI_BRAIN_ADMIN} approval</span>
                )}
              </div>
              <ol className="omni-brain-steps">
                {blueprint.steps.map((step) => (
                  <li key={step.order} className={step.approvalRequired ? 'omni-step-approval' : ''}>
                    <div className="omni-step-head">
                      <span className="omni-step-order">{step.order}</span>
                      <div>
                        <strong>{step.module}</strong> — {step.action}
                        {step.href && (
                          <Link href={step.href} className="omni-step-link">Open →</Link>
                        )}
                      </div>
                    </div>
                    <span className="omni-step-check">✓ {step.successCheck}</span>
                  </li>
                ))}
              </ol>
              <div className="omni-brain-footer">
                <span>Next: <strong>{blueprint.nextStep.module}</strong> — {blueprint.nextStep.action}</span>
                <div className="omni-brain-footer-actions">
                  <Link href={blueprint.nextStep.href} className="btn">Go to next step</Link>
                  {!blueprint.requiresApproval && (
                    <button type="button" className="btn primary" onClick={executePrimary} disabled={executing}>
                      Run primary action
                    </button>
                  )}
                  {blueprint.requiresApproval && (
                    <Link href="/settings?tab=guardian-api" className="btn">Ask {OMNI_BRAIN_ADMIN}</Link>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}