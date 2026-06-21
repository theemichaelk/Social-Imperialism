'use client';

import { INTEGRATION_GROUPS, type IntegrationGroup } from '@/lib/integrationCatalog';

type Props = {
  keys: Record<string, string>;
  apiStatus: Record<string, string>;
  keySources?: Record<string, string>;
  onChange: (key: string, value: string) => void;
  groupFilter?: string;
};

function fieldStatus(field: { key: string; metric?: string }, apiStatus: Record<string, string>, keys: Record<string, string>) {
  if (field.metric && apiStatus[field.metric]) return apiStatus[field.metric];
  if (keys[field.key]?.trim()) return 'Configured';
  return 'Empty';
}

export function IntegrationKeyForm({ keys, apiStatus, keySources, onChange, groupFilter }: Props) {
  const groups = groupFilter
    ? INTEGRATION_GROUPS.filter((g) => g.id === groupFilter)
    : INTEGRATION_GROUPS;

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