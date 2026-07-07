'use client';

import { PageShell } from '@/components/PageShell';
import { ImperialVideoStudioPanel } from '@/components/ImperialVideoStudioPanel';
import { GrokToolbar } from '@/components/GrokToolbar';

export default function VideoStudioPage() {
  return (
    <PageShell
      title="Video Studio"
      subtitle="12 agentic pipelines · 52 tools · 620+ skills — turn Imperialism Brain into a full video production studio."
    >
      <details className="ivs-grok-collapsible card">
        <summary>Grok clips — desktop app or localhost only</summary>
        <p className="muted ivs-grok-collapsible-note">
          Cloud production cannot launch Edge/Chrome. Use <a href="/content-hub?tab=media">Create → Media</a> to attach clips,
          or run the desktop app / local API for Grok Video.
        </p>
        <GrokToolbar pageId="video-studio" compact title="Grok clips" suppressCloudBanner />
      </details>
      <ImperialVideoStudioPanel />
    </PageShell>
  );
}