/** Social Imperialism post template catalog — designer categories for on-brand social content */

export type TemplateCategory =
  | 'promotional-design'
  | 'promotional-ai-image'
  | 'educational-carousel'
  | 'promotional-video'
  | 'educational-design'
  | 'quote-ai-image'
  | 'national-day-carousel'
  | 'national-day-design'
  | 'photo-highlight'
  | 'testimonial-ai-image'
  | 'thought-leadership'
  | 'thread';

export type ImperialTemplate = {
  id: TemplateCategory;
  label: string;
  description: string;
  contentType: string;
  gradient: [string, string];
  accent: string;
};

export const IMPERIAL_TEMPLATES: ImperialTemplate[] = [
  { id: 'promotional-design', label: 'Promotional Design', description: 'Bold offer or service highlight with branded layout', contentType: 'post', gradient: ['#1e3a5f', '#2563eb'], accent: '#38bdf8' },
  { id: 'promotional-ai-image', label: 'Promotional AI Image', description: 'Eye-catching visual with short conversion copy', contentType: 'image', gradient: ['#4c1d95', '#7c3aed'], accent: '#a78bfa' },
  { id: 'educational-carousel', label: 'Educational Carousel', description: 'Multi-slide tips, guides, or how-tos', contentType: 'carousel', gradient: ['#134e4a', '#0d9488'], accent: '#2dd4bf' },
  { id: 'promotional-video', label: 'Promotional Video', description: 'Reel or short-form video with hook caption', contentType: 'video', gradient: ['#7f1d1d', '#dc2626'], accent: '#f87171' },
  { id: 'educational-design', label: 'Educational Design', description: 'Clean infographic-style educational post', contentType: 'infographic', gradient: ['#1e3a5f', '#0369a1'], accent: '#38bdf8' },
  { id: 'quote-ai-image', label: 'Quote AI Image', description: 'Team spotlight or authority quote card', contentType: 'image', gradient: ['#312e81', '#6366f1'], accent: '#818cf8' },
  { id: 'national-day-carousel', label: 'National Day Carousel', description: 'Timely holiday or awareness day content', contentType: 'carousel', gradient: ['#713f12', '#d97706'], accent: '#fbbf24' },
  { id: 'national-day-design', label: 'National Day Design', description: 'Single-image observance or seasonal post', contentType: 'image', gradient: ['#831843', '#db2777'], accent: '#f472b6' },
  { id: 'photo-highlight', label: 'Photo Highlight', description: 'Lifestyle or behind-the-scenes showcase', contentType: 'image', gradient: ['#365314', '#65a30d'], accent: '#a3e635' },
  { id: 'testimonial-ai-image', label: 'Testimonial AI Image', description: 'Social proof with customer quote overlay', contentType: 'image', gradient: ['#0c4a6e', '#0284c7'], accent: '#7dd3fc' },
  { id: 'thought-leadership', label: 'Thought Leadership', description: 'Professional insight post for LinkedIn-style reach', contentType: 'post', gradient: ['#1e293b', '#334155'], accent: '#94a3b8' },
  { id: 'thread', label: 'Thread / X', description: 'Numbered multi-part thread for depth', contentType: 'thread', gradient: ['#0f172a', '#1d4ed8'], accent: '#60a5fa' },
];

export type GeneratedPost = {
  id: string;
  type: string;
  templateId?: TemplateCategory;
  content: string;
  mediaUrl?: string | null;
  platform?: string;
  accountId?: string;
  status?: 'draft' | 'approved' | 'scheduled' | 'published' | 'rejected';
  keywords?: string;
  model?: string;
  headline?: string;
  isVideo?: boolean;
  hasMedia?: boolean;
};

export function templateForType(type: string, index = 0): ImperialTemplate {
  const map: Record<string, TemplateCategory[]> = {
    post: ['promotional-design', 'thought-leadership', 'promotional-design'],
    image: ['promotional-ai-image', 'quote-ai-image', 'testimonial-ai-image', 'photo-highlight'],
    carousel: ['educational-carousel', 'national-day-carousel'],
    video: ['promotional-video'],
    infographic: ['educational-design'],
    thread: ['thread'],
    thumbnail: ['promotional-ai-image'],
    answer: ['thought-leadership'],
    analytics: ['educational-design'],
  };
  const options = map[type] || ['promotional-design'];
  const id = options[index % options.length];
  return IMPERIAL_TEMPLATES.find((t) => t.id === id) || IMPERIAL_TEMPLATES[0];
}

export function enrichGeneratedItem(item: GeneratedPost, index = 0): GeneratedPost {
  const template = item.templateId
    ? IMPERIAL_TEMPLATES.find((t) => t.id === item.templateId) || templateForType(item.type, index)
    : templateForType(item.type, index);
  const lines = (item.content || '').split('\n').filter(Boolean);
  return {
    ...item,
    templateId: template.id,
    headline: item.headline || lines[0]?.slice(0, 72) || 'New post',
    status: item.status || 'draft',
  };
}

export function extractHeadline(content: string): string {
  const first = content.split('\n').find((l) => l.trim()) || content;
  return first.replace(/^#+\s*/, '').slice(0, 80);
}

export const WORKFLOW_STEPS = [
  { id: 'brand', label: 'Brand Voice', icon: '🎯' },
  { id: 'generate', label: 'Generate', icon: '✨' },
  { id: 'review', label: 'Edit & Approve', icon: '✓' },
  { id: 'publish', label: 'Schedule & Publish', icon: '🚀' },
] as const;

export type WorkflowStep = typeof WORKFLOW_STEPS[number]['id'];