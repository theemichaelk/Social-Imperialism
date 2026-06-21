'use client';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { invoke } from '@/lib/api';
import { IntelligenceProfilePanel } from '@/components/IntelligenceProfilePanel';
import { normalizeProfile } from '@/lib/intelligenceProfile';
import { SocialPostCard } from '@/components/SocialPostCard';
import { enrichGeneratedItem } from '@/lib/imperialContentTemplates';

type Account = {
  id: string;
  platform: string;
  handle?: string;
  profile?: Record<string, unknown>;
  profileRefreshedAt?: string;
};

type Group = { id: string; name: string; privacy?: string; type?: string };
type HistoryPost = { id: string; content?: string; platform?: string; timestamp?: string };

const STEPS = [
  { id: 'compose', label: 'Compose Post' },
  { id: 'groups', label: 'Groups & Communities' },
  { id: 'profile', label: 'Intelligence Profile' },
  { id: 'activity', label: 'Recent Activity' },
] as const;

type StepId = (typeof STEPS)[number]['id'];

export function PublishWizard({ accounts }: { accounts: Account[] }) {
  const [step, setStep] = useState<StepId>('compose');
  const [accountId, setAccountId] = useState('');
  const [content, setContent] = useState('');
  const [groupContent, setGroupContent] = useState('');
  const [groups, setGroups] = useState<Group[]>([]);
  const [selectedGroup, setSelectedGroup] = useState('');
  const [humanLike, setHumanLike] = useState(true);
  const [activity, setActivity] = useState<HistoryPost[]>([]);
  const [status, setStatus] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const account = accounts.find((a) => a.id === accountId) || accounts[0];
  const profile = normalizeProfile(account?.profile);

  useEffect(() => {
    if (!accountId && accounts[0]?.id) setAccountId(accounts[0].id);
  }, [accounts, accountId]);

  const loadActivity = useCallback(async () => {
    const hist = await invoke<HistoryPost[]>('get-post-history');
    setActivity((hist || []).slice(0, 12));
  }, []);

  useEffect(() => { loadActivity().catch(console.error); }, [loadActivity]);

  async function enhance() {
    setStatus('Enhancing…');
    setContent(await invoke<string>('generate-ai', `Enhance this social post: ${content}`));
    setStatus('Enhanced');
  }

  async function publish() {
    if (!account) { setStatus('Link an account first'); return; }
    setStatus('Publishing…');
    await invoke('publish-post', {
      accountId: account.id,
      platform: account.platform,
      content,
      hasMedia: false,
      humanLike,
    });
    setStatus(`Published via ${account.platform}`);
    loadActivity();
  }

  async function refreshGroups() {
    if (!account) return;
    setStatus('Loading groups…');
    const res = await invoke<{ groups?: Group[] } | Group[]>('get-account-groups', account.id);
    const list = Array.isArray(res) ? res : (res.groups || []);
    setGroups(list);
    setStatus(list.length ? `${list.length} group(s) loaded` : 'No groups found — refresh profile in Account Hub');
  }

  async function publishToGroup() {
    if (!account || !selectedGroup || !groupContent.trim()) {
      setStatus('Select a group and write content');
      return;
    }
    setStatus('Posting to group…');
    const res = await invoke<{ success?: boolean; error?: string }>('publish-to-group', {
      accountId: account.id,
      groupId: selectedGroup,
      content: groupContent,
      humanLike,
    });
    setStatus(res.success ? 'Posted to group' : (res.error || 'Group post failed'));
    loadActivity();
  }

  async function refreshProfile() {
    if (!account) return;
    setRefreshing(true);
    setStatus('Refreshing profile…');
    try {
      await invoke('refresh-account-profile', account.id);
      setStatus('Profile refreshed');
    } catch (e) {
      setStatus((e as Error).message);
    } finally {
      setRefreshing(false);
    }
  }

  return (
    <div className="publish-wizard">
      <p className="pw-hint">
        Per-account automation is configured in <Link href="/rules">Auto-Rules</Link>, not here.
      </p>

      <label style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Social Account</label>
      <select className="input" value={accountId} onChange={(e) => setAccountId(e.target.value)} style={{ marginBottom: 12 }}>
        {accounts.map((a) => (
          <option key={a.id} value={a.id}>{a.platform} — {a.handle || a.id}</option>
        ))}
        {!accounts.length && <option value="">No accounts linked</option>}
      </select>

      <div className="pw-step-nav">
        {STEPS.map((s) => (
          <button
            key={s.id}
            type="button"
            className={`pw-step ${step === s.id ? 'active' : ''}`}
            onClick={() => setStep(s.id)}
          >
            {s.label}
          </button>
        ))}
      </div>

      {step === 'compose' && (
        <div className="pw-panel pw-compose-split">
          <div>
            <textarea
              className="input"
              rows={8}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Write your post — Social Imperialism keeps it on-brand…"
            />
            <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.85rem', color: '#94a3b8' }}>
                <input type="checkbox" checked={humanLike} onChange={(e) => setHumanLike(e.target.checked)} />
                Human-like delay
              </label>
              <button className="btn" type="button" onClick={enhance}>AI Enhance</button>
              <button className="btn primary" type="button" onClick={publish} disabled={!content.trim()}>Publish Now</button>
            </div>
          </div>
          <div className="pw-live-preview">
            <p className="ac-label">Live preview</p>
            <SocialPostCard
              post={enrichGeneratedItem({
                id: 'preview',
                type: 'post',
                content: content || 'Your on-brand post preview appears here…',
                platform: account?.platform,
                templateId: 'promotional-design',
                status: 'draft',
              })}
            />
          </div>
        </div>
      )}

      {step === 'groups' && (
        <div className="pw-panel">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <h4 style={{ margin: 0 }}>Groups &amp; Communities</h4>
            <button className="btn" type="button" onClick={refreshGroups}>Refresh Groups</button>
          </div>
          <p style={{ fontSize: '0.8rem', color: '#64748b', margin: '0 0 12px' }}>
            Select a group to post with human-like delays. Facebook groups need publish_to_groups scope.
          </p>
          <div className="pw-groups-list">
            {groups.map((g) => (
              <label key={g.id} className="post-card" style={{ display: 'flex', gap: 8, cursor: 'pointer' }}>
                <input
                  type="radio"
                  name="pwGroup"
                  checked={selectedGroup === g.id}
                  onChange={() => setSelectedGroup(g.id)}
                />
                <div>
                  <div style={{ fontWeight: 600 }}>{g.name}</div>
                  <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{g.privacy || g.type || 'group'}</div>
                </div>
              </label>
            ))}
            {!groups.length && (
              <p style={{ color: '#64748b', fontStyle: 'italic' }}>No groups loaded — click Refresh Groups.</p>
            )}
          </div>
          <textarea
            className="input"
            rows={5}
            value={groupContent}
            onChange={(e) => setGroupContent(e.target.value)}
            placeholder="Write content to post in the selected group…"
            style={{ marginTop: 12 }}
          />
          <button className="btn primary" type="button" onClick={publishToGroup} style={{ marginTop: 8 }}>
            Post to Group
          </button>
        </div>
      )}

      {step === 'profile' && (
        <div className="pw-panel">
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <h4 style={{ margin: 0 }}>Live Account Intelligence</h4>
            <button className="btn" type="button" disabled={refreshing} onClick={refreshProfile}>
              {refreshing ? 'Refreshing…' : 'Refresh'}
            </button>
          </div>
          {account && profile ? (
            <IntelligenceProfilePanel account={account} profile={profile} refreshedAt={account.profileRefreshedAt} />
          ) : (
            <p style={{ color: '#64748b' }}>No profile yet — refresh from Account Hub or click Refresh above.</p>
          )}
        </div>
      )}

      {step === 'activity' && (
        <div className="pw-panel">
          <h4 style={{ margin: '0 0 12px' }}>Recent Published Activity</h4>
          {activity.map((p) => (
            <div key={p.id} className="post-card">
              <span className="badge">{p.platform}</span>
              {p.timestamp && <span style={{ fontSize: '0.75rem', color: '#64748b', marginLeft: 8 }}>
                {new Date(p.timestamp).toLocaleString()}
              </span>}
              <div style={{ marginTop: 4 }}>{(p.content || '').slice(0, 200)}</div>
            </div>
          ))}
          {!activity.length && (
            <p style={{ color: '#64748b', fontStyle: 'italic' }}>No published posts yet — compose above and click Publish Now.</p>
          )}
        </div>
      )}

      {status && <p style={{ marginTop: 8, fontSize: '0.85rem', color: '#94a3b8' }}>{status}</p>}
    </div>
  );
}