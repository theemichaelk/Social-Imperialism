'use client';

import { useState } from 'react';
import { invoke } from '@/lib/api';
import {
  type DiscoveredTarget,
  type DiscoverKeywordTargetsResult,
  type WatchMonitor,
  formatAudienceCount,
  monitorMatchesTarget,
  parseKeywordInput,
} from '@/lib/beFirstTargets';

type Props = {
  keywordInput: string;
  onKeywordInputChange?: (value: string) => void;
  platformFilter: string;
  onPlatformFilterChange?: (value: string) => void;
  platformOptions: string[];
  platformLabel?: (platform: string) => string;
  monitors: WatchMonitor[];
  onAddToWatchList: (target: DiscoveredTarget) => void;
  disabled?: boolean;
  compact?: boolean;
};

export function BeFirstTargetDiscovery({
  keywordInput,
  onKeywordInputChange,
  platformFilter,
  onPlatformFilterChange,
  platformOptions,
  platformLabel = (p) => p,
  monitors,
  onAddToWatchList,
  disabled = false,
  compact = false,
}: Props) {
  const [discovering, setDiscovering] = useState(false);
  const [targets, setTargets] = useState<DiscoveredTarget[]>([]);
  const [meta, setMeta] = useState<{ postCount?: number; scannedPlatforms?: string[] } | null>(null);
  const [error, setError] = useState('');

  async function runDiscovery() {
    const keywords = parseKeywordInput(keywordInput);
    if (!keywords.length) {
      setError('Enter one or more keywords (comma-separated)');
      return;
    }
    setDiscovering(true);
    setError('');
    try {
      const res = await invoke<DiscoverKeywordTargetsResult>('discover-keyword-targets', {
        keywords,
        platform: platformFilter,
        limit: 50,
      });
      if (!res.success) {
        setError(res.error || 'Discovery returned no results');
        setTargets([]);
        setMeta(null);
        return;
      }
      setTargets(res.targets || []);
      setMeta({ postCount: res.postCount, scannedPlatforms: res.scannedPlatforms });
      if (!res.targets?.length) {
        setError('No accounts or communities found — try different keywords or connect more APIs in Integrations.');
      }
    } catch (e) {
      setError((e as Error).message || 'Discovery failed');
      setTargets([]);
      setMeta(null);
    } finally {
      setDiscovering(false);
    }
  }

  return (
    <div className={`be-first-discovery${compact ? ' be-first-discovery-compact' : ''}`}>
      <p className="brain-setup-step-note be-first-discovery-hint">
        Enter keywords to pull relevant accounts, pages, communities, and posts across platforms — ranked from most followed / active to least. Add targets one by one to your Be-First watch list.
      </p>

      <div className="be-first-discovery-search">
        <input
          className="input"
          placeholder="Keywords — e.g. saas marketing, ai automation"
          value={keywordInput}
          onChange={(e) => onKeywordInputChange?.(e.target.value)}
          disabled={disabled || discovering}
        />
        <select
          className="input"
          value={platformFilter}
          onChange={(e) => onPlatformFilterChange?.(e.target.value)}
          disabled={disabled || discovering}
        >
          <option value="All">All Platforms</option>
          {platformOptions.map((p) => (
            <option key={p} value={p}>{platformLabel(p)}</option>
          ))}
        </select>
        <button
          type="button"
          className="btn primary"
          onClick={runDiscovery}
          disabled={disabled || discovering}
        >
          {discovering ? 'Scanning…' : 'Discover Targets'}
        </button>
      </div>

      {error && <p className="brain-setup-step-note warn">{error}</p>}

      {meta && targets.length > 0 && (
        <p className="brain-setup-step-note ok">
          Scanned {meta.postCount ?? 0} posts
          {meta.scannedPlatforms?.length ? ` across ${meta.scannedPlatforms.join(', ')}` : ''}
          {' '}— {targets.length} ranked target{targets.length === 1 ? '' : 's'}
        </p>
      )}

      {targets.length > 0 && (
        <div className="be-first-discovery-list">
          {targets.map((t) => {
            const watching = monitorMatchesTarget(monitors, t);
            return (
              <article key={t.id} className="post-card be-first-discovery-card">
                <div className="be-first-discovery-main">
                  <div className="be-first-discovery-head">
                    <span className="badge">{t.type}</span>
                    <strong>{t.label || t.term}</strong>
                    <span className="be-first-discovery-platform">{t.platform}</span>
                  </div>
                  <div className="be-first-discovery-stats">
                    <span>Audience: {formatAudienceCount(t)}</span>
                    <span>Activity: {t.activityScore ?? 0}</span>
                    <span>Posts seen: {t.postCount ?? 0}</span>
                    <span>Rank: {t.rankScore ?? 0}</span>
                  </div>
                  {t.samplePost && (
                    <p className="be-first-discovery-sample">{t.samplePost}</p>
                  )}
                  {t.matchedKeywords && t.matchedKeywords.length > 0 && (
                    <p className="be-first-discovery-kw">
                      Matched: {t.matchedKeywords.join(', ')}
                    </p>
                  )}
                </div>
                <div className="be-first-discovery-actions">
                  {t.url && (
                    <a href={t.url} target="_blank" rel="noopener noreferrer" className="btn">
                      Open
                    </a>
                  )}
                  <button
                    type="button"
                    className={`btn${watching ? '' : ' primary'}`}
                    disabled={watching || disabled}
                    onClick={() => onAddToWatchList(t)}
                  >
                    {watching ? 'Watching' : '+ Watch'}
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}