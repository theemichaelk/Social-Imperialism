'use client';

import { useCallback, useState } from 'react';
import { invoke } from '@/lib/api';
import { INTEGRATION_GROUPS, METRIC_PROBE_MAP, type IntegrationGroup } from '@/lib/integrationCatalog';
import { summarizeProbe, validateProbe } from '@/lib/integrationProbes';

type Props = {
  keys: Record<string, string>;
  apiStatus: Record<string, string>;
  keySources?: Record<string, string>;
  onChange: (key: string, value: string) => void;
  onMetricStatus?: (metric: string, status: string) => void;
  groupFilter?: string;
};

function fieldStatus(field: { key: string; metric?: string }, apiStatus: Record<string, string>, keys: Record<string, string>) {
  if (field.metric && apiStatus[field.metric]) return apiStatus[field.metric];
  if (keys[field.key]?.trim()) return 'Configured';
  return 'Empty';
}

function emailProviderOk(metric: string, data: Record<string, unknown>): boolean | null {
  const e = data as {
    vbout?: { ok?: boolean };
    mailchimp?: { ok?: boolean };
    ses?: { ok?: boolean };
    acumbamail?: { ok?: boolean };
  };
  if (metric === 'VBout') return !!e.vbout?.ok;
  if (metric === 'MailChimp') return !!e.mailchimp?.ok;
  if (metric === 'Amazon SES') return !!e.ses?.ok;
  if (metric === 'Acumbamail') return !!e.acumbamail?.ok;
  return null;
}

export function IntegrationKeyForm({ keys, apiStatus, keySources, onChange, onMetricStatus, groupFilter }: Props) {
  const groups = groupFilter
    ? INTEGRATION_GROUPS.filter((g) => g.id === groupFilter)
    : INTEGRATION_GROUPS;

  const [fieldTests, setFieldTests] = useState<Record<string, { status: string; summary?: string }>>({});
  const [testingKey, setTestingKey] = useState<string | null>(null);

  const runFieldTest = useCallback(async (fieldKey: string, metric?: string) => {
    if (!metric || !METRIC_PROBE_MAP[metric]) return;
    const probe = METRIC_PROBE_MAP[metric];
    setTestingKey(fieldKey);
    setFieldTests((prev) => ({ ...prev, [fieldKey]: { status: 'running' } }));
    try {
      const data = await invoke<Record<string, unknown>>(probe.channel, ...(probe.args || []));
      let status = 'warn';
      let summary = summarizeProbe(data);

      if (probe.channel === 'check-api-status') {
        const live = (data as Record<string, string>)[metric];
        status = live === 'Connected' ? 'pass' : live ? 'warn' : 'fail';
        summary = live || 'Not configured';
        onMetricStatus?.(metric, live || 'Not configured');
      } else if (probe.channel === 'test-email-connections') {
        const ok = emailProviderOk(metric, data);
        status = ok ? 'pass' : ok === false ? 'warn' : 'fail';
        const err = (data as { acumbamail?: { error?: string }; ses?: { error?: string } });
        if (metric === 'Acumbamail' && !ok) summary = err.acumbamail?.error || 'Auth failed — enable SMTP relay';
        else if (metric === 'Amazon SES' && !ok) summary = err.ses?.error || 'SES not connected';
        onMetricStatus?.(metric, ok ? 'Connected' : status === 'warn' ? 'Auth failed' : 'Not configured');
      } else {
        const probeId = metric === 'NewsAPI' ? 'news'
          : metric === 'Unsplash' || metric === 'Stock Media' ? 'stock'
          : metric === 'SerpAPI' ? 'serp'
          : metric === 'DomDetailer' ? 'domain'
          : metric === 'YouTube' ? 'youtube'
          : metric === 'TinyURL' ? 'tinyurl'
          : metric === 'DeepL' ? 'deepl'
          : metric === 'Contentful' ? 'contentful'
          : 'status';
        const st = validateProbe(probeId, data);
        status = st;
      }

      setFieldTests((prev) => ({ ...prev, [fieldKey]: { status, summary } }));
    } catch (e) {
      setFieldTests((prev) => ({ ...prev, [fieldKey]: { status: 'fail', summary: (e as Error).message } }));
    } finally {
      setTestingKey(null);
    }
  }, [onMetricStatus]);

  return (
    <div className="integration-form">
      {groups.map((group: IntegrationGroup) => (
        <div key={group.id} className="integration-group card">
          <div className="integration-group-head" style={{ borderColor: group.color }}>
            <span className="integration-group-icon">{group.icon}</span>
            <h3 style={{ color: group.color, margin: 0 }}>{group.title}</h3>
            <span className="integration-group-count">
              {group.fields.filter((f) => keys[f.key]?.trim()).length}/{group.fields.length} set
            </span>
          </div>
          <div className="integration-fields">
            {group.fields.map((field) => {
              const st = fieldStatus(field, apiStatus, keys);
              const isConnected = st === 'Connected' || st === 'Configured';
              const canTest = !!(field.metric && METRIC_PROBE_MAP[field.metric]);
              const testResult = fieldTests[field.key];
              return (
                <div key={field.key} className="integration-field">
                  <div className="integration-field-head">
                    <label>{field.label}</label>
                    <div className="integration-field-pills">
                      {keySources?.[field.key] === 'env' && (
                        <span className="api-pill env-pill" title="Loaded from admin .env">.env</span>
                      )}
                      {keySources?.[field.key] === 'user' && (
                        <span className="api-pill user-pill" title="Configured by user">User</span>
                      )}
                      <span className={`api-pill ${isConnected ? 'ok' : 'warn'}`}>{st}</span>
                      {canTest && (
                        <button
                          type="button"
                          className="btn"
                          style={{ fontSize: '0.68rem', padding: '2px 8px', marginLeft: 4 }}
                          disabled={testingKey === field.key}
                          onClick={() => runFieldTest(field.key, field.metric)}
                        >
                          {testingKey === field.key ? '…' : 'Test'}
                        </button>
                      )}
                      {testResult && testResult.status !== 'running' && (
                        <span
                          className={`api-pill ${testResult.status === 'pass' ? 'ok' : testResult.status === 'warn' ? 'warn' : ''}`}
                          title={testResult.summary}
                          style={{ fontSize: '0.65rem' }}
                        >
                          {testResult.status}
                        </span>
                      )}
                    </div>
                  </div>
                  {field.type === 'textarea' ? (
                    <textarea
                      className="input"
                      rows={3}
                      placeholder={field.placeholder}
                      value={keys[field.key] || ''}
                      onChange={(e) => onChange(field.key, e.target.value)}
                    />
                  ) : (
                    <input
                      className="input"
                      type={field.type === 'password' ? 'password' : field.type || 'text'}
                      placeholder={field.placeholder}
                      value={keys[field.key] || ''}
                      onChange={(e) => onChange(field.key, e.target.value)}
                    />
                  )}
                  {testResult?.summary && testResult.status !== 'running' && (
                    <p className="integration-hint" style={{ color: testResult.status === 'pass' ? '#22c55e' : '#f59e0b' }}>
                      Live: {testResult.summary}
                    </p>
                  )}
                  {field.hint && <p className="integration-hint">{field.hint}</p>}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}