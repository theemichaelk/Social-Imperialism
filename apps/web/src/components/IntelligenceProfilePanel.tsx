'use client';

import {
  displayBestTime,
  formatProfileValue,
  IntelligenceProfile,
  workspaceTitle,
  type LinkedAccountIntel,
} from '@/lib/intelligenceProfile';

type Props = {
  account?: Pick<LinkedAccountIntel, 'platform' | 'type' | 'handle' | 'username'>;
  profile: IntelligenceProfile;
  refreshedAt?: string;
  compact?: boolean;
  showHeader?: boolean;
};

export function IntelligenceProfilePanel({
  account,
  profile,
  refreshedAt,
  compact = false,
  showHeader = true,
}: Props) {
  const groups = profile.suggestedGroups?.length ? profile.suggestedGroups.join(', ') : '—';
  const bestTime = displayBestTime(profile);

  if (compact) {
    return (
      <div className="ip-panel ip-panel-compact">
        <div className="ip-grid ip-grid-compact">
          <div className="ip-stat"><span className="ip-val">{formatProfileValue(profile.followers)}</span><span className="ip-lbl">Followers</span></div>
          <div className="ip-stat"><span className="ip-val">{formatProfileValue(profile.likes)}</span><span className="ip-lbl">Engage</span></div>
          <div className="ip-stat"><span className="ip-val ip-val-sm">{formatProfileValue(profile.growthVelocity)}</span><span className="ip-lbl">Growth</span></div>
        </div>
        {bestTime && <p className="ip-compact-line"><strong>Best:</strong> {bestTime}</p>}
      </div>
    );
  }

  return (
    <div className="ip-panel">
      {showHeader && account && (
        <>
          <h4 className="ip-title">{workspaceTitle(account)}</h4>
          <p className="ip-handle">{account.handle || account.username}</p>
        </>
      )}
      <div className="ip-grid">
        <div className="ip-stat">
          <div className="ip-val">{formatProfileValue(profile.followers)}</div>
          <div className="ip-lbl">Followers</div>
        </div>
        <div className="ip-stat">
          <div className="ip-val">{formatProfileValue(profile.likes)}</div>
          <div className="ip-lbl">Engagement</div>
        </div>
        <div className="ip-stat">
          <div className="ip-val ip-val-sm">{formatProfileValue(profile.growthVelocity)}</div>
          <div className="ip-lbl">Growth</div>
        </div>
      </div>
      <div className="ip-extra">
        <div><strong>Best time:</strong> {bestTime || '—'}</div>
        <div><strong>Trending niche:</strong> {profile.topTrendingNiche || '—'}</div>
        <div><strong>Suggested communities:</strong> {groups}</div>
      </div>
      {refreshedAt && (
        <p className="ip-ts">Last refreshed: {new Date(refreshedAt).toLocaleString()}</p>
      )}
    </div>
  );
}