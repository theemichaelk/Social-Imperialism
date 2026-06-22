'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Logo } from '@/components/Logo';
import { HomeHeroBanner } from '@/components/HomeHeroBanner';
import { HomeShowcaseSlider } from '@/components/HomeShowcaseSlider';
import { HomeTicker } from '@/components/HomeTicker';
import { HomeFounderSection } from '@/components/HomeFounderSection';
import { HomeFooter } from '@/components/HomeFooter';
import { getToken } from '@/lib/api';
import { NAV_SECTIONS } from '@/lib/nav';

const PLATFORMS = [
  'Twitter / X', 'LinkedIn', 'Reddit', 'Meta', 'Instagram', 'YouTube',
  'TikTok', 'Pinterest', 'Discord', 'Telegram', 'Twitch', 'Quora', 'NewsAPI', 'SerpAPI',
];

const STEPS = [
  { n: 1, title: 'Brand Profile', desc: 'Integrate your brand, domain, and tone — AI uses this for every reply and post.' },
  { n: 2, title: 'Keywords & Platforms', desc: 'AI-suggested keywords across 14+ networks. Track what matters to your audience.' },
  { n: 3, title: 'Live Feed Preview', desc: 'Quick scan or full discovery — see real posts from connected APIs instantly.' },
  { n: 4, title: 'Go Live', desc: 'Worker starts automatically. Mission Control tracks engagement in real time.' },
];

const PLANS = [
  { id: 'starter', name: 'Starter', price: '$49', period: '/mo', highlight: false,
    features: ['3 Social Accounts', '500 AI Generations/mo', 'Content Calendar', 'Keyword Tracking', 'Setup Wizard'] },
  { id: 'growth', name: 'Growth', price: '$149', period: '/mo', highlight: true,
    features: ['15 Social Accounts', '5,000 AI Generations', 'Reddit Prospector', 'Visual Automations', 'Auto-Rules Engine', 'Advanced Analytics'] },
  { id: 'enterprise', name: 'Enterprise', price: 'Custom', period: '', highlight: false,
    features: ['Unlimited Accounts', '24/7 Crisis Monitoring', 'Dedicated Manager', 'Custom Routing', 'SLA & Priority Support'] },
];

const CAPABILITIES = [
  { label: 'IPC Channels', value: '230+', sub: 'full desktop parity' },
  { label: 'Platforms', value: '14+', sub: 'OAuth & API' },
  { label: 'AI Models', value: '100+', sub: 'OpenRouter & Gemini' },
  { label: 'App Modules', value: '18', sub: 'end-to-end workflows' },
];

const DASH_STATS = [
  { label: 'Overview', pct: 92, color: '#38bdf8' },
  { label: 'Feed', pct: 78, color: '#a855f7' },
  { label: 'Growth', pct: 65, color: '#22c55e' },
  { label: 'Analytics', pct: 88, color: '#f59e0b' },
];

export default function HomePage() {
  const [loggedIn, setLoggedIn] = useState(false);
  const [apiOk, setApiOk] = useState<boolean | null>(null);

  useEffect(() => {
    setLoggedIn(!!getToken());
    fetch('/health')
      .then((r) => r.json())
      .then((d) => setApiOk(!!d?.ok))
      .catch(() => setApiOk(false));
  }, []);

  const allFeatures = NAV_SECTIONS.flatMap((s) => s.items.map((item) => ({ ...item, section: s.label })));
  const apiLabel = apiOk ? 'API LIVE' : apiOk === false ? 'OFFLINE' : 'CONNECTING';

  return (
    <div className="home-page">
      <div className="home-bg-grid" aria-hidden />
      <div className="home-floating-orb home-orb-1" aria-hidden />
      <div className="home-floating-orb home-orb-2" aria-hidden />

      <header className="home-nav home-nav-glass">
        <div className="home-nav-brand">
          <Logo size="sm" showText />
        </div>
        <nav className="home-nav-links">
          <a href="#showcase">Demo</a>
          <a href="#features">Features</a>
          <a href="#platforms">Platforms</a>
          <a href="#how-it-works">How It Works</a>
          <a href="#pricing">Pricing</a>
          <Link href="/founder">Founder</Link>
        </nav>
        <div className="home-nav-actions">
          <Link href="/dashboard" className="btn home-btn-glass">Sign In</Link>
          <Link href="/dashboard" className="btn primary home-btn-glow">Open Dashboard</Link>
        </div>
      </header>

      <HomeHeroBanner loggedIn={loggedIn} apiLabel={apiLabel} />
      <HomeTicker />

      <section className="home-metrics-band">
        <div className="home-container home-cap-grid-wide">
          {CAPABILITIES.map((c) => (
            <div key={c.label} className="home-cap-tile home-cap-glow">
              <div className="home-cap-val">{c.value}</div>
              <div className="home-cap-label">{c.label}</div>
              <div className="home-cap-sub">{c.sub}</div>
            </div>
          ))}
        </div>
      </section>

      <HomeShowcaseSlider loggedIn={loggedIn} />

      <section id="platforms" className="home-section home-section-media">
        <div className="home-section-bg-img" style={{ backgroundImage: 'url(/hero/slide-02.jpg)' }} aria-hidden />
        <div className="home-section-bg-overlay" aria-hidden />
        <div className="home-container">
          <span className="home-section-eyebrow">Integrations</span>
          <h2>Connected to the networks that matter</h2>
          <p className="home-section-sub">Real OAuth, API keys, and live feeds — not mocks.</p>
          <div className="home-platform-strip">
            {PLATFORMS.map((p) => (
              <span key={p} className="home-platform-chip home-platform-glow">{p}</span>
            ))}
          </div>
        </div>
      </section>

      <section id="features" className="home-section">
        <div className="home-container">
          <span className="home-section-eyebrow">Platform</span>
          <h2>Everything your team needs</h2>
          <p className="home-section-sub">18 modules — from discovery to publish to growth automation.</p>
          <div className="home-feature-grid">
            {allFeatures.map((f) => (
              <Link key={f.id} href="/dashboard" className="home-feature-card home-feature-glow">
                <span className="home-feature-icon">{f.icon}</span>
                <div className="home-feature-text">
                  <div className="home-feature-section">{f.section}</div>
                  <div className="home-feature-title">{f.label}</div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="home-section home-section-alt home-section-media">
        <div className="home-section-bg-img" style={{ backgroundImage: 'url(/hero/slide-08.jpg)' }} aria-hidden />
        <div className="home-section-bg-overlay" aria-hidden />
        <div className="home-container home-split">
          <div className="home-split-copy home-glass-panel">
            <span className="home-section-eyebrow">Intelligence</span>
            <h2>Real-time intelligence</h2>
            <p className="home-section-sub left">
              Live feeds, trending topics, domain authority, engagement queues, and worker status —
              actionable charts on every dashboard tab.
            </p>
            <ul className="home-checklist">
              {[
                'Live feed across keywords & linked accounts',
                'AI draft, like, reply & schedule',
                'Q&A discovery & auto-compose answers',
                'Reddit prospector & lead capture',
                'Visual automation builder & auto-rules',
              ].map((t) => <li key={t}>{t}</li>)}
            </ul>
            <Link href="/dashboard" className="btn primary home-cta-lg home-btn-glow">
              Open Mission Control
            </Link>
          </div>
          <div className="home-stats-panel home-glass-panel">
            {DASH_STATS.map((s) => (
              <div key={s.label} className="home-stat-row">
                <span className="home-stat-label">{s.label}</span>
                <div className="home-stat-bar-track">
                  <div className="home-stat-bar-fill" style={{ width: `${s.pct}%`, background: s.color }} />
                </div>
                <span className="home-stat-pct" style={{ color: s.color }}>{s.pct}%</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="how-it-works" className="home-section">
        <div className="home-container">
          <span className="home-section-eyebrow">Onboarding</span>
          <h2>Go live in four steps</h2>
          <p className="home-section-sub">Setup Wizard walks you from zero to automated engagement.</p>
          <div className="home-steps">
            {STEPS.map((s) => (
              <div key={s.n} className="home-step-card home-glass-panel">
                <div className="home-step-num">{s.n}</div>
                <h3>{s.title}</h3>
                <p>{s.desc}</p>
              </div>
            ))}
          </div>
          <div className="home-center-cta">
            <Link href="/dashboard" className="btn primary home-cta-lg home-btn-glow">
              Get Started →
            </Link>
          </div>
        </div>
      </section>

      <section id="pricing" className="home-section home-section-media">
        <div className="home-section-bg-img" style={{ backgroundImage: 'url(/hero/slide-07.jpg)' }} aria-hidden />
        <div className="home-section-bg-overlay dark" aria-hidden />
        <div className="home-container">
          <span className="home-section-eyebrow">Pricing</span>
          <h2>Simple, scalable pricing</h2>
          <p className="home-section-sub">Start small, grow into agency-scale automation.</p>
          <div className="home-pricing-grid">
            {PLANS.map((plan) => (
              <div key={plan.id} className={`home-plan-card home-glass-panel ${plan.highlight ? 'highlight' : ''}`}>
                {plan.highlight && <span className="home-plan-badge">Most Popular</span>}
                <h3>{plan.name}</h3>
                <div className="home-plan-price">
                  {plan.price}<span>{plan.period}</span>
                </div>
                <ul>
                  {plan.features.map((f) => <li key={f}>{f}</li>)}
                </ul>
                <Link href="/dashboard" className={`btn home-btn-block ${plan.highlight ? 'primary home-btn-glow' : 'home-btn-glass'}`}>
                  {plan.id === 'enterprise' ? 'Contact Sales' : 'Choose Plan'}
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      <HomeFounderSection />

      <section className="home-cta-band home-cta-video">
        <video
          className="home-cta-video-bg"
          autoPlay
          muted
          loop
          playsInline
          poster="/hero/slide-15.jpg"
          src="https://assets.mixkit.co/videos/preview/mixkit-digital-animation-of-futuristic-devices-99786-large.mp4"
        />
        <div className="home-cta-video-overlay" aria-hidden />
        <div className="home-container">
          <h2>Ready to dominate your niche?</h2>
          <p>Join teams using AI-powered social automation with full API connectivity.</p>
          <div className="home-hero-cta center">
            <Link href="/dashboard" className="btn primary home-cta-lg home-btn-glow">Create Account</Link>
            <Link href="/dashboard" className="btn home-cta-lg home-btn-glass">Explore Integrations</Link>
          </div>
        </div>
      </section>

      <HomeFooter loggedIn={loggedIn} />
    </div>
  );
}