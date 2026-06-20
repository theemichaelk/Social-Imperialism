'use client';
import { FeaturePage } from '@/components/FeaturePage';

export default function QuoraTrafficPage() {
  return (
    <FeaturePage
      title="Quora Traffic Ops"
      subtitle="Research → Generate → Publish pipeline with 4 answer frameworks"
      channels={[
        { channel: 'discover-best-questions', label: 'Q&A Discovery' },
        { channel: 'get-unanswered-questions', label: 'Unanswered Tracker' },
        { channel: 'compose-qa-answer', label: 'Answer Composer', args: [{ question: 'Best marketing automation tool?', platform: 'Quora' }] },
      ]}
    />
  );
}