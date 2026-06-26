export const PROMPT_VAULT_FEATURES = [
  { id: 'general', label: 'General / Brain', icon: '🧠' },
  { id: 'content-hub', label: 'Content Hub', icon: '✏️' },
  { id: 'grok', label: 'Grok & Visual', icon: '✨' },
  { id: 'keywords', label: 'Keywords', icon: '🏷️' },
  { id: 'replies', label: 'AI Replies', icon: '💬' },
  { id: 'engagement', label: 'Engagement Queue', icon: '👥' },
  { id: 'quora', label: 'Quora Ops', icon: '❓' },
  { id: 'reddit', label: 'Reddit / Growth Lab', icon: '🔴' },
  { id: 'seo', label: 'SEO Tools', icon: '🔍' },
  { id: 'automations', label: 'Auto-Rules / Visual Builder', icon: '⚙️' },
  { id: 'analytics', label: 'Analytics & Reports', icon: '📊' },
] as const;

export type PromptVaultFeatureId = (typeof PROMPT_VAULT_FEATURES)[number]['id'];

export function featureLabel(id: string) {
  return PROMPT_VAULT_FEATURES.find((f) => f.id === id)?.label || id;
}