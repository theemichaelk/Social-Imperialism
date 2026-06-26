'use client';

import { useCallback, useEffect, useState } from 'react';
import { invoke } from '@/lib/api';
import { DataPanel, MetricTile } from '@/components/DashboardViz';

type PostHistory = {
  id?: string;
  content?: string;
  platform?: string;
  timestamp?: string;
  stats?: { likes?: number; shares?: number; views?: number; comments?: number };
};

export function ContentAnalyticsPanel() {
  const [history, setHistory] = useState<PostHistory[]>([]);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState('');

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const data = await invoke<PostHistory[]>('get-all-post-history');
      setHistory(data || []);
      setMsg(data?.length ? `Loaded ${data.length} published posts` : 'No published posts yet');
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh().catch(console.error); }, [refresh]);

  const totals = history.reduce(
    (acc, h) => {
      const s = h.stats || {};
      acc.likes += s.likes || 0;
      acc.shares += s.shares || 0;
      acc.views += s.views || 0;
      acc.comments += s.comments || 0;
      return acc;
    },
    { likes: 0, shares: 0, views: 0, comments: 0 },
  );

  return (
    <DataPanel title="Post Analytics" live>
      <p className="settings-panel-desc">Real publish history from linked accounts — same metrics as desktop Content Hub analytics tab.</p>
      <button type="button" className="btn" onClick={refresh} disabled={loading} style={{ marginBottom: 12 }}>
        {loading ? 'Loading…' : 'Refresh Analytics'}
      </button>
      <div className="grid grid-4" style={{ marginBottom: 16 }}>
        <MetricTile label="Posts" value={history.length} />
        <MetricTile label="Likes" value={totals.likes} accent="#34d399" />
        <MetricTile label="Shares" value={totals.shares} accent="#a855f7" />
        <MetricTile label="Views" value={totals.views} accent="#fbbf24" />
      </div>
      {history.length === 0 ? (
        <p className="settings-panel-desc">Publish from Quick Post or Publish Wizard to populate analytics.</p>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table className="analytics-table" style={{ width: '100%', fontSize: '0.85rem' }}>
            <thead>
              <tr>
                <th>Content</th>
                <th>Platform</th>
                <th>Date</th>
                <th>Likes</th>
                <th>Shares</th>
                <th>Views</th>
                <th>Engagement</th>
              </tr>
            </thead>
            <tbody>
              {history.slice(0, 50).map((h, i) => {
                const s = h.stats || {};
                const eng = (s.likes || 0) + (s.shares || 0) + (s.comments || 0);
                return (
                  <tr key={h.id || i}>
                    <td>{(h.content || '').slice(0, 80)}{(h.content?.length || 0) > 80 ? '…' : ''}</td>
                    <td>{h.platform || '—'}</td>
                    <td>{h.timestamp ? new Date(h.timestamp).toLocaleString() : '—'}</td>
                    <td>{s.likes || 0}</td>
                    <td>{s.shares || 0}</td>
                    <td>{s.views || 0}</td>
                    <td>{eng}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {msg && <p style={{ marginTop: 8, color: '#94a3b8', fontSize: '0.85rem' }}>{msg}</p>}
    </DataPanel>
  );
}