'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { invoke } from '@/lib/api';

type Account = { id: string; platform: string; handle?: string };

type Props = {
  value: string;
  onChange: (id: string) => void;
  label?: string;
  platformFilter?: string;
};

export function AccountSelectField({ value, onChange, label = 'Publish via account', platformFilter }: Props) {
  const [accounts, setAccounts] = useState<Account[]>([]);

  useEffect(() => {
    invoke<Account[]>('get-linked-accounts')
      .then((list) => {
        const all = list || [];
        const filtered = platformFilter
          ? all.filter((a) => a.platform.toLowerCase().includes(platformFilter.toLowerCase()))
          : all;
        setAccounts(filtered.length ? filtered : all);
      })
      .catch(console.error);
  }, [platformFilter]);

  if (!accounts.length) {
    return (
      <div style={{ marginBottom: 8 }}>
        <span className="ac-label">{label}</span>
        <p className="settings-panel-desc" style={{ margin: '4px 0 0' }}>
          <Link href="/account-hub">Link an account</Link> to publish or schedule.
        </p>
      </div>
    );
  }

  return (
    <div style={{ marginBottom: 8 }}>
      <label className="ac-label">{label}</label>
      <select className="input" value={value} onChange={(e) => onChange(e.target.value)}>
        {accounts.map((a) => (
          <option key={a.id} value={a.id}>{a.platform} — {a.handle || a.id}</option>
        ))}
      </select>
    </div>
  );
}