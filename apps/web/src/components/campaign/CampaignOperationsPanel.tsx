'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { invoke } from '@/lib/api';
import { CampaignSwitcher } from '@/components/CampaignSwitcher';
import { DataPanel, focusBrandLabel, LivePulse, MetricTile, SparkRow } from '@/components/DashboardViz';
import { isQaCampaign, isQaScheduledPost } from '@/lib/qaFilters';

type Campaign = {
  id: string;
  brandName?: string;
  domain?: string;
  description?: string;
  tone?: string;
  audience?: string;
  status?: string;
  utmSource?: string;
  utmMedium?: string;
  primaryLink?: string;
  rules?: Record<string, unknown>;
};

type ScheduledPost = {
  id: string;
  content: string;
  timestamp: string;
  platform: string;
  status?: string;
  accountId?: string;
};

type CampaignDetails = {
  success?: boolean;
  error?: string;
  campaign?: Campaign;
  isActive?: boolean;
  isPaused?: boolean;
  isRunning?: boolean;
  workerRunning?: boolean;
  stats?: {
    keywords?: number;
    linkedAccounts?: number;
    scheduledPosts?: number;
    duePosts?: number;
    upcomingPosts?: number;
    aiReplies?: number;
    leads?: number;
  };
  scheduledPosts?: ScheduledPost[];
  keywords?: Array<{ id?: string; term?: string }>;
  linkedAccounts?: Array<{ id?: string; platform?: string; handle?: string }>;
};

type CampaignSummary = {
  id: string;
  brandName?: string;
  status?: string;
  keywords?: number;
  linkedAccounts?: number;
};

function toLocalDatetime(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function statusBadge(c: Campaign, isActive: boolean, isRunning?: boolean) {
  if (isRunning) return { label: 'Running', color: '#10b981' };
  if (c.status === 'Paused') return { label: 'Paused', color: '#f59e0b' };
  if (isActive) return { label: 'Active', color: '#38bdf8' };
  return { label: c.status || 'Draft', color: '#64748b' };
}

type Props = {
  onStatsChange?: (stats: { campaigns: number; active: string; running: string }) => void;
};

export function CampaignOperationsPanel({ onStatsChange }: Props) {
  const [summaries, setSummaries] = useState<CampaignSummary[]>([]);
  const [activeId, setActiveId] = useState('');
  const [selectedId, setSelectedId] = useState('');
  const [details, setDetails] = useState<CampaignDetails | null>(null);
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState<Partial<Campaign>>({});
  const [msg, setMsg] = useState('');
  const [loading, setLoading] = useState(false);
  const [newPost, setNewPost] = useState({ content: '', platform: 'Twitter', scheduleTime: '' });
  const [reschedule, setReschedule] = useState<Record<string, string>>({});
  const [hideQa, setHideQa] = useState(true);

  const loadList = useCallback(async () => {
    const [status, active] = await Promise.all([
      invoke<{ campaigns?: CampaignSummary[]; activeCampaignId?: string }>('get-settings-status'),
      invoke<Campaign | null>('get-active-campaign'),
    ]);
    const list = status.campaigns || [];
    setSummaries(list);
    const aid = status.activeCampaignId || active?.id || list[0]?.id || '';
    setActiveId(aid);
    setSelectedId((prev) => prev || aid);
  }, []);

  const loadDetails = useCallback(async (campaignId: string) => {
    if (!campaignId) return;
    const res = await invoke<CampaignDetails>('get-campaign-details', campaignId);
    if (!res.success) {
      setMsg(res.error || 'Could not load campaign');
      return;
    }
    setDetails(res);
    setEditForm(res.campaign || {});
    setReschedule({});
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      await loadList();
      if (selectedId) await loadDetails(selectedId);
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [loadList, loadDetails, selectedId]);

  useEffect(() => { loadList().catch(console.error); }, [loadList]);

  useEffect(() => {
    if (selectedId) loadDetails(selectedId).catch(console.error);
  }, [selectedId, loadDetails]);

  const visibleSummaries = hideQa ? summaries.filter((s) => !isQaCampaign(s)) : summaries;
  const qaCampaignCount = summaries.filter((s) => isQaCampaign(s)).length;
  const activeBrand = summaries.find((s) => s.id === activeId)?.brandName || '—';
  const failedPosts = (details?.scheduledPosts || []).filter((p) => p.status === 'failed');
  const failedPlatforms = [...new Set(failedPosts.map((p) => p.platform).filter(Boolean))];

  useEffect(() => {
    onStatsChange?.({
      campaigns: visibleSummaries.length,
      active: focusBrandLabel(activeBrand, 22),
      running: details?.isRunning ? 'Yes' : details?.workerRunning ? 'Worker' : 'No',
    });
  }, [visibleSummaries.length, activeBrand, details, onStatsChange]);

  async function activate(id: string) {
    await invoke('set-active-campaign', id);
    setActiveId(id);
    setSelectedId(id);
    setMsg('Campaign activated');
    await refresh();
  }

  async function pause(id: string) {
    const res = await invoke<{ success?: boolean; error?: string }>('pause-campaign', id);
    if (!res.success) { setMsg(res.error || 'Pause failed'); return; }
    setMsg('Campaign paused — worker stopped for this campaign');
    await refresh();
  }

  async function resume(id: string) {
    const res = await invoke<{ success?: boolean; error?: string }>('resume-campaign', id);
    if (!res.success) { setMsg(res.error || 'Resume failed'); return; }
    setMsg('Campaign resumed');
    await refresh();
  }

  async function remove(id: string) {
    const name = summaries.find((s) => s.id === id)?.brandName || 'this campaign';
    if (!window.confirm(`Delete "${name}" and all its keywords, scheduled posts, and linked data?`)) return;
    const res = await invoke<{ success?: boolean; campaigns?: CampaignSummary[]; error?: string }>('delete-campaign', id);
    if (!res.success) { setMsg(res.error || 'Delete failed'); return; }
    setSummaries(res.campaigns || []);
    const next = res.campaigns?.[0]?.id || '';
    setSelectedId(next);
    setActiveId(next);
    setMsg('Campaign deleted');
    if (next) await loadDetails(next);
    else setDetails(null);
  }

  async function saveEdit() {
    if (!selectedId) return;
    if (!editForm.brandName?.trim() || !editForm.domain?.trim()) {
      setMsg('Brand name and domain are required');
      return;
    }
    const res = await invoke<{ success?: boolean; error?: string }>('update-campaign', {
      campaignId: selectedId,
      updates: editForm,
    });
    if (!res.success) { setMsg(res.error || 'Save failed'); return; }
    setEditing(false);
    setMsg('Campaign updated');
    await refresh();
  }

  async function reschedulePost(postId: string) {
    const time = reschedule[postId];
    if (!time) { setMsg('Pick a new date and time first'); return; }
    await invoke('update-scheduled-post', { id: postId, updates: { scheduleTime: new Date(time).toISOString() } });
    setMsg('Post rescheduled');
    await loadDetails(selectedId);
  }

  async function deletePost(postId: string) {
    if (!window.confirm('Remove this scheduled post?')) return;
    await invoke('delete-scheduled-post', postId);
    setMsg('Scheduled post removed');
    await loadDetails(selectedId);
  }

  async function publishNow(postId: string) {
    setMsg('Publishing now…');
    const res = await invoke<{ success?: boolean; error?: string }>('publish-scheduled-post-now', postId);
    if (!res.success) { setMsg(res.error || 'Publish failed'); return; }
    setMsg('Post published');
    await loadDetails(selectedId);
  }

  async function clearQaCampaigns() {
    if (!window.confirm(`Remove ${qaCampaignCount} QA/test campaign(s)? Production campaigns are kept.`)) return;
    const res = await invoke<{ success?: boolean; removed?: number; campaigns?: CampaignSummary[]; error?: string }>('clear-qa-campaigns');
    if (!res.success) { setMsg(res.error || 'Clear failed'); return; }
    setSummaries(res.campaigns || []);
    const next = res.campaigns?.[0]?.id || '';
    setSelectedId(next);
    setActiveId(next);
    setMsg(`Removed ${res.removed ?? 0} QA campaign(s)`);
    if (next) await loadDetails(next);
    else setDetails(null);
  }

  async function clearFailedPosts() {
    if (!selectedId || !failedPosts.length) return;
    if (!window.confirm(`Remove ${failedPosts.length} failed scheduled post(s)?`)) return;
    const res = await invoke<{ success?: boolean; removed?: number; error?: string }>('clear-failed-scheduled-posts', selectedId);
    if (!res.success) { setMsg(res.error || 'Clear failed'); return; }
    setMsg(`Cleared ${res.removed ?? 0} failed post(s)`);
    await loadDetails(selectedId);
  }

  async function scheduleNewPost() {
    if (!newPost.content.trim()) { setMsg('Post content is required'); return; }
    if (!newPost.scheduleTime) { setMsg('Pick a schedule time'); return; }
    await invoke('schedule-post', {
      campaignId: selectedId,
      content: newPost.content,
      platform: newPost.platform,
      scheduleTime: new Date(newPost.scheduleTime).toISOString(),
    });
    setNewPost({ content: '', platform: 'Twitter', scheduleTime: '' });
    setMsg('Post scheduled');
    await loadDetails(selectedId);
  }

  const camp = details?.campaign;
  const badge = camp ? statusBadge(camp, !!details?.isActive, details?.isRunning) : null;

  return (
    <div className="campaign-manager-page">
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 12 }}>
        <CampaignSwitcher onSwitch={() => refresh()} />
        <button type="button" className="btn" onClick={() => refresh()} disabled={loading}>Refresh</button>
        <Link href="/calendar" className="btn">Open Calendar</Link>
      </div>

      {msg && (
        <div className="card" style={{ marginBottom: 12, borderColor: /failed|error|required/i.test(msg) ? '#ef4444' : '#10b981' }}>
          <p style={{ margin: 0, fontSize: '0.9rem' }}>{msg}</p>
        </div>
      )}

      <div className="grid grid-2" style={{ alignItems: 'start', gap: 16 }}>
        <DataPanel title={`All Campaigns (${visibleSummaries.length})`} live>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 10 }}>
            <label style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: '0.82rem' }}>
              <input type="checkbox" checked={hideQa} onChange={(e) => setHideQa(e.target.checked)} />
              Hide QA campaigns
            </label>
            {qaCampaignCount > 0 && (
              <button type="button" className="btn btn-sm" onClick={clearQaCampaigns}>Clear {qaCampaignCount} QA</button>
            )}
          </div>
          {visibleSummaries.length === 0 && (
            <p className="settings-panel-desc">No campaigns yet. <Link href="/onboarding">Run Setup Wizard</Link> or create one in Settings.</p>
          )}
          {visibleSummaries.map((s) => {
            const isSel = s.id === selectedId;
            const isAct = s.id === activeId;
            const st = s.status === 'Paused' ? 'Paused' : isAct ? 'Active' : (s.status || 'Draft');
            return (
              <button
                key={s.id}
                type="button"
                className={`post-card ${isSel ? 'campaign-active' : ''}`}
                style={{ width: '100%', textAlign: 'left', cursor: 'pointer', marginBottom: 8 }}
                onClick={() => setSelectedId(s.id)}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                  <div>
                    <strong>{s.brandName || 'Unnamed'}</strong>
                    {isAct && <span className="badge" style={{ marginLeft: 8 }}>Active</span>}
                    <div className="post-meta">{st} · {s.keywords ?? 0} keywords · {s.linkedAccounts ?? 0} accounts</div>
                  </div>
                  {isSel && <LivePulse label="VIEWING" />}
                </div>
              </button>
            );
          })}
        </DataPanel>

        {camp && details?.success && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <DataPanel title={camp.brandName || 'Campaign'} live>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', marginBottom: 12 }}>
                {badge && (
                  <span className="badge" style={{ borderColor: badge.color, color: badge.color }}>
                    {badge.label}
                  </span>
                )}
                {details.isRunning && <LivePulse label="WORKER LIVE" />}
                {details.workerRunning && !details.isPaused && <span className="post-meta">Automation worker scanning</span>}
              </div>

              <SparkRow items={[
                { label: 'Keywords', value: details.stats?.keywords ?? 0, status: 'ok' },
                { label: 'Accounts', value: details.stats?.linkedAccounts ?? 0, status: 'ok' },
                { label: 'Scheduled', value: details.stats?.scheduledPosts ?? 0 },
                { label: 'Due now', value: details.stats?.duePosts ?? 0, status: (details.stats?.duePosts ?? 0) > 0 ? 'warn' : 'ok' },
                { label: 'AI Replies', value: details.stats?.aiReplies ?? 0 },
                { label: 'Leads', value: details.stats?.leads ?? 0 },
              ]} />

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
                {!details.isActive && (
                  <button type="button" className="btn primary" onClick={() => activate(camp.id)}>Set Active</button>
                )}
                {details.isPaused || camp.status === 'Paused' ? (
                  <button type="button" className="btn primary" onClick={() => resume(camp.id)}>Resume</button>
                ) : (
                  <button type="button" className="btn" onClick={() => pause(camp.id)}>Pause</button>
                )}
                <button type="button" className="btn" onClick={() => setEditing((e) => !e)}>{editing ? 'Cancel Edit' : 'Edit'}</button>
                <Link href="/keywords" className="btn">Keywords</Link>
                <Link href="/account-hub" className="btn">Accounts</Link>
                <Link href="/rules" className="btn">Auto-Rules</Link>
                <button type="button" className="btn" style={{ color: '#ef4444', borderColor: '#ef4444' }} onClick={() => remove(camp.id)}>Delete</button>
              </div>
            </DataPanel>

            {editing ? (
              <DataPanel title="Edit Campaign">
                <div className="grid grid-2" style={{ gap: 8 }}>
                  <input className="input" placeholder="Brand name *" value={editForm.brandName || ''} onChange={(e) => setEditForm({ ...editForm, brandName: e.target.value })} />
                  <input className="input" placeholder="Domain *" value={editForm.domain || ''} onChange={(e) => setEditForm({ ...editForm, domain: e.target.value })} />
                  <input className="input" placeholder="Tone" value={editForm.tone || ''} onChange={(e) => setEditForm({ ...editForm, tone: e.target.value })} />
                  <input className="input" placeholder="Audience" value={editForm.audience || ''} onChange={(e) => setEditForm({ ...editForm, audience: e.target.value })} />
                  <input className="input" placeholder="UTM source" value={editForm.utmSource || ''} onChange={(e) => setEditForm({ ...editForm, utmSource: e.target.value })} />
                  <input className="input" placeholder="UTM medium" value={editForm.utmMedium || ''} onChange={(e) => setEditForm({ ...editForm, utmMedium: e.target.value })} />
                  <textarea className="input" style={{ gridColumn: '1 / -1' }} rows={3} placeholder="Description" value={editForm.description || ''} onChange={(e) => setEditForm({ ...editForm, description: e.target.value })} />
                </div>
                <button type="button" className="btn primary" style={{ marginTop: 12 }} onClick={saveEdit}>Save Changes</button>
              </DataPanel>
            ) : (
              <DataPanel title="Campaign Data">
                <div className="grid grid-2" style={{ fontSize: '0.88rem', gap: 8 }}>
                  <div><span className="post-meta">Domain</span><br /><strong>{camp.domain || '—'}</strong></div>
                  <div><span className="post-meta">Tone</span><br /><strong>{camp.tone || '—'}</strong></div>
                  <div><span className="post-meta">Audience</span><br /><strong>{camp.audience || '—'}</strong></div>
                  <div><span className="post-meta">UTM</span><br /><strong>{camp.utmSource || '—'} / {camp.utmMedium || '—'}</strong></div>
                  {camp.description && (
                    <div style={{ gridColumn: '1 / -1' }}>
                      <span className="post-meta">Description</span>
                      <p style={{ margin: '4px 0 0' }}>{camp.description}</p>
                    </div>
                  )}
                </div>
                {(details.keywords?.length ?? 0) > 0 && (
                  <div style={{ marginTop: 12 }}>
                    <span className="post-meta">Keywords</span>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
                      {details.keywords!.slice(0, 12).map((k, i) => (
                        <span key={k.id || i} className="badge">{k.term}</span>
                      ))}
                      {(details.keywords?.length ?? 0) > 12 && <span className="post-meta">+{details.keywords!.length - 12} more</span>}
                    </div>
                  </div>
                )}
              </DataPanel>
            )}

            <DataPanel title={`Scheduled Posts (${details.scheduledPosts?.length ?? 0})`} live>
              {failedPosts.length > 0 && (
                <div className="card" style={{ marginBottom: 12, borderColor: '#ef4444' }}>
                  <p style={{ margin: '0 0 8px', fontSize: '0.88rem' }}>
                    <strong>{failedPosts.length} failed</strong>
                    {failedPlatforms.length > 0 && ` — likely ${failedPlatforms.join(', ')} token or permission issue.`}
                    {' '}Reconnect in Account Hub, then retry or clear.
                  </p>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <Link href={`/account-hub${failedPlatforms[0] ? `?relink=${encodeURIComponent(failedPlatforms[0])}` : ''}`} className="btn primary">Reconnect accounts</Link>
                    <button type="button" className="btn" onClick={clearFailedPosts}>Clear failed</button>
                  </div>
                </div>
              )}
              {(details.scheduledPosts?.length ?? 0) === 0 ? (
                <p className="settings-panel-desc">No posts scheduled for this campaign yet.</p>
              ) : (
                details.scheduledPosts!.map((p) => {
                  const due = new Date(p.timestamp).getTime() <= Date.now();
                  const failed = p.status === 'failed';
                  const qaPost = isQaScheduledPost(p);
                  return (
                    <div key={p.id} className="post-card" style={{ marginBottom: 8, borderColor: failed ? 'rgba(239,68,68,0.45)' : undefined }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
                        <div style={{ flex: 1, minWidth: 200 }}>
                          <strong>{p.platform}</strong>
                          {failed && <span className="badge" style={{ marginLeft: 8, color: '#ef4444' }}>Failed</span>}
                          {due && !failed && <span className="badge" style={{ marginLeft: 8, color: '#f59e0b' }}>Due</span>}
                          {qaPost && <span className="badge" style={{ marginLeft: 8 }}>QA</span>}
                          <div className="post-meta">{new Date(p.timestamp).toLocaleString()} · {p.status || 'scheduled'}</div>
                          {failed && (
                            <p style={{ margin: '4px 0 0', fontSize: '0.78rem', color: '#f87171' }}>
                              Publish failed — refresh {p.platform} OAuth in Account Hub (w_member_social for LinkedIn).
                            </p>
                          )}
                          <p style={{ margin: '6px 0 0', fontSize: '0.85rem' }}>{p.content.slice(0, 160)}{p.content.length > 160 ? '…' : ''}</p>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 180 }}>
                          <input
                            className="input"
                            type="datetime-local"
                            value={reschedule[p.id] ?? toLocalDatetime(p.timestamp)}
                            onChange={(e) => setReschedule({ ...reschedule, [p.id]: e.target.value })}
                          />
                          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                            <button type="button" className="btn" onClick={() => reschedulePost(p.id)}>Reschedule</button>
                            <button type="button" className="btn" onClick={() => publishNow(p.id)}>Publish now</button>
                            <button type="button" className="btn" onClick={() => deletePost(p.id)}>Delete</button>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}

              <div className="card" style={{ marginTop: 12 }}>
                <h4 style={{ margin: '0 0 8px' }}>Schedule new post</h4>
                <textarea className="input" rows={3} placeholder="Post content" value={newPost.content} onChange={(e) => setNewPost({ ...newPost, content: e.target.value })} />
                <div className="grid grid-2" style={{ gap: 8, marginTop: 8 }}>
                  <select className="input" value={newPost.platform} onChange={(e) => setNewPost({ ...newPost, platform: e.target.value })}>
                    {['Twitter', 'LinkedIn', 'Facebook', 'Instagram', 'Reddit', 'YouTube', 'TikTok'].map((pl) => (
                      <option key={pl} value={pl}>{pl}</option>
                    ))}
                  </select>
                  <input className="input" type="datetime-local" value={newPost.scheduleTime} onChange={(e) => setNewPost({ ...newPost, scheduleTime: e.target.value })} />
                </div>
                <button type="button" className="btn primary" style={{ marginTop: 8 }} onClick={scheduleNewPost}>Schedule Post</button>
              </div>
            </DataPanel>
          </div>
        )}
      </div>

      <div className="dash-hero" style={{ marginTop: 16 }}>
        <div className="dash-hero-grid">
          <MetricTile label="Total Campaigns" value={visibleSummaries.length} />
          <MetricTile
            label="Active Campaign"
            value={focusBrandLabel(activeBrand, 20)}
            title={activeBrand}
            accent="#38bdf8"
          />
          <MetricTile
            label="Worker"
            value={details?.isRunning ? 'Running' : details?.isPaused ? 'Paused' : details?.workerRunning ? 'Idle' : 'No Worker'}
            accent={details?.isRunning ? '#10b981' : '#64748b'}
          />
          <MetricTile label="Scheduled" value={details?.stats?.scheduledPosts ?? 0} sub={`${details?.stats?.duePosts ?? 0} due${failedPosts.length ? ` · ${failedPosts.length} failed` : ''}`} />
        </div>
      </div>
    </div>
  );
}