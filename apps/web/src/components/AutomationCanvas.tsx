'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
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

type Flow = {
  status?: string;
  nodes?: FlowNode[];
  edges?: FlowEdge[];
};

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
    setFlow(f);
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
    const res = await invoke<{ flow?: Flow }>('save-automation-flow', next);
    setFlow(res.flow || next);
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

  async function deploy() {
    setMsg('Deploying…');
    const res = await invoke<{ success?: boolean; error?: string }>('deploy-automation-flow', flow);
    setMsg(res.success ? 'Flow deployed & active' : (res.error || 'Deploy failed'));
    refresh();
  }

  async function loadTemplate(id: string) {
    const res = await invoke<{ success?: boolean; nodes?: FlowNode[]; edges?: FlowEdge[]; error?: string }>('load-automation-template', id);
    if (!res.success) { setMsg(res.error || 'Template not found'); return; }
    const next = { ...flow, nodes: res.nodes || [], edges: res.edges || [] };
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
            <strong>Campaign Pipeline</strong>
            <span style={{ marginLeft: 8, fontSize: '0.8rem', color: flow.status === 'active' ? '#10b981' : '#64748b' }}>
              / {flow.status || 'draft'}
            </span>
            <div className="api-status-inline" style={{ marginTop: 4 }}>
              {['reddit', 'twitter', 'linkedin', 'serp', 'gemini'].map((k) => (
                <span key={k} className={apiStatus[k] ? 'status-ok' : 'status-partial'} style={{ fontSize: '0.7rem', marginRight: 8 }}>
                  {k}
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
            <button type="button" className="btn primary" onClick={deploy}>Deploy Flow</button>
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
          <pre style={{ fontSize: '0.75rem', overflow: 'auto', maxHeight: 120 }}>{JSON.stringify(deployStatus, null, 2)}</pre>
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