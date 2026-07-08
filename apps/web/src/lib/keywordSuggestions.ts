export function extractKeywordTerm(item: unknown): string {
  if (item == null) return '';
  if (typeof item === 'string') return item.trim();
  if (typeof item === 'object') {
    const row = item as Record<string, unknown>;
    const raw = row.term ?? row.keyword ?? row.query ?? row.value ?? row.label ?? '';
    return String(raw).trim();
  }
  return String(item).trim();
}

export function normalizeKeywordTerms(items: unknown): string[] {
  const list = Array.isArray(items) ? items : [];
  const seen = new Set<string>();
  const out: string[] = [];
  list.forEach((item) => {
    const term = extractKeywordTerm(item);
    const key = term.toLowerCase();
    if (!key || seen.has(key)) return;
    seen.add(key);
    out.push(term);
  });
  return out;
}

export function parseGenerateKeywordsResponse(
  result: unknown,
): { terms: string[]; error?: string } {
  if (result == null) {
    return { terms: [], error: 'No keywords returned' };
  }
  if (Array.isArray(result)) {
    const terms = normalizeKeywordTerms(result);
    return terms.length ? { terms } : { terms: [], error: 'No keywords returned' };
  }
  if (typeof result === 'object') {
    const row = result as { keywords?: unknown; error?: string };
    const terms = normalizeKeywordTerms(row.keywords);
    if (terms.length) return { terms };
    return { terms: [], error: row.error || 'No keywords returned' };
  }
  const term = extractKeywordTerm(result);
  return term ? { terms: [term] } : { terms: [], error: 'No keywords returned' };
}