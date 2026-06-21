'use client';

import {
  buildRecommendations,
  IntelligenceProfile,
  IntelligenceRecommendation,
  IntelligenceSettings,
  LinkedAccountIntel,
  normalizeProfile,
} from '@/lib/intelligenceProfile';

type Props = {
  account?: LinkedAccountIntel;
  profile?: IntelligenceProfile | unknown;
  settings?: Partial<IntelligenceSettings>;
  title?: string;
  maxItems?: number;
  onSelect?: (rec: IntelligenceRecommendation) => void;
};

export function IntelligenceRecommendations({
  account,
  profile: rawProfile,
  settings,
  title = 'Intelligence recommendations',
  maxItems = 4,
  onSelect,
}: Props) {
  const profile = normalizeProfile(rawProfile ?? account?.profile);

  const recs = buildRecommendations(profile, account, settings).slice(0, maxItems);
  if (!recs.length) return null;

  return (
    <div className="ip-recs">
      <div className="ip-recs-head">
        <span className="ip-recs-title">{title}</span>
        {account && <span className="ip-recs-account">{account.platform} · {account.handle || account.username}</span>}
      </div>
      <div className="ip-recs-list">
        {recs.map((rec) => (
          <button
            key={rec.id}
            type="button"
            className={`ip-rec-card ip-rec-${rec.kind}`}
            onClick={() => onSelect?.(rec)}
            title={rec.action}
          >
            <span className="ip-rec-label">{rec.label}</span>
            <span className="ip-rec-detail">{rec.detail}</span>
            {rec.action && <span className="ip-rec-action">{rec.action}</span>}
          </button>
        ))}
      </div>
    </div>
  );
}