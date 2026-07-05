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
      <GrokToolbar pageId="video-studio" />
      <ImperialVideoStudioPanel />
    </PageShell>
  );
}