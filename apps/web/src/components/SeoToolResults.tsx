'use client';

import type { ReactNode } from 'react';

function ResultTable({ children }: { children: ReactNode }) {
  return <div className="table-scroll-wrap">{children}</div>;
}

type KgrData = {
  allintitle?: number | string;
  searchVolume?: number | string;
  kgr?: number | string;
  rating?: string;
  momentum?: string;
  topResults?: Array<{ title?: string; link?: string }>;
};

const TOOL_FORMS: Record<string, { input: string; label: string; placeholder?: string; type: 'input' | 'textarea' }> = {
  kgr: { input: 'keyword', label: 'Target keyword', placeholder: 'e.g. social media automation', type: 'input' },
  'reddit-topics': { input: 'keyword', label: 'Topic / keyword', placeholder: 'e.g. SaaS marketing', type: 'input' },
  'quora-questions': { input: 'keyword', label: 'Niche keyword', placeholder: 'e.g. email marketing tips', type: 'input' },
  'bulk-index-submit': { input: 'urls', label: 'URLs to index (one per line)', type: 'textarea' },
  'bulk-index-check': { input: 'urls', label: 'URLs to check (one per line)', type: 'textarea' },
  'google-scrape': { input: 'query', label: 'Google search query', type: 'input' },
  'bing-scrape': { input: 'query', label: 'Bing search query', type: 'input' },
  paa: { input: 'keyword', label: 'Seed keyword', type: 'input' },
  grouping: { input: 'keywords', label: 'Keywords (one per line)', type: 'textarea' },
  'youtube-autocomplete': { input: 'seed', label: 'YouTube seed', type: 'input' },
  'google-autocomplete': { input: 'seed', label: 'Google seed', type: 'input' },
  'google-suggestions': { input: 'seed', label: 'Google seed', type: 'input' },
};

export function getSeoToolForm(toolId: string) {
  return TOOL_FORMS[toolId] || { input: 'keyword', label: 'Input', type: 'input' as const };
}

function kgrClass(rating?: string) {
  const r = (rating || '').toLowerCase();
  if (r.includes('golden')) return 'golden';
  if (r.includes('good')) return 'good';
  if (r.includes('competitive')) return 'competitive';
  return '';
}

export function SeoToolResults({ toolId, data }: { toolId: string; data: Record<string, unknown> }) {
  if (!data) return <p className="seo-empty">Run the tool to see results.</p>;

  if (toolId === 'kgr') {
    const d = data as KgrData;
    return (
      <div>
        <div className="seo-metric-grid">
          <div className="seo-metric-box"><div className="val">{d.allintitle ?? '—'}</div><div className="lbl">Allintitle</div></div>
          <div className="seo-metric-box"><div className="val">{d.searchVolume ?? '—'}</div><div className="lbl">Est. Volume</div></div>
          <div className="seo-metric-box"><div className="val">{d.kgr ?? '—'}</div><div className="lbl">KGR</div></div>
        </div>
        {d.rating && <span className={`kgr-badge ${kgrClass(d.rating)}`}>{d.rating}</span>}
        {d.momentum && <span style={{ marginLeft: 8, color: '#64748b', fontSize: '0.75rem' }}>Trend {d.momentum}</span>}
        <p style={{ margin: '1rem 0 0.5rem', fontSize: '0.75rem', color: '#64748b' }}>KGR &lt; 0.25 = golden keyword opportunity</p>
        {(d.topResults || []).length > 0 && (
          <ResultTable>
            <table className="seo-results-table">
              <thead><tr><th>Title</th><th>URL</th></tr></thead>
              <tbody>
                {(d.topResults || []).map((r, i) => (
                  <tr key={i}>
                    <td>{r.title}</td>
                    <td>{r.link ? <a href={r.link} target="_blank" rel="noreferrer">{r.link.slice(0, 50)}…</a> : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </ResultTable>
        )}
      </div>
    );
  }

  if (toolId === 'reddit-topics') {
    const subs = (data.subreddits as Array<{ subreddit?: string; posts?: number; totalUps?: number }>) || [];
    const posts = ((data.posts as Array<{ subreddit?: string; title?: string; ups?: number; url?: string }>) || []).slice(0, 15);
    return (
      <div>
        <p style={{ color: '#94a3b8' }}>{String(data.count || 0)} posts found</p>
        <strong style={{ fontSize: '0.75rem', color: '#64748b' }}>TOP SUBREDDITS</strong>
        <ResultTable>
          <table className="seo-results-table">
            <thead><tr><th>Subreddit</th><th>Posts</th><th>Upvotes</th></tr></thead>
            <tbody>
              {subs.map((s, i) => <tr key={i}><td>{s.subreddit}</td><td>{s.posts}</td><td>{s.totalUps}</td></tr>)}
            </tbody>
          </table>
        </ResultTable>
        <strong style={{ fontSize: '0.75rem', color: '#64748b', display: 'block', marginTop: '1rem' }}>HOT POSTS</strong>
        <ResultTable>
          <table className="seo-results-table">
            <thead><tr><th>Sub</th><th>Title</th><th>Ups</th><th></th></tr></thead>
            <tbody>
              {posts.map((p, i) => (
                <tr key={i}>
                  <td>{p.subreddit}</td><td>{p.title}</td><td>{p.ups}</td>
                  <td>{p.url ? <a href={p.url} target="_blank" rel="noreferrer">open</a> : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </ResultTable>
      </div>
    );
  }

  if (toolId === 'quora-questions' || toolId === 'paa') {
    const questions = (data.questions as Array<{ question?: string; snippet?: string; link?: string }>) || [];
    return (
      <div>
        <p style={{ color: '#94a3b8' }}>{String(data.count || questions.length)} questions</p>
        <ResultTable>
          <table className="seo-results-table">
            <thead><tr><th>Question</th><th>Snippet</th><th></th></tr></thead>
            <tbody>
              {questions.map((q, i) => (
                <tr key={i}>
                  <td>{q.question}</td>
                  <td>{(q.snippet || '').slice(0, 120)}</td>
                  <td>{q.link ? <a href={q.link} target="_blank" rel="noreferrer">open</a> : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </ResultTable>
      </div>
    );
  }

  if (toolId === 'bulk-index-check' || toolId === 'bulk-index-submit') {
    const results = (data.results as Array<{ url?: string; indexed?: boolean; status?: string; foundUrl?: string; note?: string; error?: string }>) || [];
    return (
      <div>
        <p style={{ color: '#94a3b8' }}>{String(data.note || `Checked ${data.checked || data.count || results.length}`)}</p>
        <ResultTable>
          <table className="seo-results-table">
            <thead><tr><th>URL</th><th>Status</th><th>Detail</th></tr></thead>
            <tbody>
              {results.map((r, i) => (
                <tr key={i}>
                  <td style={{ wordBreak: 'break-all' }}>{r.url}</td>
                  <td>{r.indexed !== undefined ? (r.indexed ? '✓ Indexed' : '✗ Not found') : (r.status || '—')}</td>
                  <td>{r.foundUrl || r.note || r.error || ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </ResultTable>
      </div>
    );
  }

  if (toolId === 'google-scrape' || toolId === 'bing-scrape') {
    const results = (data.results as Array<{ position?: number; title?: string; link?: string; displayed_link?: string; snippet?: string }>) || [];
    return (
      <div>
        <p style={{ color: '#94a3b8' }}>{data.total ? `${data.total} total · ` : ''}{results.length} results</p>
        <ResultTable>
          <table className="seo-results-table">
            <thead><tr><th>#</th><th>Title</th><th>Link</th><th>Snippet</th></tr></thead>
            <tbody>
              {results.map((r, i) => (
                <tr key={i}>
                  <td>{r.position || '—'}</td>
                  <td>{r.title}</td>
                  <td>{r.link ? <a href={r.link} target="_blank" rel="noreferrer">{(r.displayed_link || r.link || '').slice(0, 40)}</a> : '—'}</td>
                  <td>{(r.snippet || '').slice(0, 100)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </ResultTable>
      </div>
    );
  }

  if (toolId === 'grouping') {
    const groups = (data.groups as Array<{ theme?: string; count?: number; terms?: string[] }>) || [];
    return (
      <div>
        {groups.map((g, i) => (
          <div key={i} className="seo-group-card">
            <strong style={{ color: '#38bdf8' }}>{g.theme}</strong>
            <span style={{ color: '#64748b', fontSize: '0.72rem', marginLeft: 6 }}>({g.count})</span>
            <div style={{ marginTop: 6, color: '#cbd5e1', fontSize: '0.78rem' }}>{(g.terms || []).join(' · ')}</div>
          </div>
        ))}
        {!groups.length && <p className="seo-empty">No groups</p>}
      </div>
    );
  }

  if (toolId === 'youtube-autocomplete' || toolId === 'google-autocomplete') {
    const suggestions = (data.suggestions as string[]) || [];
    return (
      <div>
        {data.source && <p style={{ color: '#64748b', fontSize: '0.75rem' }}>{String(data.source)}</p>}
        <ul style={{ margin: '0.5rem 0', paddingLeft: '1.2rem' }}>
          {suggestions.map((s, i) => <li key={i} style={{ margin: '4px 0' }}>{i + 1}. {s}</li>)}
        </ul>
      </div>
    );
  }

  if (toolId === 'google-suggestions') {
    const suggestions = (data.suggestions as Array<{ query?: string; link?: string }>) || [];
    return (
      <div>
        <p style={{ color: '#94a3b8' }}>{String(data.count || suggestions.length)} related searches</p>
        <ResultTable>
          <table className="seo-results-table">
            <thead><tr><th>Query</th><th></th></tr></thead>
            <tbody>
              {suggestions.map((s, i) => (
                <tr key={i}>
                  <td>{s.query}</td>
                  <td>{s.link ? <a href={s.link} target="_blank" rel="noreferrer">open</a> : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </ResultTable>
      </div>
    );
  }

  return <pre style={{ fontSize: '0.75rem', overflow: 'auto' }}>{JSON.stringify(data, null, 2)}</pre>;
}