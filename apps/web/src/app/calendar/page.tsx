'use client';

import { useCallback, useEffect, useState } from 'react';
import { invoke } from '@/lib/api';
import { PageShell } from '@/components/PageShell';
import { InvokePanel } from '@/components/InvokePanel';
import { IntelligenceRecommendations } from '@/components/IntelligenceRecommendations';
import { useIntelligence } from '@/hooks/useIntelligence';
import { displayBestTime, normalizeProfile } from '@/lib/intelligenceProfile';
import { CalendarGrid } from '@/components/CalendarGrid';
import { SectionLivePanel } from '@/components/SectionLivePanel';
import { AccountSelectField } from '@/components/AccountSelectField';
import Link from 'next/link';

type ScheduledPost = { id: string; content: string; timestamp: string; platform: string; status?: string };
type BestTimeSuggestion = { day?: string; hour?: number; label?: string; score?: number; reason?: string; avg?: number };
type BestTimesAnalysis = {
  dataPoints?: number;
  suggestions?: BestTimeSuggestion[];
  topHours?: Array<{ hour?: number; avg?: number; posts?: number }>;
  platformBestTimes?: Array<{ platform?: string; bestHourLabel?: string; posts?: number }>;
  timezoneNote?: string;
};

function normalizeBestTimes(data: unknown): BestTimesAnalysis {
  if (Array.isArray(data)) return { suggestions: data as BestTimeSuggestion[] };
  if (!data || typeof data !== 'object') return { suggestions: [] };
  const analysis = data as BestTimesAnalysis;
  const suggestions = analysis.suggestions?.length
    ? analysis.suggestions
    : (analysis.topHours || []).map((h, i) => ({
        hour: h.hour,
        avg: h.avg,
        label: `Hour ${h.hour ?? i}:00`,
        reason: h.posts ? `Based on ${h.posts} post(s)` : 'From engagement history',
      }));
  return { ...analysis, suggestions };
}

function toLocalInputValue(iso: string) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

export default function CalendarPage() {
  const { settings, accounts, isSurfaceEnabled } = useIntelligence();
  const [posts, setPosts] = useState<ScheduledPost[]>([]);
  const [content, setContent] = useState('');
  const [scheduleTime, setScheduleTime] = useState('');
  const [platform, setPlatform] = useState('');
  const [accountId, setAccountId] = useState('');
  const [mediaUrl, setMediaUrl] = useState('');
  const [calStatus, setCalStatus] = useState<Record<string, unknown>>({});
  const [bestTimes, setBestTimes] = useState<BestTimesAnalysis>({ suggestions: [] });
  const [msg, setMsg] = useState('');
  const [loading, setLoading] = useState(false);
  const [suggesting, setSuggesting] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const [list, status, times] = await Promise.all([
        invoke<ScheduledPost[]>('get-scheduled-posts'),
        invoke<Record<string, unknown>>('get-calendar-status'),
        invoke<BestTimesAnalysis>('get-best-post-times'),
      ]);
      setPosts(Array.isArray(list) ? list : []);
      setCalStatus(status || {});
      setBestTimes(normalizeBestTimes(times));
    } catch (e) {
      setMsg((e as Error).message);
    }
  }, []);

  useEffect(() => { refresh().catch(console.error); }, [refresh]);

  async function schedule() {
    if (!content.trim()) {
      setMsg('Enter post content before scheduling');
      return;
    }
    setLoading(true);
    setMsg('Scheduling post…');
    try {
      const accs = await invoke<Array<{ id: string; platform: string }>>('get-linked-accounts');
      const acc = accs.find((a) => a.id === accountId) || accs.find((a) => !platform || a.platform === platform) || accs[0];
      if (!acc) throw new Error('Link an account first in Account Hub');
      const when = scheduleTime || new Date(Date.now() + 86400000).toISOString();
      await invoke('schedule-post', {
        platform: acc.platform,
        accountId: acc.id,
        content: content.trim(),
        mediaUrl: mediaUrl || undefined,
        hasMedia: !!mediaUrl,
        scheduleTime: when,
      });
      setContent('');
      setMediaUrl('');
      setMsg('Post scheduled');
      await refresh();
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  function applyBestTime(suggestion: BestTimeSuggestion) {
    const d = new Date();
    if (suggestion.day) {
      const days = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
      const target = days.indexOf(suggestion.day.toLowerCase().slice(0, 3));
      if (target >= 0) {
        const diff = (target - d.getDay() + 7) % 7 || 7;
        d.setDate(d.getDate() + diff);
      }
    } else {
      d.setDate(d.getDate() + 1);
    }
    if (suggestion.hour != null) d.setHours(suggestion.hour, 0, 0, 0);
    const iso = d.toISOString();
    setScheduleTime(iso);
    setMsg(`Applied slot: ${suggestion.label || toLocalInputValue(iso)}`);
  }

  async function suggestBestTimes() {
    setSuggesting(true);
    setMsg('Analyzing best post times…');
    try {
      const times = await invoke<BestTimesAnalysis>('get-best-post-times');
      setBestTimes(normalizeBestTimes(times));
      setMsg('Best times updated from engagement history');
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setSuggesting(false);
    }
  }

  async function publishDueNow() {
    setLoading(true);
    setMsg('Publishing due posts…');
    try {
      const res = await invoke<{ published?: number; error?: string }>('process-due-scheduled-posts');
      setMsg(res.published ? `Published ${res.published} due post(s)` : (res.error || 'No due posts'));
      await refresh();
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function publishNow(id: string) {
    setMsg('Publishing…');
    try {
      await invoke('publish-scheduled-post-now', id);
      setMsg('Post published');
      await refresh();
    } catch (e) {
      setMsg((e as Error).message);
    }
  }

  async function removeScheduled(id: string) {
    setMsg('Removing…');
    try {
      await invoke('delete-scheduled-post', id);
      setMsg('Scheduled post removed');
      await refresh();
    } catch (e) {
      setMsg((e as Error).message);
    }
  }

  const msgIsError = /failed|error|first|enter|no due/i.test(msg);
  const dueNow = typeof calStatus.dueNow === 'number' ? calStatus.dueNow : null;
  const upcoming = typeof calStatus.upcoming === 'number' ? calStatus.upcoming : null;

  return (
    <div>
      <PageShell
        title="Calendar"
        actions={
          <>
            <Link href="/content-hub?tab=studio" className="btn primary">Create Content →</Link>
            <Link href="/scheduler" className="btn">Scheduler</Link>
            <Link href="/content-hub?tab=queue" className="btn">Review Queue</Link>
          </>
        }
      />

      <SectionLivePanel section="calendar" />

      {(dueNow != null || upcoming != null) && (
        <div className="card" style={{ marginBottom: '1rem' }}>
          <p className="settings-panel-desc" style={{ margin: 0 }}>
            <strong>{dueNow ?? 0}</strong> due now · <strong>{upcoming ?? 0}</strong> upcoming
            {typeof calStatus.scheduledCount === 'number' && <> · <strong>{calStatus.scheduledCount}</strong> total scheduled</>}
          </p>
        </div>
      )}

      <div className="grid grid-2">
        <div className="card">
          <h3>Schedule New Post</h3>
          <AccountSelectField value={accountId} onChange={setAccountId} label="Publish via account" />
          <textarea className="input" value={content} onChange={(e) => setContent(e.target.value)} rows={4} placeholder="Post content…" />
          <label className="ac-label" style={{ marginTop: 8 }}>Media URL (optional)</label>
          <input className="input" placeholder="https://… image or video" value={mediaUrl} onChange={(e) => setMediaUrl(e.target.value)} />
          <input className="input" placeholder="Platform filter (optional)" value={platform} onChange={(e) => setPlatform(e.target.value)} style={{ marginTop: 8 }} />
          <label className="ac-label" style={{ marginTop: 8 }}>Schedule time</label>
          <input
            className="input"
            type="datetime-local"
            style={{ marginTop: 4 }}
            value={toLocalInputValue(scheduleTime)}
            onChange={(e) => setScheduleTime(e.target.value ? new Date(e.target.value).toISOString() : '')}
          />
          <button type="button" className="btn primary" style={{ marginTop: 8 }} onClick={schedule} disabled={loading}>
            {loading ? 'Scheduling…' : 'Schedule Post'}
          </button>
        </div>
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
            <h3 style={{ margin: 0 }}>Best Post Times</h3>
            <button type="button" className="btn" onClick={suggestBestTimes} disabled={suggesting}>
              {suggesting ? 'Analyzing…' : 'Suggest Best Times'}
            </button>
          </div>
          {isSurfaceEnabled('calendar') && accounts.map((acc) => {
            const profile = normalizeProfile(acc.profile);
            const bestTime = displayBestTime(profile);
            if (!bestTime) return null;
            return (
              <div key={acc.id} style={{ marginBottom: 12, padding: 10, borderRadius: 8, border: '1px solid var(--border)', background: 'rgba(15,23,42,0.45)' }}>
                <p style={{ margin: '0 0 6px', fontSize: '0.8rem', color: '#94a3b8' }}>
                  <strong>{acc.platform}</strong> intelligence window
                </p>
                <p style={{ margin: 0, fontSize: '0.9rem' }}>{bestTime}</p>
              </div>
            );
          })}
          {isSurfaceEnabled('calendar') && accounts[0] && (
            <IntelligenceRecommendations account={accounts[0]} settings={settings} title="Scheduling intelligence" maxItems={2} />
          )}
          {bestTimes.dataPoints != null && (
            <p style={{ color: '#94a3b8', fontSize: '0.8rem', marginBottom: 8 }}>
              {bestTimes.dataPoints} data point{bestTimes.dataPoints === 1 ? '' : 's'}
              {bestTimes.timezoneNote ? ` · ${bestTimes.timezoneNote}` : ''}
            </p>
          )}
          {(bestTimes.suggestions || []).slice(0, 8).map((t, i) => (
            <div key={i} style={{ marginBottom: 10, fontSize: '0.85rem', display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'flex-start' }}>
              <div>
                <strong>{t.label || `Hour ${t.hour ?? i}:00`}</strong>
                {t.score != null && <span style={{ color: '#10b981', marginLeft: 8 }}>Score {t.score}</span>}
                <div style={{ color: '#94a3b8', marginTop: 2 }}>
                  {t.reason || (t.avg != null ? `Avg engagement ${Math.round(t.avg)}` : 'Industry benchmark')}
                </div>
              </div>
              <button type="button" className="btn" style={{ padding: '2px 8px', fontSize: '0.7rem' }} onClick={() => applyBestTime(t)}>Apply</button>
            </div>
          ))}
          {!bestTimes.suggestions?.length && <p style={{ color: '#94a3b8' }}>Publish posts to build engagement patterns.</p>}
          {(bestTimes.platformBestTimes || []).slice(0, 4).map((p, i) => (
            <div key={`plat-${i}`} style={{ fontSize: '0.75rem', color: '#64748b', marginTop: 4 }}>
              {p.platform}: best around {p.bestHourLabel} ({p.posts ?? 0} posts)
            </div>
          ))}
        </div>
      </div>

      {msg && (
        <div className="card" style={{ marginBottom: 12, borderColor: msgIsError ? '#f59e0b' : '#10b981' }}>
          <p style={{ margin: 0, fontSize: '0.9rem' }}>{msg}</p>
        </div>
      )}

      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
          <h3 style={{ margin: 0 }}>Calendar — month / week / list views</h3>
          <button type="button" className="btn primary" onClick={publishDueNow} disabled={loading}>
            Publish Due Now
          </button>
        </div>
        <CalendarGrid posts={posts} onRefresh={refresh} onApplyTime={(iso) => { setScheduleTime(iso); setMsg(`Time applied: ${toLocalInputValue(iso)}`); }} />
      </div>

      <div className="grid grid-2">
        <InvokePanel title="Upcoming by Platform" channel="get-upcoming-by-platform" args={[14]} buttonLabel="Load" />
        <InvokePanel title="Calendar Settings" channel="get-calendar-settings" buttonLabel="Load" />
        <InvokePanel title="Process Due Posts" channel="process-due-scheduled-posts" buttonLabel="Process Now" />
        <InvokePanel title="Background Run" channel="get-background-run-settings" buttonLabel="Load" />
      </div>

      <div className="card">
        <h3>Scheduled Queue ({posts.length})</h3>
        {!posts.length && <p className="settings-panel-desc">No scheduled posts — create content or schedule above.</p>}
        {posts.map((p) => (
          <div key={p.id} className="post-card">
            <div className="post-meta">
              <span className="badge">{p.platform}</span>
              {p.status && <span className="badge">{p.status}</span>}
              {new Date(p.timestamp).toLocaleString()}
            </div>
            <div>{p.content}</div>
            {p.status === 'failed' && (
              <p style={{ margin: '8px 0 0', fontSize: '0.8rem', color: '#f59e0b' }}>
                {(p as { error?: string }).error || 'Publish failed — re-link the account or refresh the access token.'}
                {/linkedin/i.test(p.platform || '') && (
                  <> <Link href="/account-hub">Re-link LinkedIn →</Link></>
                )}
              </p>
            )}
            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
              <button type="button" className="btn primary" onClick={() => publishNow(p.id)}>Publish Now</button>
              <button type="button" className="btn" onClick={() => removeScheduled(p.id)}>Delete</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}