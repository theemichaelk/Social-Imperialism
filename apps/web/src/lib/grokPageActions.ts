/**
 * Page-scoped Grok toolbar actions — mirrors packages/core/src/grokDefaults.js GROK_FEATURES.
 * Infographic and full video pipeline belong on Create surfaces, not Brand/Library/etc.
 */
export type GrokToolbarActions = {
  text: boolean;
  imagine: boolean;
  video: boolean;
  infographic: boolean;
  rebuild: boolean;
};

const PAGE_ACTIONS: Record<string, GrokToolbarActions> = {
  'content-hub': { text: true, imagine: true, video: true, infographic: true, rebuild: true },
  'design-studio': { text: true, imagine: true, video: false, infographic: false, rebuild: true },
  'brand': { text: true, imagine: false, video: false, infographic: false, rebuild: true },
  'content-library': { text: true, imagine: true, video: false, infographic: false, rebuild: true },
  'video-studio': { text: true, imagine: false, video: true, infographic: false, rebuild: true },
};

const DEFAULT_ACTIONS: GrokToolbarActions = {
  text: true,
  imagine: false,
  video: false,
  infographic: false,
  rebuild: true,
};

export function getGrokToolbarActions(pageId: string): GrokToolbarActions {
  return PAGE_ACTIONS[pageId] || DEFAULT_ACTIONS;
}