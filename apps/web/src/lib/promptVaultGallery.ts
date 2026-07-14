import type { VaultPrompt } from '@/components/PromptVaultPicker';

/** Strip OpenMontage gallery header/footer for Video Studio brief fields. */
export function extractGalleryBrief(body: string): string {
  const text = String(body || '').trim();
  if (!text) return '';
  const whatIdx = text.indexOf('\n\nWhat you get:');
  const core = whatIdx >= 0 ? text.slice(0, whatIdx) : text;
  const lines = core.split('\n');
  let start = 0;
  while (start < lines.length) {
    const line = lines[start].trim();
    if (!line) {
      start += 1;
      continue;
    }
    if (
      line.startsWith('[OpenMontage')
      || line.startsWith('Estimated time:')
      || line.startsWith('Est. time:')
      || line.startsWith('Pipeline:')
      || line.startsWith('Cost:')
    ) {
      start += 1;
      continue;
    }
    break;
  }
  while (start < lines.length && !lines[start].trim()) start += 1;
  return lines.slice(start).join('\n').trim();
}

export function briefFromVaultLoad(text: string, prompt?: VaultPrompt): string {
  if (prompt?.tags?.includes('gallery') || prompt?.galleryTier) {
    return extractGalleryBrief(text);
  }
  return text;
}