'use client';
import { useEffect, useState } from 'react';
import { invoke } from '@/lib/api';
import { PageHeader } from '@/components/PageHeader';

type FlowNode = { id: string; type: string; label?: string; data?: Record<string, unknown> };
type Flow = { status?: string; nodes?: FlowNode[]; edges?: Array<{ source: string; target: string }> };

export default function AutomationsPage() {
  const [flow, setFlow] = useState<Flow>({ nodes: [], edges: [], status: 'draft' });
  const [templates, setTemplates] = useState<Array<{ id: string; name: string }>>([]);
  const [builderData, setBuilderData] = useState<Record<string, unknown>>({});
  const [deployStatus, setDeployStatus] = useState<Record<string, unknown>>({});
  const [msg, setMsg] = useState('');
  const [newNodeType, setNewNodeType] = useState('trigger-keyword');

  async function refresh() {
    const [f, t, b, s] = await Promise.all([
      invoke<Flow>('get-automation-flow'),
      invoke<Array<{ id: string; name: string }>>('get-automation-templates'),
      invoke<Record<string, unknown>>('get-automation-builder-data'),
      invoke<Record<string, unknown>>('get-automation-status'),
    ]);
    setFlow(f);
    setTemplates(t);
    setBuilderData(b);
    setDeployStatus(s);
  }

  useEffect(() => { refresh().catch(console.error); }, []);

  async function saveFlow(next: Flow) {
    const res = await invoke<{ flow?: Flow }>('save-automation-flow', next);
    setFlow(res.flow || next);
    setMsg('Flow saved');
  }

  function addNode() {
    const node: FlowNode = {
      id: `node_${Date.now()}`,
      type: newNodeType,
      label: newNodeType.replace(/-/g, ' '),
    };
    const next = { ...flow, nodes: [...(flow.nodes || []), node] };
    saveFlow(next);
  }

  function removeNode(id: string) {
    const next = { ...flow, nodes: (flow.nodes || []).filter((n) => n.id !== id) };
    saveFlow(next);
  }

  async function loadTemplate(id: string) {
    const res = await invoke<{ success?: boolean; nodes?: FlowNode[]; edges?: Flow['edges']; error?: string }>('load-automation-template', id);
    if (!res.success) { setMsg(res.error || 'Template not found'); return; }
    saveFlow({ ...flow, nodes: res.nodes || [], edges: res.edges || [] });
  }

  async function deploy() {
    setMsg('Deploying…');
    const res = await invoke<{ success?: boolean; error?: string }>('deploy-automation-flow', flow);
    setMsg(res.success ? 'Flow deployed & active' : (res.error || 'Deploy failed'));
    refresh();
  }

  async function testFlow() {
    setMsg('Testing flow…');
    const res = await invoke<Record<string, unknown>>('test-automation-flow', flow);
    setMsg(JSON.stringify(res).slice(0, 200));
  }

  return (
    <div>
      <PageHeader title="Visual Automation Builder" subtitle="Triggers, actions, webhooks — deploy and test flows" />

      <div className="grid grid-2">
        <div className="card">
          <h3>Flow Canvas — {flow.status} ({(flow.nodes || []).length} nodes)</h3>
          {(flow.nodes || []).map((n) => (
            <div key={n.id} className="post-card" style={{ display: 'flex', justifyContent: 'space-between' }}>
              <div><span className="badge">{n.type}</span> {n.label || n.id}</div>
              <button className="btn" onClick={() => removeNode(n.id)}>Remove</button>
            </div>
          ))}
          <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
            <select className="input" style={{ width: 'auto' }} value={newNodeType} onChange={(e) => setNewNodeType(e.target.value)}>
              <option value="trigger-keyword">Trigger: Keyword Match</option>
              <option value="trigger-schedule">Trigger: Schedule</option>
              <option value="trigger-webhook">Trigger: Webhook</option>
              <option value="action-reply">Action: AI Reply</option>
              <option value="action-like">Action: Like</option>
              <option value="action-publish">Action: Publish Post</option>
            </select>
            <button className="btn" onClick={addNode}>Add Node</button>
            <button className="btn primary" onClick={() => saveFlow(flow)}>Save</button>
            <button className="btn primary" onClick={deploy}>Deploy</button>
            <button className="btn" onClick={testFlow}>Test</button>
            <button className="btn" onClick={async () => { await invoke('undeploy-automation-flow'); refresh(); }}>Undeploy</button>
          </div>
          {msg && <p style={{ marginTop: 8, color: '#94a3b8' }}>{msg}</p>}
        </div>

        <div>
          <div className="card">
            <h3>Templates</h3>
            {templates.map((t) => (
              <button key={t.id} className="btn" style={{ marginRight: 8, marginBottom: 8 }} onClick={() => loadTemplate(t.id)}>{t.name}</button>
            ))}
            {!templates.length && <p style={{ color: '#94a3b8' }}>Built-in templates load on first deploy.</p>}
          </div>
          <div className="card">
            <h3>Builder Data</h3>
            <pre style={{ fontSize: '0.75rem', overflow: 'auto', maxHeight: 200 }}>{JSON.stringify(builderData, null, 2)}</pre>
          </div>
          <div className="card">
            <h3>Deploy Status</h3>
            <pre style={{ fontSize: '0.75rem' }}>{JSON.stringify(deployStatus, null, 2)}</pre>
          </div>
        </div>
      </div>
    </div>
  );
}