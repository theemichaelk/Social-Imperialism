'use client';
import { useMemo, useState } from 'react';
import { invoke } from '@/lib/api';

export type ScheduledPost = {
  id: string;
  content: string;
  timestamp: string;
  platform: string;
  status?: string;
  mediaUrl?: string;
};

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const PLATFORM_COLORS: Record<string, string> = {
  Twitter: '#1DA1F2',
  LinkedIn: '#0A66C2',
  Facebook: '#1877F2',
  Instagram: '#E1306C',
  Reddit: '#FF4500',
};

function platformClass(platform: string): string {
  return (platform || '').toLowerCase().replace(/\s+/g, '');
}

function startOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function daysInMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
}

function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

type ViewMode = 'month' | 'week' | 'list';

type Props = {
  posts: ScheduledPost[];
  onRefresh: () => void;
  onApplyTime?: (iso: string) => void;
};

function startOfWeek(d: Date) {
  const copy = new Date(d);
  copy.setDate(copy.getDate() - copy.getDay());
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function isDue(post: ScheduledPost) {
  return new Date(post.timestamp).getTime() <= Date.now();
}

export function CalendarGrid({ posts, onRefresh, onApplyTime }: Props) {
  const [cursor, setCursor] = useState(() => startOfMonth(new Date()));
  const [viewMode, setViewMode] = useState<ViewMode>('month');
  const [dragId, setDragId] = useState<string | null>(null);
  const [editing, setEditing] = useState<ScheduledPost | null>(null);
  const [editContent, setEditContent] = useState('');
  const [editTime, setEditTime] = useState('');
  const [platformFilter, setPlatformFilter] = useState('all');

  const today = new Date();
  const filtered = platformFilter === 'all'
    ? posts
    : posts.filter((p) => p.platform === platformFilter);

  const cells = useMemo(() => {
    const first = startOfMonth(cursor);
    const total = daysInMonth(cursor);
    const offset = first.getDay();
    const grid: Array<{ date: Date | null; key: string }> = [];
    for (let i = 0; i < offset; i++) grid.push({ date: null, key: `empty-${i}` });
    for (let d = 1; d <= total; d++) {
      grid.push({ date: new Date(cursor.getFullYear(), cursor.getMonth(), d), key: `day-${d}` });
    }
    return grid;
  }, [cursor]);

  function postsForDay(date: Date) {
    return filtered.filter((p) => sameDay(new Date(p.timestamp), date));
  }

  async function reschedule(postId: string, targetDate: Date) {
    const post = posts.find((p) => p.id === postId);
    if (!post) return;
    const old = new Date(post.timestamp);
    const next = new Date(targetDate);
    next.setHours(old.getHours(), old.getMinutes(), 0, 0);
    await invoke('update-scheduled-post', {
      id: postId,
      updates: { scheduleTime: next.toISOString(), timestamp: next.toISOString() },
    });
    onRefresh();
  }

  function openEdit(post: ScheduledPost) {
    setEditing(post);
    setEditContent(post.content);
    const d = new Date(post.timestamp);
    const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
    setEditTime(local);
  }

  async function saveEdit() {
    if (!editing) return;
    await invoke('update-scheduled-post', {
      id: editing.id,
      updates: {
        content: editContent,
        scheduleTime: new Date(editTime).toISOString(),
        timestamp: new Date(editTime).toISOString(),
      },
    });
    setEditing(null);
    onRefresh();
  }

  const monthLabel = cursor.toLocaleString('default', { month: 'long', year: 'numeric' });
  const weekStart = startOfWeek(cursor);
  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(weekStart.getDate() + i);
    return d;
  });
  const sortedList = [...filtered].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

  function navPrev() {
    if (viewMode === 'week') {
      const d = new Date(cursor);
      d.setDate(d.getDate() - 7);
      setCursor(d);
    } else {
      setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1));
    }
  }

  function navNext() {
    if (viewMode === 'week') {
      const d = new Date(cursor);
      d.setDate(d.getDate() + 7);
      setCursor(d);
    } else {
      setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1));
    }
  }

  function renderPostChip(p: ScheduledPost) {
    return (
      <div
        key={p.id}
        className={`post-item ${platformClass(p.platform)} ${p.status === 'failed' ? 'failed' : ''} ${isDue(p) ? 'due' : ''}`}
        style={{ borderLeftColor: PLATFORM_COLORS[p.platform] || '#64748b' }}
        draggable={viewMode !== 'list'}
        onDragStart={(e) => {
          setDragId(p.id);
          e.dataTransfer.setData('text/post-id', p.id);
          e.currentTarget.classList.add('dragging');
        }}
        onDragEnd={(e) => {
          e.currentTarget.classList.remove('dragging');
          setDragId(null);
        }}
        onClick={() => openEdit(p)}
      >
        <div className="post-time">
          {new Date(p.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          <span className="badge" style={{ fontSize: '0.6rem' }}>{p.platform}</span>
        </div>
        <div className="post-content-preview">{p.content}</div>
      </div>
    );
  }

  return (
    <div className="calendar-grid-wrap">
      <div className="calendar-toolbar">
        <div className="month-controls">
          <button type="button" className="month-btn" onClick={navPrev} disabled={viewMode === 'list'}>←</button>
          <span className="current-month">
            {viewMode === 'week'
              ? `${weekDays[0].toLocaleDateString([], { month: 'short', day: 'numeric' })} – ${weekDays[6].toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}`
              : monthLabel}
          </span>
          <button type="button" className="month-btn" onClick={navNext} disabled={viewMode === 'list'}>→</button>
          <button type="button" className="month-btn" onClick={() => setCursor(startOfMonth(new Date()))} title="Today">●</button>
        </div>
        <div className="calendar-view-toggle">
          {(['month', 'week', 'list'] as ViewMode[]).map((m) => (
            <button key={m} type="button" className={`btn ${viewMode === m ? 'primary' : ''}`} onClick={() => setViewMode(m)}>
              {m.charAt(0).toUpperCase() + m.slice(1)}
            </button>
          ))}
        </div>
        <select className="input" value={platformFilter} onChange={(e) => setPlatformFilter(e.target.value)} style={{ maxWidth: 140, margin: 0 }}>
          <option value="all">All Platforms</option>
          {[...new Set(posts.map((p) => p.platform))].map((p) => (
            <option key={p} value={p}>{p}</option>
          ))}
        </select>
      </div>

      {viewMode === 'month' && (
        <>
      <div className="calendar-header-row">
        {DAY_NAMES.map((d) => <div key={d} className="day-header">{d}</div>)}
      </div>

      <div className="calendar-grid">
        {cells.map(({ date, key }) => {
          if (!date) return <div key={key} className="calendar-day empty" />;
          const dayPosts = postsForDay(date);
          const isToday = sameDay(date, today);
          return (
            <div
              key={key}
              className={`calendar-day ${isToday ? 'today' : ''} ${dragId ? 'droppable' : ''}`}
              onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add('drag-over'); }}
              onDragLeave={(e) => e.currentTarget.classList.remove('drag-over')}
              onDrop={(e) => {
                e.preventDefault();
                e.currentTarget.classList.remove('drag-over');
                const id = e.dataTransfer.getData('text/post-id') || dragId;
                if (id) reschedule(id, date);
                setDragId(null);
              }}
            >
              <div className="date-number">{date.getDate()}</div>
              <div className="post-container">
                {dayPosts.map((p) => (
                  <div
                    key={p.id}
                    className={`post-item ${platformClass(p.platform)} ${p.status === 'failed' ? 'failed' : ''}`}
                    style={{ borderLeftColor: PLATFORM_COLORS[p.platform] || '#64748b' }}
                    draggable
                    onDragStart={(e) => {
                      setDragId(p.id);
                      e.dataTransfer.setData('text/post-id', p.id);
                      e.currentTarget.classList.add('dragging');
                    }}
                    onDragEnd={(e) => {
                      e.currentTarget.classList.remove('dragging');
                      setDragId(null);
                    }}
                    onClick={() => openEdit(p)}
                  >
                    <div className="post-time">
                      {new Date(p.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      <span className="badge" style={{ fontSize: '0.6rem' }}>{p.platform}</span>
                    </div>
                    <div className="post-content-preview">{p.content}</div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
        </>
      )}

      {viewMode === 'week' && (
        <div className="calendar-week-grid">
          {weekDays.map((date, i) => {
            const dayPosts = postsForDay(date);
            const isToday = sameDay(date, today);
            return (
              <div
                key={i}
                className={`calendar-week-day ${isToday ? 'today' : ''}`}
                onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add('drag-over'); }}
                onDragLeave={(e) => e.currentTarget.classList.remove('drag-over')}
                onDrop={(e) => {
                  e.preventDefault();
                  e.currentTarget.classList.remove('drag-over');
                  const id = e.dataTransfer.getData('text/post-id') || dragId;
                  if (id) reschedule(id, date);
                  setDragId(null);
                }}
              >
                <div className="week-day-header">
                  {DAY_NAMES[i]}<br />
                  <span className="day-num">{date.getDate()}</span>
                </div>
                <div className="post-container">{dayPosts.map(renderPostChip)}</div>
              </div>
            );
          })}
        </div>
      )}

      {viewMode === 'list' && (
        <div className="calendar-list-view">
          {!sortedList.length && <p className="settings-panel-desc">No scheduled posts match the current filter.</p>}
          {sortedList.map((p) => (
            <div
              key={p.id}
              className={`list-post-row ${isDue(p) ? 'due' : ''} ${p.status === 'failed' ? 'failed' : ''}`}
              onClick={() => openEdit(p)}
            >
              <span>{new Date(p.timestamp).toLocaleDateString()}</span>
              <span>{new Date(p.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
              <span className="list-platform">{p.platform}</span>
              <span className="list-content">{p.content}</span>
              <span>{p.status || '—'}</span>
            </div>
          ))}
        </div>
      )}

      {editing && (
        <div className="modal-overlay" onClick={() => setEditing(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">Edit Scheduled Post</h3>
              <button type="button" className="close-btn" onClick={() => setEditing(null)}>×</button>
            </div>
            <div className="post-details-box">
              <span className="badge">{editing.platform}</span>
              {editing.status && <span className="badge">{editing.status}</span>}
            </div>
            <textarea className="input" rows={5} value={editContent} onChange={(e) => setEditContent(e.target.value)} />
            <input className="input" type="datetime-local" value={editTime} onChange={(e) => setEditTime(e.target.value)} />
            <div className="modal-actions">
              <button
                type="button"
                className="btn"
                style={{ color: '#ef4444', borderColor: 'rgba(239,68,68,0.4)' }}
                onClick={async () => {
                  await invoke('delete-scheduled-post', editing.id);
                  setEditing(null);
                  onRefresh();
                }}
              >
                Delete
              </button>
              <div style={{ display: 'flex', gap: 8 }}>
                <button type="button" className="btn" onClick={() => setEditing(null)}>Cancel</button>
                <button
                  type="button"
                  className="btn primary"
                  onClick={async () => {
                    await invoke('publish-scheduled-post-now', editing.id);
                    setEditing(null);
                    onRefresh();
                  }}
                >
                  Publish Now
                </button>
                <button type="button" className="btn primary" onClick={saveEdit}>Save</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}