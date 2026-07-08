'use client';

import Link from 'next/link';
import { ImperialismBrainAvatar } from '@/components/ImperialismBrainAvatar';
import { SetupConnectionsPanel } from '@/components/SetupConnectionsPanel';
import type { BrandResearchResult } from '@/lib/onboardingIntelligence';

export const WIZARD_STEP_LABELS = [
  'Brand Profile',
  'API Connections',
  'Keywords & Platforms',
  'Feed Preview',
  'AI Replies & Be First',
] as const;

const MODULE_COUNT = 24;

const BRAND_FLOW = [
  { id: 'domain', label: 'Domain', hint: 'Enter site URL' },
  { id: 'research', label: 'Research', hint: 'Auto-fill from web' },
  { id: 'review', label: 'Review', hint: 'Edit profile fields' },
  { id: 'save', label: 'Save', hint: 'Wire all modules' },
] as const;

const API_FLOW = [
  { id: 'review', label: 'Review', hint: 'See what is live' },
  { id: 'connect', label: 'Connect', hint: 'Keys & OAuth' },
  { id: 'test', label: 'Test', hint: 'Live probes' },
  { id: 'continue', label: 'Continue', hint: '→ Keywords' },
] as const;

const KEYWORDS_FLOW = [
  { id: 'suggest', label: 'Suggest', hint: 'AI from brand' },
  { id: 'add', label: 'Add', hint: 'Pick terms' },
  { id: 'platforms', label: 'Platforms', hint: 'Where to track' },
  { id: 'save', label: 'Save', hint: '→ Feed preview' },
] as const;

const FEED_FLOW = [
  { id: 'preview', label: 'Preview', hint: 'Quick match scan' },
  { id: 'scan', label: 'Scan', hint: 'Full discovery' },
  { id: 'review', label: 'Review', hint: 'Check matches' },
  { id: 'continue', label: 'Continue', hint: '→ AI Replies' },
] as const;

const REPLIES_FLOW = [
  { id: 'voice', label: 'Voice', hint: 'Global prompt' },
  { id: 'schedule', label: 'Schedule', hint: 'Scan frequency' },
  { id: 'monitors', label: 'Monitors', hint: 'Be-First watches' },
  { id: 'finish', label: 'Finish', hint: 'Campaign Manager' },
] as const;

export type BrandProfileFields = {
  brandName: string;
  domain: string;
  description: string;
  tone: string;
  audience: string;
  disallowedTopics: string;
  sampleMessages: string;
  affiliateLinks: string;
};

export type BrandProfilePhase = (typeof BRAND_FLOW)[number]['id'];
export type ApiConnectionsPhase = (typeof API_FLOW)[number]['id'];
export type KeywordsPhase = (typeof KEYWORDS_FLOW)[number]['id'];
export type FeedPreviewPhase = (typeof FEED_FLOW)[number]['id'];
export type RepliesPhase = (typeof REPLIES_FLOW)[number]['id'];

export type WizardKeyword = { term: string; platforms?: string[] };

export type WizardFeedPost = {
  platform: string;
  content: string;
  url?: string;
  matchScore?: number;
};

export type WizardMonitor = {
  id?: string;
  term?: string;
  platform?: string;
  type?: string;
  target?: string;
  added?: string;
};

export function resolveBrandProfilePhase(opts: {
  domain: string;
  brandName: string;
  description: string;
  loading: boolean;
  hasResearch: boolean;
}): BrandProfilePhase {
  if (opts.loading) return 'research';
  if (!opts.domain.trim()) return 'domain';
  if (!opts.hasResearch && !opts.description.trim()) return 'research';
  if (!opts.brandName.trim()) return 'review';
  return 'save';
}

export function resolveApiConnectionsPhase(connectedCount: number, minRequired = 3): ApiConnectionsPhase {
  if (connectedCount <= 0) return 'review';
  if (connectedCount < minRequired) return 'connect';
  if (connectedCount < minRequired + 2) return 'test';
  return 'continue';
}

export function resolveKeywordsPhase(opts: {
  loading: boolean;
  keywordCount: number;
  suggestedCount: number;
}): KeywordsPhase {
  if (opts.loading && opts.keywordCount === 0) return 'suggest';
  if (opts.keywordCount === 0 && opts.suggestedCount === 0) return 'suggest';
  if (opts.keywordCount === 0) return 'add';
  if (opts.keywordCount > 0) return 'save';
  return 'platforms';
}

export function resolveFeedPreviewPhase(opts: {
  loading: boolean;
  feedCount: number;
}): FeedPreviewPhase {
  if (opts.loading && opts.feedCount === 0) return 'scan';
  if (opts.feedCount === 0) return 'preview';
  return 'review';
}

export function resolveRepliesPhase(opts: {
  globalPrompt: string;
  monitorCount: number;
  loading?: boolean;
}): RepliesPhase {
  if (opts.loading && !opts.globalPrompt.trim()) return 'voice';
  if (!opts.globalPrompt.trim()) return 'voice';
  if (opts.monitorCount === 0) return 'monitors';
  return 'finish';
}

function flowIndex<T extends { id: string }>(steps: readonly T[], phase: string) {
  const idx = steps.findIndex((s) => s.id === phase);
  return idx >= 0 ? idx : 0;
}

function setupGuideSubtitle(
  step: number,
  moduleCount: number,
  ctx: {
    brandPhase?: BrandProfilePhase;
    apiPhase?: ApiConnectionsPhase;
    keywordsPhase?: KeywordsPhase;
    feedPhase?: FeedPreviewPhase;
    repliesPhase?: RepliesPhase;
    domain?: string;
    loading?: boolean;
    connectedCount?: number;
    keywordCount?: number;
    feedCount?: number;
    monitorCount?: number;
  } = {},
) {
  const n = moduleCount || MODULE_COUNT;
  const label = WIZARD_STEP_LABELS[step - 1] || `Step ${step}`;

  if (step === 1 && ctx.brandPhase) {
    switch (ctx.brandPhase) {
      case 'domain':
        return `${label} — Start with your domain. Imperialism Brain researches your site, then auto-fills every field and wires all ${n} modules + Campaign Command.`;
      case 'research':
        return ctx.loading
          ? `${label} — Researching ${ctx.domain || 'your domain'} (website + SEO + keywords + module propagation)…`
          : `${label} — Domain ready. Run Research to pull live brand data, keywords, and global reply voice into the fields below.`;
      case 'review':
        return `${label} — Research complete. Review the auto-filled profile, adjust tone and voice, then continue.`;
      case 'save':
        return `${label} — Profile ready. Save & Integrate wires brand data to Keywords, AI Replies, Prompt Vault, and Campaign Command → Step 2 APIs.`;
      default:
        break;
    }
  }

  if (step === 2 && ctx.apiPhase) {
    const live = ctx.connectedCount ?? 0;
    switch (ctx.apiPhase) {
      case 'review':
        return `${label} — Brand profile saved. Review which integrations are live, then connect API keys and OAuth below.`;
      case 'connect':
        return `${label} — ${live} API${live === 1 ? '' : 's'} connected. Add Gemini, OpenRouter, or SerpAPI keys — each field tests live before you continue.`;
      case 'test':
        return `${label} — ${live} APIs live. Run live probes in the panel below, then continue to Keywords & Platforms.`;
      case 'continue':
        return `${label} — ${live} APIs ready. Continue to Step 3 to confirm keywords from brand research and pick social platforms.`;
      default:
        break;
    }
  }

  if (step === 3 && ctx.keywordsPhase) {
    const kw = ctx.keywordCount ?? 0;
    switch (ctx.keywordsPhase) {
      case 'suggest':
        return ctx.loading
          ? `${label} — Imperialism Brain researching keywords from your brand profile…`
          : `${label} — APIs are wired. Suggest keywords from your brand, then choose platforms to monitor.`;
      case 'add':
        return `${label} — Add AI suggestions or manual keywords, then select which platforms to track.`;
      case 'platforms':
        return `${label} — Pick platforms for discovery and replies, then save to wire Keywords + Auto-Rules.`;
      case 'save':
        return `${label} — ${kw} keyword${kw === 1 ? '' : 's'} ready. Save to enable Browse Posts, feed preview, and Be-First monitors → Step 4.`;
      default:
        break;
    }
  }

  if (step === 4 && ctx.feedPhase) {
    const posts = ctx.feedCount ?? 0;
    const kw = ctx.keywordCount ?? 0;
    switch (ctx.feedPhase) {
      case 'preview':
        return `${label} — ${kw} keyword${kw === 1 ? '' : 's'} saved. Run a quick preview to see matching posts from connected APIs and web discovery.`;
      case 'scan':
        return ctx.loading
          ? `${label} — Scanning live feeds for keyword matches…`
          : `${label} — Run Quick Preview first, or Full First Scan for a deeper discovery pass.`;
      case 'review':
        return `${label} — Review matched posts below. Scores show relevance to your tracked keywords.`;
      case 'continue':
        return `${label} — ${posts} post${posts === 1 ? '' : 's'} found. Continue to AI Replies & Be First to set voice, monitors, and launch Campaign Command.`;
      default:
        break;
    }
  }

  if (step === 5 && ctx.repliesPhase) {
    const mon = ctx.monitorCount ?? 0;
    switch (ctx.repliesPhase) {
      case 'voice':
        return `${label} — Set your global reply voice so AI Replies match your brand across every platform.`;
      case 'schedule':
        return `${label} — Voice ready. Set auto-search and Be-First frequencies, then add monitors for real-time replies.`;
      case 'monitors':
        return `${label} — Set scan frequencies and add Be-First monitors (keywords, accounts, or pages) for real-time replies.`;
      case 'finish':
        return `${label} — ${mon} monitor${mon === 1 ? '' : 's'} active. Finish setup to start the worker and open Campaign Command verified nodes.`;
      default:
        break;
    }
  }

  switch (step) {
    case 2:
      return `${label} — Connect APIs and OAuth so discovery, SEO pulse, and publishing run live across your stack.`;
    case 3:
      return `${label} — Add keywords and platforms; use AI suggestions from brand research or enter your own.`;
    case 4:
      return `${label} — Preview posts matching your keywords before you schedule and publish.`;
    case 5:
      return `${label} — Set global reply voice and Be-First monitors, then finish to Campaign Command.`;
    default:
      return `${label} — Complete this step to wire your campaign across all ${n} modules.`;
  }
}

function MicroFlowRow({
  steps,
  activeIdx,
  label,
}: {
  steps: readonly { id: string; label: string; hint: string }[];
  activeIdx: number;
  label: string;
}) {
  return (
    <div className="brain-setup-micro-flow" aria-label={label}>
      {steps.map((item, i) => {
        const done = i < activeIdx;
        const active = i === activeIdx;
        return (
          <div
            key={item.id}
            className={`brain-setup-micro-step ${done ? 'done' : ''} ${active ? 'active' : ''}`}
          >
            <span className="brain-setup-micro-order">{done ? '✓' : i + 1}</span>
            <span className="brain-setup-micro-label">{item.label}</span>
            <span className="brain-setup-micro-hint">{item.hint}</span>
          </div>
        );
      })}
    </div>
  );
}

type Props = {
  step: number;
  loading?: boolean;
  research?: BrandResearchResult | null;
  onResearch?: () => void;
  domain?: string;
  brand?: BrandProfileFields;
  onBrandChange?: (patch: Partial<BrandProfileFields>) => void;
  onSaveBrand?: () => void;
  statusMessage?: string;
  apiMetrics?: Record<string, string>;
  connectedCount?: number;
  onConnectionsSaved?: () => void;
  onContinueToKeywords?: () => void;
  onSkipConnections?: () => void;
  keywords?: WizardKeyword[];
  suggested?: string[];
  manualKw?: string;
  platforms?: string[];
  platformOptions?: string[];
  platformLabel?: (platform: string) => string;
  onManualKwChange?: (value: string) => void;
  onSuggestKeywords?: () => void;
  onAddKeywords?: (terms: string[]) => void;
  onTogglePlatform?: (platform: string) => void;
  onSaveKeywords?: () => void;
  onSkipKeywords?: () => void;
  feed?: WizardFeedPost[];
  onQuickPreview?: () => void;
  onFullScan?: () => void;
  onContinueToReplies?: () => void;
  globalPrompt?: string;
  onGlobalPromptChange?: (value: string) => void;
  autoSearchFreq?: string;
  beFirstFreq?: string;
  onAutoSearchFreqChange?: (value: string) => void;
  onBeFirstFreqChange?: (value: string) => void;
  enableWorker?: boolean;
  onEnableWorkerChange?: (value: boolean) => void;
  watchTerm?: string;
  watchType?: string;
  watchPlatform?: string;
  onWatchTermChange?: (value: string) => void;
  onWatchTypeChange?: (value: string) => void;
  onWatchPlatformChange?: (value: string) => void;
  monitors?: WizardMonitor[];
  onAddMonitor?: () => void;
  onRemoveMonitor?: (index: number) => void;
  onAutoFillPrompt?: () => void;
  onFinish?: () => void;
  summaryBrandName?: string;
};

export function ImperialismBrainSetupGuide({
  step,
  loading,
  research,
  onResearch,
  domain,
  brand,
  onBrandChange,
  onSaveBrand,
  statusMessage,
  apiMetrics,
  connectedCount = 0,
  onConnectionsSaved,
  onContinueToKeywords,
  onSkipConnections,
  keywords = [],
  suggested = [],
  manualKw = '',
  platforms = [],
  platformOptions = [],
  platformLabel = (p) => p,
  onManualKwChange,
  onSuggestKeywords,
  onAddKeywords,
  onTogglePlatform,
  onSaveKeywords,
  onSkipKeywords,
  feed = [],
  onQuickPreview,
  onFullScan,
  onContinueToReplies,
  globalPrompt = '',
  onGlobalPromptChange,
  autoSearchFreq = 'daily',
  beFirstFreq = '10m',
  onAutoSearchFreqChange,
  onBeFirstFreqChange,
  enableWorker = true,
  onEnableWorkerChange,
  watchTerm = '',
  watchType = 'keyword',
  watchPlatform = 'All',
  onWatchTermChange,
  onWatchTypeChange,
  onWatchPlatformChange,
  monitors = [],
  onAddMonitor,
  onRemoveMonitor,
  onAutoFillPrompt,
  onFinish,
  summaryBrandName,
}: Props) {
  const wiredModules = research?.propagation?.results?.filter((r) => r.ok).map((r) => r.module) || [];
  const hasResearch = !!research?.brand?.domain;
  const stepLabel = WIZARD_STEP_LABELS[step - 1];

  const brandPhase = step === 1 && brand
    ? resolveBrandProfilePhase({
        domain: brand.domain,
        brandName: brand.brandName,
        description: brand.description,
        loading: !!loading,
        hasResearch,
      })
    : undefined;

  const apiPhase = step === 2 ? resolveApiConnectionsPhase(connectedCount) : undefined;

  const keywordsPhase = step === 3
    ? resolveKeywordsPhase({
        loading: !!loading,
        keywordCount: keywords.length,
        suggestedCount: suggested.length,
      })
    : undefined;

  const feedPhase = step === 4
    ? resolveFeedPreviewPhase({ loading: !!loading, feedCount: feed.length })
    : undefined;

  const repliesPhase = step === 5
    ? resolveRepliesPhase({ globalPrompt, monitorCount: monitors.length, loading: !!loading })
    : undefined;

  const subtitle = setupGuideSubtitle(step, research?.moduleFlow?.length || MODULE_COUNT, {
    brandPhase,
    apiPhase,
    keywordsPhase,
    feedPhase,
    repliesPhase,
    domain: brand?.domain || domain,
    loading,
    connectedCount,
    keywordCount: keywords.length,
    feedCount: feed.length,
    monitorCount: monitors.length,
  });

  const researchFromBrand = research?.suggestedKeywords?.length;

  return (
    <div className="brain-setup-guide">
      <div className="brain-setup-guide-header">
        <ImperialismBrainAvatar size="xl" className="brain-setup-icon" />
        <div className="brain-setup-header-copy">
          <p className="brain-setup-eyebrow">Imperialism Brain · Intelligent Setup</p>
          <p className="brain-setup-step-label">{step}. {stepLabel}</p>
          <p className="brain-setup-title">{subtitle}</p>
        </div>
      </div>

      {step === 1 && brand && onBrandChange && (
        <div className="brain-setup-step-flow">
          <MicroFlowRow
            steps={BRAND_FLOW}
            activeIdx={brandPhase ? flowIndex(BRAND_FLOW, brandPhase) : 0}
            label="Brand profile setup flow"
          />
          <div className="brain-setup-brand-form">
            <div className="brain-setup-brand-form-row">
              <input
                className="input"
                placeholder="Domain * (e.g. acme.com)"
                value={brand.domain}
                onChange={(e) => onBrandChange({ domain: e.target.value })}
                disabled={loading}
              />
              <input
                className="input"
                placeholder="Brand name *"
                value={brand.brandName}
                onChange={(e) => onBrandChange({ brandName: e.target.value })}
                disabled={loading}
              />
            </div>
            {brandPhase === 'research' && (
              <button
                type="button"
                className="btn primary brain-setup-inline-research"
                onClick={onResearch}
                disabled={loading || !brand.domain.trim()}
              >
                {loading ? 'Researching your brand…' : '✨ Imperialism Brain — Research & Auto-Fill from Web'}
              </button>
            )}
            {(hasResearch || brand.description || brandPhase === 'review' || brandPhase === 'save') && (
              <div className="brain-setup-brand-fields">
                <textarea
                  className="input"
                  placeholder="Brand description — what you do, who you help"
                  value={brand.description}
                  onChange={(e) => onBrandChange({ description: e.target.value })}
                  disabled={loading}
                />
                <input
                  className="input"
                  placeholder="Target audience (optional)"
                  value={brand.audience}
                  onChange={(e) => onBrandChange({ audience: e.target.value })}
                  disabled={loading}
                />
                <select
                  className="input"
                  value={brand.tone}
                  onChange={(e) => onBrandChange({ tone: e.target.value })}
                  disabled={loading}
                >
                  <option>Professional</option>
                  <option>Casual</option>
                  <option>Bold</option>
                  <option>Educational</option>
                  <option>Friendly</option>
                </select>
                <textarea
                  className="input"
                  placeholder="Disallowed topics (optional)"
                  value={brand.disallowedTopics}
                  onChange={(e) => onBrandChange({ disallowedTopics: e.target.value })}
                  disabled={loading}
                />
                <textarea
                  className="input"
                  placeholder="Sample messages / voice examples (optional)"
                  value={brand.sampleMessages}
                  onChange={(e) => onBrandChange({ sampleMessages: e.target.value })}
                  disabled={loading}
                />
                <input
                  className="input"
                  placeholder="Affiliate links / USPs (optional)"
                  value={brand.affiliateLinks}
                  onChange={(e) => onBrandChange({ affiliateLinks: e.target.value })}
                  disabled={loading}
                />
              </div>
            )}
            {(brandPhase === 'save' || (brand.brandName && brand.domain && brand.description)) && onSaveBrand && (
              <button
                type="button"
                className="btn primary brain-setup-save-btn"
                onClick={onSaveBrand}
                disabled={loading || !brand.brandName.trim() || !brand.domain.trim()}
              >
                Save & Integrate with AI → Step 2 APIs
              </button>
            )}
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="brain-setup-step-flow">
          <MicroFlowRow
            steps={API_FLOW}
            activeIdx={apiPhase ? flowIndex(API_FLOW, apiPhase) : 0}
            label="API connections setup flow"
          />
          {Object.keys(apiMetrics || {}).length > 0 && (
            <div className="brain-setup-api-pills">
              {Object.entries(apiMetrics || {}).slice(0, 14).map(([name, st]) => (
                <span key={name} className={`api-pill ${st === 'Connected' ? 'ok' : 'warn'}`}>{name}</span>
              ))}
            </div>
          )}
          <p className="brain-setup-step-note">
            Keys load from server .env for admins. Test each integration live before continuing to keywords.
          </p>
          <SetupConnectionsPanel onSaved={onConnectionsSaved} />
          <div className="brain-setup-step-actions">
            <button
              type="button"
              className="btn primary"
              onClick={onContinueToKeywords}
              disabled={connectedCount < 3}
            >
              Continue — {connectedCount} APIs live → Step 3 Keywords
            </button>
            <button type="button" className="btn" onClick={onSkipConnections}>
              Skip for now →
            </button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="brain-setup-step-flow">
          <MicroFlowRow
            steps={KEYWORDS_FLOW}
            activeIdx={keywordsPhase ? flowIndex(KEYWORDS_FLOW, keywordsPhase) : 0}
            label="Keywords and platforms setup flow"
          />
          {researchFromBrand ? (
            <p className="brain-setup-step-note">
              Brand research seeded {researchFromBrand} keyword{researchFromBrand === 1 ? '' : 's'} — confirm or add more below.
            </p>
          ) : null}
          <div className="brain-setup-keywords-actions">
            <button
              type="button"
              className="btn primary"
              onClick={onSuggestKeywords}
              disabled={loading}
            >
              {loading && keywordsPhase === 'suggest' ? 'AI researching keywords…' : '✨ AI Suggest Keywords'}
            </button>
          </div>
          {suggested.length > 0 && (
            <div className="brain-setup-suggested">
              <div className="brain-setup-suggested-chips">
                {suggested.map((t) => (
                  <button
                    key={t}
                    type="button"
                    className="badge brain-setup-kw-chip"
                    onClick={() => onAddKeywords?.([t])}
                  >
                    + {t}
                  </button>
                ))}
              </div>
              <button type="button" className="btn" onClick={() => onAddKeywords?.(suggested)}>
                Add All Suggestions
              </button>
            </div>
          )}
          <div className="brain-setup-manual-kw">
            <textarea
              className="input"
              placeholder="Manual keywords (comma or newline)"
              value={manualKw}
              onChange={(e) => onManualKwChange?.(e.target.value)}
              disabled={loading}
            />
            <button
              type="button"
              className="btn"
              onClick={() => {
                onAddKeywords?.(manualKw.split(/[\n,]+/).map((s) => s.trim()).filter(Boolean));
                onManualKwChange?.('');
              }}
              disabled={!manualKw.trim()}
            >
              + Add Manual
            </button>
          </div>
          <p className="brain-setup-step-note">Track on platforms:</p>
          <div className="brain-setup-platform-grid">
            {platformOptions.map((p) => (
              <div
                key={p}
                className={`platform-chip ${platforms.includes(p) ? 'selected' : ''}`}
                onClick={() => onTogglePlatform?.(p)}
                onKeyDown={(e) => e.key === 'Enter' && onTogglePlatform?.(p)}
                role="button"
                tabIndex={0}
              >
                {platformLabel(p)}
              </div>
            ))}
          </div>
          <p className="brain-setup-kw-summary">
            Tracked ({keywords.length}): {keywords.map((k) => k.term).join(', ') || 'none yet'}
          </p>
          <div className="brain-setup-step-actions">
            <button
              type="button"
              className="btn primary"
              onClick={onSaveKeywords}
              disabled={loading || !keywords.length}
            >
              Save Keywords → Step 4 Feed Preview
            </button>
            <button type="button" className="btn" onClick={onSkipKeywords}>
              Skip →
            </button>
          </div>
        </div>
      )}

      {step === 4 && (
        <div className="brain-setup-step-flow">
          <MicroFlowRow
            steps={FEED_FLOW}
            activeIdx={feedPhase ? flowIndex(FEED_FLOW, feedPhase) : 0}
            label="Feed preview setup flow"
          />
          <p className="brain-setup-step-note">
            Posts matching your keywords from connected APIs and Browse Posts discovery.
          </p>
          <div className="brain-setup-step-actions">
            <button type="button" className="btn primary" onClick={onQuickPreview} disabled={loading}>
              {loading && feedPhase === 'scan' ? 'Loading feed…' : 'Quick Preview'}
            </button>
            <button type="button" className="btn" onClick={onFullScan} disabled={loading}>
              Full First Scan
            </button>
            <button type="button" className="btn" onClick={onContinueToReplies}>
              Continue → Step 5 AI Replies
            </button>
          </div>
          {feed.map((p, i) => (
            <div key={`${p.platform}-${i}`} className="post-card brain-setup-feed-card">
              <span className="badge">{p.platform}</span>
              {p.matchScore != null && (
                <span className="brain-setup-feed-score">score {p.matchScore}</span>
              )}
              <div>{(p.content || '').slice(0, 200)}</div>
            </div>
          ))}
          {!feed.length && !loading && (
            <p className="brain-setup-step-note">Click Quick Preview to load matching posts.</p>
          )}
        </div>
      )}

      {step === 5 && (
        <div className="brain-setup-step-flow">
          <MicroFlowRow
            steps={REPLIES_FLOW}
            activeIdx={repliesPhase ? flowIndex(REPLIES_FLOW, repliesPhase) : 0}
            label="AI replies and Be-First setup flow"
          />
          {!globalPrompt.trim() && (
            <p className="brain-setup-step-note">
              Use AI Auto-Fill to pull voice from your brand profile, or write your own global reply rules.
            </p>
          )}
          <label className="brain-setup-field-label">Global Custom Prompt</label>
          <div className="brain-setup-prompt-row">
            <textarea
              className="input"
              rows={4}
              value={globalPrompt}
              onChange={(e) => onGlobalPromptChange?.(e.target.value)}
              placeholder="Always naturally mention our brand and domain…"
              disabled={loading}
            />
            <button type="button" className="btn" onClick={onAutoFillPrompt} disabled={loading}>
              {loading && repliesPhase === 'voice' ? 'Building prompt…' : '✨ AI Auto-Fill'}
            </button>
          </div>
          <div className="brain-setup-freq-grid">
            <div>
              <label className="brain-setup-field-label">Auto Search frequency</label>
              <select
                className="input"
                value={autoSearchFreq}
                onChange={(e) => onAutoSearchFreqChange?.(e.target.value)}
                disabled={loading}
              >
                {['5m', '10m', '15m', '30m', 'hourly', 'daily', 'weekly', 'monthly'].map((f) => (
                  <option key={f} value={f}>{f}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="brain-setup-field-label">Be-First monitor frequency</label>
              <select
                className="input"
                value={beFirstFreq}
                onChange={(e) => onBeFirstFreqChange?.(e.target.value)}
                disabled={loading}
              >
                {['5m', '10m', '15m', '30m', 'hourly', 'daily', 'realtime'].map((f) => (
                  <option key={f} value={f}>{f}</option>
                ))}
              </select>
            </div>
          </div>
          <label className="brain-setup-field-label">Be-First Monitor — watch keyword, page, or account</label>
          <div className="wizard-monitor-grid brain-setup-monitor-grid">
            <input
              className="input"
              placeholder="Keyword, @handle, or page"
              value={watchTerm}
              onChange={(e) => onWatchTermChange?.(e.target.value)}
              disabled={loading}
            />
            <select
              className="input"
              value={watchType}
              onChange={(e) => onWatchTypeChange?.(e.target.value)}
              disabled={loading}
            >
              <option value="keyword">Keyword</option>
              <option value="account">Account</option>
              <option value="page">Page</option>
              <option value="post">Post</option>
            </select>
            <select
              className="input"
              value={watchPlatform}
              onChange={(e) => onWatchPlatformChange?.(e.target.value)}
              disabled={loading}
            >
              <option value="All">All Platforms</option>
              {platformOptions.map((p) => (
                <option key={p} value={p}>{platformLabel(p)}</option>
              ))}
            </select>
            <button type="button" className="btn" onClick={onAddMonitor} disabled={loading}>
              + Watch
            </button>
          </div>
          {monitors.length === 0 && (
            <p className="brain-setup-step-note">No monitors yet — add a keyword or account for Be-First replies.</p>
          )}
          {monitors.map((m, i) => (
            <div key={m.id || i} className="post-card brain-setup-monitor-card">
              <span><span className="badge">{m.type}</span> {m.term} · {m.platform}</span>
              <button type="button" className="btn" onClick={() => onRemoveMonitor?.(i)}>Remove</button>
            </div>
          ))}
          <label className="brain-setup-worker-toggle">
            <input
              type="checkbox"
              checked={enableWorker}
              onChange={(e) => onEnableWorkerChange?.(e.target.checked)}
            />
            Enable background worker (Be First delay jitter in Auto-Rules)
          </label>
          <div className="brain-setup-finish-metrics">
            <div className="brain-setup-metric">
              <span className="brain-setup-metric-val">{summaryBrandName || brand?.brandName || '—'}</span>
              <span className="brain-setup-metric-label">Brand</span>
            </div>
            <div className="brain-setup-metric">
              <span className="brain-setup-metric-val">{keywords.length}</span>
              <span className="brain-setup-metric-label">Keywords</span>
            </div>
            <div className="brain-setup-metric">
              <span className="brain-setup-metric-val">{monitors.length}</span>
              <span className="brain-setup-metric-label">Monitors</span>
            </div>
            <div className="brain-setup-metric">
              <span className="brain-setup-metric-val">{connectedCount}</span>
              <span className="brain-setup-metric-label">APIs Live</span>
            </div>
          </div>
          <div className="brain-setup-step-actions">
            <button type="button" className="btn primary" onClick={onFinish} disabled={loading}>
              {loading ? 'Finishing…' : 'Finish Setup → Campaign Manager'}
            </button>
            <Link href="/campaign-manager?tab=nodes" className="btn">Open Verified Nodes →</Link>
            <Link href="/support" className="btn">Ask Imperialism Brain</Link>
          </div>
        </div>
      )}

      {statusMessage && step <= 5 && (
        <p className={`brain-setup-status ${/failed|error|required/i.test(statusMessage) ? 'warn' : 'ok'}`}>
          {statusMessage}
        </p>
      )}

      {step === 1 && research?.steps && research.steps.length > 0 && (
        <div className="brain-setup-steps">
          {research.steps.map((s) => (
            <span key={s.step} className={`brain-setup-step-pill ${s.ok ? 'ok' : 'warn'}`}>
              {s.ok ? '✓' : '·'} {s.step.replace(/-/g, ' ')}
            </span>
          ))}
        </div>
      )}

      {step === 1 && wiredModules.length > 0 && (
        <p className="brain-setup-wired-summary">
          Persisted to: {wiredModules.join(' · ')}
        </p>
      )}

      {step === 1 && research?.recommendations && research.recommendations.length > 0 && (
        <ul className="brain-setup-recs">
          {research.recommendations.slice(0, 5).map((r, i) => (
            <li key={i}>
              <Link href={r.href}>{r.action}</Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** @deprecated Use ImperialismBrainSetupGuide */
export const TheeMichaelSetupGuide = ImperialismBrainSetupGuide;