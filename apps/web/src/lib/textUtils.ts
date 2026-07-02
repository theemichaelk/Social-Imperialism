/** Decode common HTML entities in RSS/API headlines for display. */
export function decodeHtmlEntities(text: string | undefined | null): string {
  if (!text) return '';
  return text
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&apos;/gi, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCharCode(parseInt(h, 16)));
}

/** Strip HTML tags and decode entities for library/feed preview text. */
export function stripHtmlForDisplay(text: string | undefined | null, maxLen?: number): string {
  if (!text) return '';
  const plain = decodeHtmlEntities(text)
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (maxLen && plain.length > maxLen) return `${plain.slice(0, maxLen)}…`;
  return plain;
}

/** Clean SERP-style discovery snippets (Reddit/Google) for reply inbox previews. */
export function sanitizeDiscoverySnippet(text: string | undefined | null, maxLen = 120): string {
  let plain = stripHtmlForDisplay(text);
  plain = plain
    .replace(/^(?:Re:\s*)?(?:Reddit|Twitter|News|LinkedIn)\s+[\w.-]+\s*›\s*/i, '')
    .replace(/^(?:Re:\s*)?reddit\.com\s*›\s*/i, '')
    .replace(/\s+on\s+Reddit:?\s*/gi, ' · ')
    .replace(/\s+r\/\w+\s+on\s+Reddit/gi, '')
    .replace(/^Re:\s*/i, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
  if (maxLen && plain.length > maxLen) return `${plain.slice(0, maxLen)}…`;
  return plain;
}