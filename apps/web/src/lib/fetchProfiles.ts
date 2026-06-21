export type FetchProfileFilters = {
  platform?: string;
  keyword?: string;
  language?: string;
  location?: string;
  time?: string;
  minEngage?: string;
  media?: string;
  minFollowers?: string;
  excludeWords?: string;
  postType?: string;
  sort?: string;
  noRepliesYet?: boolean;
};

export type FetchProfile = {
  id?: string;
  name: string;
  filters: FetchProfileFilters;
};

export const PRESET_FETCH_PROFILES: FetchProfile[] = [
  {
    name: 'High-Intent Questions',
    filters: { postType: 'question', sort: 'relevance', time: '24h', language: 'en' },
  },
  {
    name: 'Viral Engagement',
    filters: { minEngage: '100', sort: 'engagement', time: '24h', language: 'en' },
  },
  {
    name: 'Fresh Posts (15m)',
    filters: { time: '15m', sort: 'recent', language: 'en' },
  },
  {
    name: 'LinkedIn B2B',
    filters: { platform: 'LinkedIn', sort: 'relevance', language: 'en', location: 'global' },
  },
  {
    name: 'Reddit Discussions',
    filters: { platform: 'Reddit', sort: 'engagement', postType: 'question', language: 'en' },
  },
];

export const LANGUAGE_OPTIONS = [
  { value: 'all', label: 'All Languages' },
  { value: 'en', label: 'English' },
  { value: 'es', label: 'Spanish' },
  { value: 'fr', label: 'French' },
  { value: 'de', label: 'German' },
  { value: 'pt', label: 'Portuguese' },
  { value: 'ja', label: 'Japanese' },
];

export const LOCATION_OPTIONS = [
  { value: 'global', label: 'Global' },
  { value: 'us', label: 'United States' },
  { value: 'uk', label: 'United Kingdom' },
  { value: 'ca', label: 'Canada' },
  { value: 'au', label: 'Australia' },
  { value: 'eu', label: 'Europe' },
  { value: 'asia', label: 'Asia' },
];