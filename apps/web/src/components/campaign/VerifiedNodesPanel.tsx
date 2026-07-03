'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { invoke } from '@/lib/api';

type VerificationRun = {
  tier: number;
  tierName: string;
  success: boolean;
  createdAt: string;
};

type VerifiedNode = {
  id: string;
  platform: string;
  nodeType: string;
  externalId: string;
  displayName: string | null;
  depth: number;
  parentNodeId: string | null;
  verificationState: string;
  strikeCount: number;
  lastTestedAt: string | null;
  lastTestSuccessAt: string | null;
  lastTierPassed: number;
  lastError: string | null;
  memberCount: number | null;
  privacyState: string | null;
  verified: boolean;
  badge?: { color: string; label: string };
  verificationRuns?: VerificationRun[];
};

type Campaign = {
  id: string;
  name: string;
  status: string;
  targetUrl: string;
  timezone: string;
  frequencyCron: string | null;
  burstIntervalM: number | null;
  nodeBindings?: Array<{ nodeId: string; enabled: boolean; node?: VerifiedNode }>;
};

const STATE_COLORS: Record<string, string> = {
  VERIFIED: '#22c55e',
  REPAIR_LOOP: '#f59e0b',
  AWAITING_ACTION: '#ef4444',
  PENDING_VERIFICATION: '#38bdf8',
  DISCOVERED: '#94a3b8',
  TIER1_PASSED: '#a855f7',
  TIER2_PASSED: '#c084fc',
};

function formatTime(iso: string | null) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

function Badge({ state, successAt }: { state: string; successAt: string | null }) {
  const color = STATE_COLORS[state] || '#64748b';
  const label = state === 'VERIFIED' && successAt
    ? `Verified ${formatTime(successAt)}`
    : state.replace(/_/g, ' ');
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '2px 10px',
        borderRadius: 999,
        fontSize: '0.72rem',
        fontWeight: 600,
        background: `${color}22`,
        color,
        border: `1px solid ${color}55`,
      }}
    >
      {state === 'VERIFIED' && <span style={{ width: 8, height: 8, borderRadius: '50%', background: color }} />}
      {label}
    </span>
  );
}

export function VerifiedNodesPanel() {
  const [nodes, setNodes] = useState<VerifiedNode[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [selectedCampaign, setSelectedCampaign] = useState('');
  const [selectedNodes, setSelectedNodes] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState('');
  const [brandTargetUrl, setBrandTargetUrl] = useState('https://www.socialimperialism.com');
  const [stats, setStats] = useState({ verified: 0, awaiting: 0, total: 0 });
  const [newCampaignName, setNewCampaignName] = useState('');

  const verifiedNodes = useMemo(
    () => nodes.filter((n) => n.verificationState === 'VERIFIED' && n.lastTestSuccessAt),
    [nodes],
  );

  const treeByPlatform = useMemo(() => {
    const map: Record<string, VerifiedNode[]> = {};
    for (const n of nodes) {
      if (!map[n.platform]) map[n.platform] = [];
      map[n.platform].push(n);
    }
    return Object.entries(map).sort(([a], [b]) => a.localeCompare(b));
  }, [nodes]);

  const refresh = useCallback(async () => {
    setLoading(true);
    setMsg('');
    try {
      const [treeRes, campRes, activeBrand] = await Promise.all([
        invoke<{ nodes: VerifiedNode[]; verifiedCount: number; awaitingAction: number }>('get-verified-node-tree'),
        invoke<{ campaigns: Campaign[] }>('list-verified-campaigns'),
        invoke<{ domain?: string; brandName?: string } | null>('get-active-campaign').catch(() => null),
      ]);
      if (activeBrand?.domain) {
        const d = activeBrand.domain.replace(/^https?:\/\//i, '').replace(/\/$/, '');
        setBrandTargetUrl(`https://${d}`);
      }
      setNodes(treeRes?.nodes || []);
      setStats({
        verified: treeRes?.verifiedCount || 0,
        awaiting: treeRes?.awaitingAction || 0,
        total: treeRes?.nodes?.length || 0,
      });
      setCampaigns(campRes?.campaigns || []);
      if (!selectedCampaign && campRes?.campaigns?.[0]) {
        setSelectedCampaign(campRes.campaigns[0].id);
      }
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [selectedCampaign]);

  useEffect(() => { refresh(); }, [refresh]);

  async function discoverAndVerify() {
    setLoading(true);
    setMsg('Discovering and running 3-tier verification…');
    try {
      const res = await invoke<{ verified: number; failed: number }>('discover-verify-platform-tree', {
        autoVerify: true,
        targetUrl: brandTargetUrl,
      });
      setMsg(`Discovery complete — ${res?.verified || 0} verified, ${res?.failed || 0} need repair.`);
      await refresh();
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function reverifyAll() {
    setLoading(true);
    try {
      const res = await invoke<{ passed: number; total: number }>('run-verification-loop-all', {});
      setMsg(`Re-verification: ${res?.passed}/${res?.total} passed.`);
      await refresh();
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function reverifyNode(nodeId: string) {
    setLoading(true);
    try {
      await invoke('run-node-verification', nodeId, {});
      await refresh();
      setMsg('Node re-verified.');
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function createCampaign() {
    if (!newCampaignName.trim()) return;
    setLoading(true);
    try {
      const res = await invoke<{ success?: boolean; campaign?: Campaign; error?: string }>('create-verified-campaign', {
        name: newCampaignName.trim(),
        targetUrl: brandTargetUrl,
      });
      if (res?.success === false) {
        setMsg(res.error || 'Create failed');
        return;
      }
      setNewCampaignName('');
      if (res?.campaign) setSelectedCampaign(res.campaign.id);
      await refresh();
      setMsg(`Campaign "${res?.campaign?.name}" created.`);
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function bindSelected() {
    const nodeIds = Object.entries(selectedNodes).filter(([, v]) => v).map(([id]) => id);
    if (!selectedCampaign || !nodeIds.length) {
      setMsg('Select a campaign and at least one verified node.');
      return;
    }
    setLoading(true);
    try {
      await invoke('bind-campaign-verified-nodes', { campaignId: selectedCampaign, nodeIds });
      setMsg(`Bound ${nodeIds.length} verified node(s) to campaign.`);
      await refresh();
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function campaignAction(action: 'pause' | 'running' | 'delete') {
    if (!selectedCampaign) return;
    if (action === 'delete' && !window.confirm('Delete this campaign and its scheduled posts?')) return;
    setLoading(true);
    try {
      await invoke('set-campaign-control', { campaignId: selectedCampaign, action });
      if (action === 'delete') setSelectedCampaign('');
      await refresh();
      setMsg(`Campaign ${action === 'running' ? 'resumed' : action}.`);
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  const activeCampaign = campaigns.find((c) => c.id === selectedCampaign);

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: '1rem' }}>
        <button type="button" className="btn primary" onClick={discoverAndVerify} disabled={loading}>
          Discover & Verify
        </button>
        <button type="button" className="btn" onClick={reverifyAll} disabled={loading}>
          Re-verify All
        </button>
        <Link href="/account-hub" className="btn">Connect Accounts</Link>
      </div>

      {msg && (
        <div className="card" style={{ marginBottom: '1rem', padding: '0.75rem 1rem', color: '#94a3b8' }}>
          {msg}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12, marginBottom: '1.25rem' }}>
        {[
          { label: 'Total Nodes', value: stats.total, color: '#38bdf8' },
          { label: 'Verified', value: stats.verified, color: '#22c55e' },
          { label: 'Awaiting Action', value: stats.awaiting, color: '#ef4444' },
          { label: 'Platforms', value: treeByPlatform.length, color: '#a855f7' },
        ].map((s) => (
          <div key={s.label} className="card" style={{ textAlign: 'center', padding: '1rem' }}>
            <div style={{ fontSize: '1.75rem', fontWeight: 800, color: s.color }}>{s.value}</div>
            <div style={{ fontSize: '0.8rem', color: '#94a3b8', marginTop: 4 }}>{s.label}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: '1.25rem', alignItems: 'start' }}>
        <div className="card">
          <h3 style={{ marginTop: 0 }}>Verified Tree Matrix</h3>
          {nodes.length === 0 ? (
            <p style={{ color: '#94a3b8' }}>
              No nodes yet. Connect platforms in{' '}
              <Link href="/account-hub">Account Hub</Link>, then click Discover & Verify.
            </p>
          ) : (
            treeByPlatform.map(([platform, platformNodes]) => (
              <div key={platform} style={{ marginBottom: '1.25rem' }}>
                <div style={{ fontWeight: 700, color: '#00d4ff', marginBottom: 8, fontSize: '0.9rem' }}>
                  {platform}
                  <span style={{ color: '#64748b', fontWeight: 400, marginLeft: 8 }}>
                    ({platformNodes.filter((n) => n.verified).length}/{platformNodes.length} verified)
                  </span>
                </div>
                {platformNodes
                  .sort((a, b) => a.depth - b.depth)
                  .map((node) => (
                    <div
                      key={node.id}
                      style={{
                        marginLeft: node.depth * 16,
                        padding: '10px 12px',
                        marginBottom: 6,
                        borderRadius: 8,
                        background: 'rgba(0,212,255,0.04)',
                        border: '1px solid rgba(0,212,255,0.12)',
                        display: 'flex',
                        flexWrap: 'wrap',
                        alignItems: 'center',
                        gap: 10,
                        justifyContent: 'space-between',
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>
                          {node.displayName || node.externalId}
                          <span style={{ color: '#64748b', marginLeft: 8, fontSize: '0.75rem' }}>{node.nodeType}</span>
                        </div>
                        <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: 2 }}>
                          ID: {node.externalId}
                          {node.memberCount != null && ` · ${node.memberCount} members`}
                          {node.privacyState && ` · ${node.privacyState}`}
                        </div>
                        {node.lastError && (
                          <div style={{ fontSize: '0.72rem', color: '#f87171', marginTop: 4 }}>{node.lastError}</div>
                        )}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Badge state={node.verificationState} successAt={node.lastTestSuccessAt} />
                        {node.verified && (
                          <label style={{ fontSize: '0.75rem', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: 4 }}>
                            <input
                              type="checkbox"
                              checked={!!selectedNodes[node.id]}
                              onChange={(e) => setSelectedNodes((p) => ({ ...p, [node.id]: e.target.checked }))}
                            />
                            Bind
                          </label>
                        )}
                        <button type="button" className="btn" style={{ padding: '4px 10px', fontSize: '0.75rem' }} onClick={() => reverifyNode(node.id)} disabled={loading}>
                          Test
                        </button>
                      </div>
                    </div>
                  ))}
              </div>
            ))
          )}
        </div>

        <div className="card">
          <h3 style={{ marginTop: 0 }}>Campaign Kill-Switch</h3>
          <p style={{ fontSize: '0.85rem', color: '#94a3b8', marginTop: 0 }}>
            Only nodes with a green verified badge can be bound to campaigns.
          </p>

          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Active campaign</label>
            <select
              className="input"
              value={selectedCampaign}
              onChange={(e) => setSelectedCampaign(e.target.value)}
              style={{ width: '100%', marginTop: 4 }}
            >
              <option value="">— Select —</option>
              {campaigns.map((c) => (
                <option key={c.id} value={c.id}>{c.name} ({c.status})</option>
              ))}
            </select>
          </div>

          {activeCampaign && (
            <div style={{ marginBottom: 12, padding: 10, borderRadius: 8, background: 'rgba(0,0,0,0.2)', fontSize: '0.8rem' }}>
              <div>Status: <strong style={{ color: activeCampaign.status === 'running' ? '#22c55e' : '#f59e0b' }}>{activeCampaign.status}</strong></div>
              <div style={{ marginTop: 4, color: '#64748b' }}>Target: {activeCampaign.targetUrl}</div>
              {activeCampaign.frequencyCron && <div style={{ marginTop: 4 }}>Cron: {activeCampaign.frequencyCron}</div>}
              {activeCampaign.burstIntervalM && <div style={{ marginTop: 4 }}>Burst: every {activeCampaign.burstIntervalM} min</div>}
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
            <button type="button" className="btn primary" onClick={() => campaignAction('running')} disabled={!selectedCampaign || loading}>
              Keep Running
            </button>
            <button type="button" className="btn" onClick={() => campaignAction('pause')} disabled={!selectedCampaign || loading}>
              Pause Campaign
            </button>
            <button type="button" className="btn" onClick={bindSelected} disabled={!selectedCampaign || loading}>
              Bind Selected Nodes
            </button>
            <button type="button" className="btn" style={{ color: '#f87171' }} onClick={() => campaignAction('delete')} disabled={!selectedCampaign || loading}>
              Delete Campaign
            </button>
          </div>

          <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: 12 }}>
            <label style={{ fontSize: '0.8rem', color: '#94a3b8' }}>New campaign</label>
            <input
              className="input"
              placeholder="Campaign name"
              value={newCampaignName}
              onChange={(e) => setNewCampaignName(e.target.value)}
              style={{ width: '100%', marginTop: 4, marginBottom: 8 }}
            />
            <button type="button" className="btn" onClick={createCampaign} disabled={loading || !newCampaignName.trim()} style={{ width: '100%' }}>
              Create Campaign
            </button>
          </div>

          <p style={{ fontSize: '0.75rem', color: '#64748b', marginTop: 12, marginBottom: 0 }}>
            {verifiedNodes.length} verified node{verifiedNodes.length !== 1 ? 's' : ''} available for binding.
          </p>
        </div>
      </div>
    </div>
  );
}