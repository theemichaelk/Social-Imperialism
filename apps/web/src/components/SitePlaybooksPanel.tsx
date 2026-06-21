'use client';

import { useCallback, useEffect, useState } from 'react';
import { invoke } from '@/lib/api';
import { DataPanel, LivePulse } from '@/components/DashboardViz';
import { SITE_PLAYBOOKS, personalizeStep } from '@/lib/sitePlaybooks';

type Config = {
  keywords?: string;
  description?: string;
  expandedPlaybooks?: Record<string, boolean>;
};

export function SitePlaybooksPanel() {
  const [config, setConfig] = useState<Config>({ keywords: '', description: '', expandedPlaybooks: {} });
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  const load = useCallback(async () => {
    const data = await invoke<Config>('get-site-playbook-config');
    setConfig(data || {});
    setExpanded(data?.expandedPlaybooks || {});
  }, []);

  useEffect(() => { load().catch(console.error); }, [load]);

  async function save() {
    setSaving(true);
    setMsg('');
    try {
      await invoke('save-site-playbook-config', { ...config, expandedPlaybooks: expanded });
      setMsg('Playbook context saved — steps now use your keywords & description');
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  function toggle(id: string) {
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  const filled = !!(config.keywords?.trim() && config.description?.trim());

  return (
    <div className="settings-playbooks">
      <DataPanel title="Strategy Context" live className="playbook-context-panel">
        <p className="settings-panel-desc">
          Enter keywords and a brand description — every playbook step below adapts to your inputs in real time.
        </p>
        <div className="grid grid-2">
          <div className="form-group">
            <label>Target Keywords</label>
            <input
              className="input"
              placeholder="e.g. social media automation, AI marketing, B2B SaaS"
              value={config.keywords || ''}
              onChange={(e) => setConfig({ ...config, keywords: e.target.value })}
            />
          </div>
          <div className="form-group">
            <label>Brand / Site Description</label>
            <textarea
              className="input"
              rows={3}
              placeholder="Describe your site type, audience, and value proposition..."
              value={config.description || ''}
              onChange={(e) => setConfig({ ...config, description: e.target.value })}
            />
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginTop: 8 }}>
          <button className="btn primary" onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save Context'}</button>
          <LivePulse label={filled ? 'CONTEXT LIVE' : 'NEEDS INPUT'} />
          {msg && <span className="settings-inline-msg">{msg}</span>}
        </div>
      </DataPanel>

      <div className="playbook-accordion">
        {SITE_PLAYBOOKS.map((pb) => {
          const isOpen = !!expanded[pb.id];
          const doneSteps = pb.steps.filter((s) => config.keywords?.trim()).length;
          return (
            <div key={pb.id} className={`playbook-card ${isOpen ? 'open' : ''}`} style={{ borderColor: isOpen ? pb.color : undefined }}>
              <button type="button" className="playbook-card-head" onClick={() => toggle(pb.id)}>
                <span className="playbook-icon">{pb.icon}</span>
                <div className="playbook-head-text">
                  <strong>{pb.title}</strong>
                  <span>{pb.summary}</span>
                </div>
                <span className="playbook-meta">{doneSteps}/{pb.steps.length} steps</span>
                <span className="playbook-chevron">{isOpen ? '▾' : '▸'}</span>
              </button>
              {isOpen && (
                <div className="playbook-steps">
                  {pb.steps.map((step) => (
                    <div key={step.n} className="playbook-step">
                      <div className="playbook-step-num" style={{ background: `${pb.color}22`, color: pb.color }}>{step.n}</div>
                      <div className="playbook-step-body">
                        <strong>{step.title}</strong>
                        <p>{personalizeStep(step.action, config.keywords || '', config.description || '')}</p>
                        {step.channel && <span className="badge">{step.channel}</span>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}