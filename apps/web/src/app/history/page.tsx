'use client';
import { useEffect, useState } from 'react';
import { invoke } from '@/lib/api';
import { FeaturePage } from '@/components/FeaturePage';

export default function HistoryPage() {
  const [replies, setReplies] = useState<Array<{ id: string; content: string; status: string }>>([]);
  useEffect(() => { invoke('get-ai-replies').then(setReplies).catch(console.error); }, []);

  return (
    <div>
      <FeaturePage title="AI Replies Command Center" subtitle="Approval workflow, export, real metrics" channels={[{ channel: 'get-dashboard-stats', label: 'Stats' }]} />
      <div className="card">
        <h3>Reply Inbox ({replies.length})</h3>
        {replies.map((r) => (
          <div key={r.id} className="post-card">
            <span className="badge">{r.status}</span>
            <div>{r.content}</div>
          </div>
        ))}
      </div>
    </div>
  );
}