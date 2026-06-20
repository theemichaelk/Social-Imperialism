'use client';
import { FeaturePage } from '@/components/FeaturePage';

export default function RedditAiPage() {
  return (
    <FeaturePage
      title="AI Growth Lab"
      subtitle="Subreddit Ascent, Thread Weaver, Front Page Forge, Inbox Echo, Headline Bridge, Momentum Lens"
      channels={[
        { channel: 'scan-reddit-now', label: 'Reddit Prospector' },
        { channel: 'get-reddit-ai-queue', label: 'Approval Queue' },
      ]}
    />
  );
}