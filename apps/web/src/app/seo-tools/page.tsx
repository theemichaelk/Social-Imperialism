'use client';
import { FeaturePage } from '@/components/FeaturePage';

export default function SeoToolsPage() {
  return (
    <FeaturePage
      title="SEO Tools"
      subtitle="KGR, Reddit topics, Quora finder, PAA, autocomplete — 12 tools"
      channels={[
        { channel: 'get-seo-tools-list', label: 'SEO Tools List' },
        { channel: 'research-keyword', label: 'Keyword Research', args: ['marketing'] },
      ]}
    />
  );
}