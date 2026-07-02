'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { invoke } from '@/lib/api';

type FlowNode = {
  id: string;
  type: string;
  title?: string;
  label?: string;
  x: number;
  y: number;
  config?: Record<string, unknown>;
};

type FlowEdge = { source: string; target: string; type?: string };

type FlowBinding = {
  campaignId?: string;
  accountIds?: string[];
  useBackgroundSchedule?: boolean;
  label?: string;
};

type Flow = {
  status?: string;
  nodes?: FlowNode[];
  edges?: FlowEdge[];
  binding?: FlowBinding;
};

type BuilderAccount = { id: string; platform: string; handle?: string };

function normalizeFlowEdges(edges: FlowEdge[] = []): FlowEdge[] {
  return edges
    .map((e) => {
      const source = e.source || (e as FlowEdge & { from?: string }).from;
      const target = e.target || (e as FlowEdge & { to?: string }).to;
      return source && target ? { ...e, source, target } : null;
    })
    .filter(Boolean) as FlowEdge[];
}

const PALETTE = [
  { category: 'Triggers', items: [
    { type: 'trigger', title: 'Keyword Match', icon: '🔍' },
    { type: 'trigger', title: 'New Follower', icon: '👤' },
    { type: 'trigger', title: 'Scheduled Time', icon: '📅' },
  ]},
  { category: 'Integrations', items: [
    { type: 'integration', title: 'RSS Feed Monitor', icon: '📡' },
    { type: 'integration', title: 'Incoming Webhook', icon: '🔗' },
  ]},
  { category: 'Logic', items: [
    { type: 'condition', title: 'AI Sentiment Split', icon: '🧠' },
    { type: 'condition', title: 'IF / ELSE Match', icon: '⑂' },
    { type: 'delay', title: 'Wait (Jitter)', icon: '⏱' },
  ]},
  { category: 'Actions', items: [
    { type: 'action', title: 'Auto-Like Post', icon: '♥' },
    { type: 'action', title: 'AI Draft Reply', icon: '🤖' },
    { type: 'action', title: 'Publish Content', icon: '📤' },
    { type: 'action', title: 'Send Alert', icon: '🔔' },
  ]},
];

let nodeCounter = 1;

export function AutomationCanvas() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [flow, setFlow] = useState<Flow>({ status: 'draft', nodes: [], edges: [] });
  const [templates, setTemplates] = useState<Array<{ id: string; name: string }>>([]);
  const [builderData, setBuilderData] = useState<Record<string, unknown>>({});
  const [deployStatus, setDeployStatus] = useState<Record<string, unknown>>({});
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [connectFrom, setConnectFrom] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [msg, setMsg] = useState('');
  const [saveModal, setSaveModal] = useState(false);
  const [loadModal, setLoadModal] = useState(false);
  const [templateName, setTemplateName] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState('');
  const [deployModal, setDeployModal] = useState(false);
  const [deployAccounts, setDeployAccounts] = useState<string[]>([]);
  const [useBackgroundSchedule, setUseBackgroundSchedule] = useState(true);

  const nodes = flow.nodes || [];
  const edges = flow.edges || [];
  const selected = nodes.find((n) => n.id === selectedId);

  const refresh = useCallback(async () => {
    const [f, t, b, s] = await Promise.all([
      invoke<Flow>('get-automation-flow'),
      invoke<Array<{ id: string; name: string }>>('get-automation-templates'),
      invoke<Record<string, unknown>>('get-automation-builder-data'),
      invoke<Record<string, unknown>>('get-automation-status'),
    ]);
    setFlow({ ...f, edges: normalizeFlowEdges(f.edges) });
    setDeployAccounts((f.binding?.accountIds as string[]) || []);
    setUseBackgroundSchedule(f.binding?.useBackgroundSchedule !== false);
    setTemplates(t || []);
    setBuilderData(b || {});
    setDeployStatus(s || {});
    const maxId = (f.nodes || []).reduce((m, n) => {
      const num = parseInt(n.id.replace(/\D/g, ''), 10);
      return num > m ? num : m;
    }, 0);
    nodeCounter = maxId + 1;
  }, []);

  useEffect(() => { refresh().catch(console.error); }, [refresh]);

  async function persist(next: Flow) {
    const normalized = { ...next, edges: normalizeFlowEdges(next.edges) };
    const res = await invoke<{ flow?: Flow }>('save-automation-flow', normalized);
    setFlow(res.flow ? { ...res.flow, edges: normalizeFlowEdges(res.flow.edges) } : normalized);
  }

  function addNode(type: string, title: string, x: number, y: number) {
    const node: FlowNode = {
      id: `node_${nodeCounter++}`,
      type,
      title,
      label: title,
      x,
      y,
      config: {},
    };
    const next = { ...flow, nodes: [...nodes, node] };
    setFlow(next);
    persist(next);
    setSelectedId(node.id);
  }

  function updateNode(id: string, patch: Partial<FlowNode>) {
    const next = { ...flow, nodes: nodes.map((n) => (n.id === id ? { ...n, ...patch } : n)) };
    setFlow(next);
    persist(next);
  }

  function removeNode(id: string) {
    const next = {
      ...flow,
      nodes: nodes.filter((n) => n.id !== id),
      edges: edges.filter((e) => e.source !== id && e.target !== id),
    };
    setFlow(next);
    persist(next);
    if (selectedId === id) setSelectedId(null);
  }

  function addEdge(source: string, target: string) {
    if (source === target) return;
    if (edges.some((e) => e.source === source && e.target === target)) return;
    const next = { ...flow, edges: [...edges, { source, target }] };
    setFlow(next);
    persist(next);
  }

  function onPaletteDragStart(e: React.DragEvent, type: string, title: string) {
    e.dataTransfer.setData('application/json', JSON.stringify({ type, title }));
  }

  function onCanvasDrop(e: React.DragEvent) {
    e.preventDefault();
    const raw = e.dataTransfer.getData('application/json');
    if (!raw || !containerRef.current) return;
    const { type, title } = JSON.parse(raw) as { type: string; title: string };
    const rect = containerRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left + containerRef.current.scrollLeft) / zoom - 100;
    const y = (e.clientY - rect.top + containerRef.current.scrollTop) / zoom - 30;
    addNode(type, title, Math.max(0, x), Math.max(0, y));
  }

  function onNodeMouseDown(e: React.MouseEvent, id: string) {
    if ((e.target as HTMLElement).closest('.flow-port')) return;
    e.preventDefault();
    setDraggingId(id);
    setSelectedId(id);
    const node = nodes.find((n) => n.id === id);
    if (!node || !containerRef.current) return;
    const startX = e.clientX;
    const startY = e.clientY;
    const origX = node.x;
    const origY = node.y;

    function move(ev: MouseEvent) {
      const dx = (ev.clientX - startX) / zoom;
      const dy = (ev.clientY - startY) / zoom;
      setFlow((prev) => ({
        ...prev,
        nodes: (prev.nodes || []).map((n) =>
          n.id === id ? { ...n, x: origX + dx, y: origY + dy } : n,
        ),
      }));
    }
    function up() {
      setDraggingId(null);
      setFlow((prev) => { persist(prev); return prev; });
      window.removeEventListener('mousemove', move);
      window.removeEventListener('mouseup', up);
    }
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
  }

  function pathBetween(a: FlowNode, b: FlowNode): string {
    const x1 = a.x + 110;
    const y1 = a.y + 70;
    const x2 = b.x + 110;
    const y2 = b.y;
    const mid = (y1 + y2) / 2;
    return `M ${x1} ${y1} C ${x1} ${mid}, ${x2} ${mid}, ${x2} ${y2}`;
  }

  function openDeployModal() {
    const accounts = (builderData.accounts as BuilderAccount[]) || [];
    if (!deployAccounts.length && accounts.length) {
      setDeployAccounts(accounts.map((a) => a.id));
    }
    setDeployModal(true);
  }

  async function deploy() {
    if (!deployAccounts.length) {
      setMsg('Select at least one account to run this automation');
      return;
    }
    setMsg('Deploying…');
    const payload = {
      ...flow,
      edges: normalizeFlowEdges(flow.edges),
      binding: {
        campaignId: String(builderData.campaignId || ''),
        accountIds: deployAccounts,
        useBackgroundSchedule,
        label: String(builderData.campaignName || 'Campaign flow'),
      },
    };
    const res = await invoke<{ success?: boolean; error?: string }>('deploy-automation-flow', payload);
    if (res.success) {
      setMsg(`Deployed to ${deployAccounts.length} account(s) — worker will run on your schedule`);
      setDeployModal(false);
    } else {
      setMsg(res.error || 'Deploy failed');
    }
    refresh();
  }

  async function loadTemplate(id: string) {
    const res = await invoke<{ success?: boolean; nodes?: FlowNode[]; edges?: FlowEdge[]; error?: string }>('load-automation-template', id);
    if (!res.success) { setMsg(res.error || 'Template not found'); return; }
    const next = { ...flow, nodes: res.nodes || [], edges: normalizeFlowEdges(res.edges) };
    setFlow(next);
    await persist(next);
    setLoadModal(false);
    setMsg('Template loaded');
  }

  async function saveCustomTemplate() {
    if (!templateName.trim()) return;
    await invoke('save-automation-template', {
      name: templateName.trim(),
      nodes,
      edges,
    });
    setSaveModal(false);
    setTemplateName('');
    setMsg('Template saved');
    refresh();
  }

  const apiStatus = (builderData.apiStatus || {}) as Record<string, boolean>;
  const builderAccounts = (builderData.accounts || []) as BuilderAccount[];
  const deployInfo = deployStatus as {
    status?: string;
    nodeCount?: number;
    edgeCount?: number;
    workerRunning?: boolean;
    campaignName?: string;
    boundAccounts?: string[];
    useBackgroundSchedule?: boolean;
    lastRunAt?: string;
  };

  function toggleDeployAccount(id: string) {
    setDeployAccounts((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  return (
    <div className="automation-canvas-layout">
      <aside className="automation-palette">
        <h4>Node Palette</h4>
        {PALETTE.map((cat) => (
          <div key={cat.category}>
            <div className="palette-category">{cat.category}</div>
            {cat.items.map((item) => (
              <div
                key={item.title}
                className={`palette-item ${item.type}`}
                draggable
                onDragStart={(e) => onPaletteDragStart(e, item.type, item.title)}
              >
                <span>{item.icon}</span> {item.title}
              </div>
            ))}
          </div>
        ))}
      </aside>

      <div className="automation-main">
        <div className="automation-topbar">
          <div>
            <strong>{String(builderData.campaignName || 'Campaign Pipeline')}</strong>
            <span style={{ marginLeft: 8, fontSize: '0.8rem', color: flow.status === 'active' ? '#10b981' : '#64748b' }}>
              / {flow.status || 'draft'}
            </span>
            <div className="api-status-inline">
              {[
                { key: 'reddit', label: 'Reddit' },
                { key: 'twitter', label: 'X' },
                { key: 'linkedin', label: 'LinkedIn' },
                { key: 'serp', label: 'SerpAPI' },
                { key: 'gemini', label: 'Gemini' },
              ].map(({ key, label }) => (
                <span key={key} className={`api-status-chip ${apiStatus[key] ? 'on' : 'off'}`}>
                  {label}
                </span>
              ))}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button type="button" className="btn" onClick={() => setLoadModal(true)}>Load Template</button>
            <button type="button" className="btn" onClick={() => setSaveModal(true)}>Save Template</button>
            <button type="button" className="btn" onClick={async () => {
              const res = await invoke<Record<string, unknown>>('test-automation-flow', flow);
              setMsg(JSON.stringify(res).slice(0, 200));
            }}>Test Run</button>
            <button type="button" className="btn" onClick={async () => { await invoke('undeploy-automation-flow'); refresh(); }}>Pause</button>
            <button type="button" className="btn" onClick={() => {
              const next = { status: 'draft', nodes: [], edges: [] };
              setFlow(next);
              persist(next);
            }}>Clear</button>
            <button type="button" className="btn primary" onClick={openDeployModal}>Deploy Flow</button>
          </div>
        </div>

        <div
          ref={containerRef}
          className="automation-canvas-container"
          onDragOver={(e) => e.preventDefault()}
          onDrop={onCanvasDrop}
        >
          <div className="automation-canvas" style={{ transform: `scale(${zoom})` }}>
            <svg className="automation-svg">
              {edges.map((e, i) => {
                const a = nodes.find((n) => n.id === e.source);
                const b = nodes.find((n) => n.id === e.target);
                if (!a || !b) return null;
                return <path key={i} d={pathBetween(a, b)} className="flow-connection" />;
              })}
            </svg>
            {nodes.map((n) => (
              <div
                key={n.id}
                className={`flow-node ${n.type} ${selectedId === n.id ? 'active' : ''} ${draggingId === n.id ? 'dragging' : ''}`}
                style={{ left: n.x, top: n.y }}
                onMouseDown={(e) => onNodeMouseDown(e, n.id)}
              >
                <div className="flow-node-header">
                  <span>{n.title || n.label}</span>
                </div>
                <div className="flow-node-body">{n.type}</div>
                <button
                  type="button"
                  className="flow-port out"
                  title="Connect"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (connectFrom && connectFrom !== n.id) {
                      addEdge(connectFrom, n.id);
                      setConnectFrom(null);
                    } else {
                      setConnectFrom(n.id);
                      setMsg(`Connecting from ${n.title} — click target node`);
                    }
                  }}
                />
                <button
                  type="button"
                  className="flow-port in"
                  title="Connect to"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (connectFrom && connectFrom !== n.id) {
                      addEdge(connectFrom, n.id);
                      setConnectFrom(null);
                    }
                  }}
                />
              </div>
            ))}
          </div>
        </div>

        <div className="automation-zoom">
          <button type="button" className="btn" onClick={() => setZoom((z) => Math.min(1.5, z + 0.1))}>+</button>
          <button type="button" className="btn" onClick={() => setZoom(1)}>◎</button>
          <button type="button" className="btn" onClick={() => setZoom((z) => Math.max(0.5, z - 0.1))}>−</button>
        </div>

        {selected && (
          <aside className="automation-props open">
            <div className="automation-props-header">
              <h4>{selected.title}</h4>
              <button type="button" className="btn" onClick={() => setSelectedId(null)}>×</button>
            </div>
            <div className="automation-props-body">
              <label className="ac-label">Node label</label>
              <input
                className="input"
                value={selected.title || ''}
                onChange={(e) => updateNode(selected.id, { title: e.target.value, label: e.target.value })}
              />
              <label className="ac-label">Keyword (triggers)</label>
              <input
                className="input"
                placeholder="e.g. brand mentions"
                value={String(selected.config?.keyword || '')}
                onChange={(e) => updateNode(selected.id, { config: { ...selected.config, keyword: e.target.value } })}
              />
              <label className="ac-label">Custom prompt (AI actions)</label>
              <textarea
                className="input"
                rows={3}
                value={String(selected.config?.prompt || '')}
                onChange={(e) => updateNode(selected.id, { config: { ...selected.config, prompt: e.target.value } })}
              />
              {selected.type === 'action' && builderAccounts.length > 0 && (
                <>
                  <label className="ac-label">Run as account</label>
                  <select
                    className="input"
                    value={String(selected.config?.account || 'Auto')}
                    onChange={(e) => updateNode(selected.id, { config: { ...selected.config, account: e.target.value } })}
                  >
                    <option value="Auto">Auto (from deploy binding)</option>
                    {builderAccounts.map((a) => (
                      <option key={a.id} value={a.id}>{a.platform} — {a.handle || a.id}</option>
                    ))}
                  </select>
                </>
              )}
              {selected.type === 'trigger' && (
                <>
                  <label className="ac-label">Platform filter</label>
                  <select
                    className="input"
                    value={String(selected.config?.platform || 'Any')}
                    onChange={(e) => updateNode(selected.id, { config: { ...selected.config, platform: e.target.value } })}
                  >
                    {['Any', 'Twitter', 'LinkedIn', 'Reddit', 'Facebook', 'Instagram'].map((p) => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </select>
                </>
              )}
              <button type="button" className="btn" style={{ marginTop: 12, color: '#ef4444' }} onClick={() => removeNode(selected.id)}>
                Delete Node
              </button>
            </div>
          </aside>
        )}
      </div>

      <div className="grid grid-2" style={{ marginTop: 12 }}>
        <div className="card">
          <h4>Templates</h4>
          {templates.map((t) => (
            <button key={t.id} type="button" className="btn" style={{ marginRight: 8, marginBottom: 8 }} onClick={() => loadTemplate(t.id)}>
              {t.name}
            </button>
          ))}
          {!templates.length && <p className="settings-panel-desc">Built-in templates load on first deploy.</p>}
        </div>
        <div className="card">
          <h4>Deploy Status</h4>
          <div style={{ fontSize: '0.82rem', lineHeight: 1.6 }}>
            <div><strong>Status:</strong> {deployInfo.status || 'draft'}</div>
            <div><strong>Nodes:</strong> {deployInfo.nodeCount ?? nodes.length} · <strong>Connections:</strong> {deployInfo.edgeCount ?? edges.length}</div>
            <div><strong>Campaign:</strong> {deployInfo.campaignName || String(builderData.campaignName || '—')}</div>
            <div><strong>Worker:</strong> {deployInfo.workerRunning ? 'Running' : 'Idle'}</div>
            {deployInfo.boundAccounts?.length ? (
              <div><strong>Bound accounts:</strong> {deployInfo.boundAccounts.join(', ')}</div>
            ) : (
              <div className="settings-panel-desc" style={{ marginTop: 4 }}>Deploy to attach accounts and schedule.</div>
            )}
            {deployInfo.useBackgroundSchedule && (
              <div className="settings-panel-desc">Uses Background Run windows from <Link href="/rules">Auto-Rules</Link>.</div>
            )}
            {deployInfo.lastRunAt && <div><strong>Last run:</strong> {new Date(deployInfo.lastRunAt).toLocaleString()}</div>}
          </div>
        </div>
      </div>

      {msg && <p style={{ marginTop: 8, color: '#94a3b8', fontSize: '0.85rem' }}>{msg}</p>}

      {loadModal && (
        <div className="modal-overlay" onClick={() => setLoadModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3>Load Template</h3>
            <select className="input" value={selectedTemplate} onChange={(e) => setSelectedTemplate(e.target.value)}>
              <option value="">Select…</option>
              {templates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
            <div className="modal-actions">
              <button type="button" className="btn" onClick={() => setLoadModal(false)}>Cancel</button>
              <button type="button" className="btn primary" onClick={() => selectedTemplate && loadTemplate(selectedTemplate)}>Load</button>
            </div>
          </div>
        </div>
      )}

      {deployModal && (
        <div className="modal-overlay" onClick={() => setDeployModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 480 }}>
            <h3>Deploy automation</h3>
            <p className="settings-panel-desc">
              Choose which campaign accounts run this flow. Likes, replies, and publishes respect your
              {' '}<Link href="/rules">Auto-Rules</Link> schedule and human delay settings.
            </p>
            <p style={{ fontSize: '0.85rem', margin: '8px 0' }}>
              <strong>Campaign:</strong> {String(builderData.campaignName || 'Active campaign')}
            </p>
            <label className="ac-label">Accounts &amp; pages</label>
            {!builderAccounts.length && (
              <p className="settings-panel-desc">No accounts linked — <Link href="/account-hub">connect in Account Hub</Link> first.</p>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 200, overflowY: 'auto', marginBottom: 12 }}>
              {builderAccounts.map((a) => (
                <label key={a.id} className="ac-check" style={{ fontSize: '0.85rem' }}>
                  <input
                    type="checkbox"
                    checked={deployAccounts.includes(a.id)}
                    onChange={() => toggleDeployAccount(a.id)}
                  />
                  {a.platform} — {a.handle || a.id}
                </label>
              ))}
            </div>
            <label className="ac-check" style={{ marginBottom: 12 }}>
              <input
                type="checkbox"
                checked={useBackgroundSchedule}
                onChange={(e) => setUseBackgroundSchedule(e.target.checked)}
              />
              Respect Background Run schedule (pause outside windows)
            </label>
            <p className="settings-panel-desc">
              For group/page targets per account, configure targets in{' '}
              <Link href="/rules">Auto-Rules → Per-Account Matrix</Link>.
            </p>
            <div className="modal-actions">
              <button type="button" className="btn" onClick={() => setDeployModal(false)}>Cancel</button>
              <button type="button" className="btn primary" onClick={deploy} disabled={!deployAccounts.length}>
                Deploy &amp; enable
              </button>
            </div>
          </div>
        </div>
      )}

      {saveModal && (
        <div className="modal-overlay" onClick={() => setSaveModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3>Save Custom Template</h3>
            <input className="input" placeholder="Template name" value={templateName} onChange={(e) => setTemplateName(e.target.value)} />
            <div className="modal-actions">
              <button type="button" className="btn" onClick={() => setSaveModal(false)}>Cancel</button>
              <button type="button" className="btn primary" onClick={saveCustomTemplate}>Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}