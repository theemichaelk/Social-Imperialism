/** Humanization levels for Content Studio UI (mirrors packages/core/src/contentHumanization.js) */

export type HumanizationLevelId = 'off' | 'light' | 'standard' | 'maximum';

export const HUMANIZATION_LEVELS: Array<{ id: HumanizationLevelId; label: string; description: string }> = [
  { id: 'off', label: 'Off', description: 'Raw AI draft only' },
  { id: 'light', label: 'Light', description: 'Context, tone, proofread, anti-AI pass' },
  { id: 'standard', label: 'Standard', description: 'Recommended — 8-step human polish' },
  { id: 'maximum', label: 'Maximum', description: 'Full 16-step Wordtune-style human-native workflow' },
];

export const HUMANIZATION_STEP_LABELS = [
  'Contextual rewrite', 'Tone calibration', 'Proofread', 'Continue & complete', 'Credibility check',
  'Elaborate', 'Clarify', 'Emphasize', 'Conclusion', 'Native English', 'Synonyms', 'Paraphrase',
  'Length & structure', 'Sentence flow', 'Anti-AI detection', 'Final authenticity',
];