'use client';
import { useEffect, useState } from 'react';
import { invoke } from '@/lib/api';

export default function CalendarPage() {
  const [posts, setPosts] = useState<Array<{ id: string; content: string; timestamp: string; platform: string }>>([]);
  const [content, setContent] = useState('');
  const [scheduleTime, setScheduleTime] = useState('');

  async function refresh() {
    const list = await invoke<Array<{ id: string; content: string; timestamp: string; platform: string }>>('get-scheduled-posts');
    setPosts(list);
  }

  useEffect(() => { refresh(); }, []);

  async function schedule() {
    const accs = await invoke<Array<{ id: string; platform: string }>>('get-linked-accounts');
    const acc = accs[0];
    if (!acc) return alert('Link an account first');
    await invoke('schedule-post', {
      platform: acc.platform,
      accountId: acc.id,
      content,
      scheduleTime: scheduleTime || new Date(Date.now() + 86400000).toISOString(),
    });
    setContent('');
    refresh();
  }

  return (
    <div>
      <h1 className="page-title">Content Calendar</h1>
      <p className="page-sub">Schedule, edit, and publish posts</p>
      <div className="card">
        <h3>Schedule New Post</h3>
        <textarea className="input" value={content} onChange={(e) => setContent(e.target.value)} rows={3} />
        <input className="input" type="datetime-local" style={{ marginTop: 8 }} onChange={(e) => setScheduleTime(new Date(e.target.value).toISOString())} />
        <button className="btn primary" style={{ marginTop: 8 }} onClick={schedule}>Schedule</button>
      </div>
      <div className="card">
        <h3>Scheduled ({posts.length})</h3>
        {posts.map((p) => (
          <div key={p.id} className="post-card">
            <div className="post-meta">{p.platform} — {new Date(p.timestamp).toLocaleString()}</div>
            <div>{p.content}</div>
            <button className="btn" style={{ marginTop: 8 }} onClick={async () => { await invoke('publish-scheduled-post-now', p.id); refresh(); }}>Publish Now</button>
          </div>
        ))}
      </div>
    </div>
  );
}