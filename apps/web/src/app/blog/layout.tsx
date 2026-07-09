import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Blog | Social Imperialism — AI Social Automation Guides',
  description: 'Ten SEO-optimized guides on AI social media automation, multi-platform publishing, Reddit and Quora growth, GA4 analytics, and silo architecture.',
  alternates: {
    types: {
      'application/rss+xml': [{ url: '/feed.xml', title: 'Social Imperialism RSS' }],
    },
  },
};

export default function BlogLayout({ children }: { children: React.ReactNode }) {
  return children;
}