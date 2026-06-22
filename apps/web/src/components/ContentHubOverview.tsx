'use client';

import { useState } from 'react';
import Link from 'next/link';
import { invoke } from '@/lib/api';
import { CONTENT_HUB_OVERVIEW_SECTIONS } from '@/lib/contentHubOverview';

type Props = {
  onStartStudio?: () => void;
};

export function ContentHubOverview({ onStartStudio }: Props) {
  const [website, setWebsite] = useState('');
  const [msg, setMsg] = useState('');
  const [loading, setLoading] = useState(false);

  async function learnFromWebsite() {
    const domain = website.trim().replace(/^https?:\/\//, '').replace(/\/$/, '');
    if (!domain) {
      setMsg('Enter your business website URL');
      return;
    }
    setLoading(true);
    setMsg('Learning brand context from your website…');
    try {
      await invoke(
        'generate-ai',
        `Summarize brand voice, audience, and key topics for website ${domain}. Return 3 sentences for a social content strategy.`,
      );
      setMsg(`Brand context captured for ${domain}. Open Create to generate your first posts.`);
      onStartStudio?.();
    } catch (e) {
      setMsg((e as Error).message || 'Could not analyze website — try again or set domain in Settings.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="ch-overview">
      <div className="ch-overview-hero card">
        <h2>Social Imperialism Content Hub</h2>
        <p className="settings-panel-desc" style={{ maxWidth: 720, margin: 0 }}>
          Your all-in-one system to create, design, publish, collaborate, and analyze — powered by your library,
          the Visual Builder, and AI that stays on-brand.
        </p>
        <div className="ch-overview-pills">
          <span className="badge">Visual Builder</span>
          <span className="badge">Content Library</span>
          <span className="badge">Multi-Platform Publish</span>
          <span className="badge">Team Collaboration</span>
        </div>
      </div>

      <ol className="ch-overview-list">
        {CONTENT_HUB_OVERVIEW_SECTIONS.map((section) => (
          <li key={section.number} className="card ch-overview-item">
            <div className="ch-overview-num">{section.number}</div>
            <div className="ch-overview-body">
              <h3>{section.title}</h3>
              <p>{section.body}</p>
              {section.bullets && (
                <ul>
                  {section.bullets.map((b) => (
                    <li key={b}>{b}</li>
                  ))}
                </ul>
              )}
            </div>
          </li>
        ))}
      </ol>

      <div className="card ch-overview-cta">
        <h3>Enter your business website</h3>
        <p className="settings-panel-desc">
          Seed your brand voice from your site, then generate a month of content in the Create studio and Visual Builder.
        </p>
        <div className="ch-overview-cta-row">
          <input
            className="input"
            placeholder="https://yourbusiness.com"
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && learnFromWebsite()}
          />
          <button type="button" className="btn primary" onClick={learnFromWebsite} disabled={loading}>
            {loading ? 'Analyzing…' : 'Start with my website'}
          </button>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
          <button type="button" className="btn" onClick={() => onStartStudio?.()}>Open Create Studio →</button>
          <Link href="/automations" className="btn">Visual Builder →</Link>
          <Link href="/calendar" className="btn">Content Calendar →</Link>
          <Link href="/account-hub" className="btn">Link Accounts →</Link>
        </div>
        {msg && <p className="ics-msg">{msg}</p>}
      </div>
    </div>
  );
}