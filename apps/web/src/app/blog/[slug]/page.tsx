import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { BlogJsonLd, BlogPostLayout } from '@/components/BlogPostLayout';
import { getAllBlogSlugs, getBlogPost } from '@/lib/blogPosts';
import { getSiteBaseUrl } from '@/lib/publicSiteFeed';

type Props = { params: { slug: string } };

export function generateStaticParams() {
  return getAllBlogSlugs().map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const post = getBlogPost(params.slug);
  if (!post) return { title: 'Article not found' };
  const base = getSiteBaseUrl();
  const url = `${base}/blog/${post.slug}`;
  return {
    title: `${post.title} | Social Imperialism Blog`,
    description: post.description,
    keywords: post.keywords,
    alternates: { canonical: url },
    openGraph: {
      title: post.title,
      description: post.description,
      url,
      type: 'article',
      publishedTime: post.publishedAt,
      modifiedTime: post.updatedAt,
      images: [{ url: `${base}${post.headerImage}` }],
    },
    twitter: {
      card: 'summary_large_image',
      title: post.title,
      description: post.description,
      images: [`${base}${post.headerImage}`],
    },
  };
}

export default function BlogPostPage({ params }: Props) {
  const post = getBlogPost(params.slug);
  if (!post) notFound();
  const base = getSiteBaseUrl();
  return (
    <>
      <BlogJsonLd post={post} baseUrl={base} />
      <BlogPostLayout post={post} />
    </>
  );
}