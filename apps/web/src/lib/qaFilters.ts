/** Shared QA/test-data filters — mirrors desktop accountCreator.isQaTestKit patterns. */

export function isQaCampaign(c: { id?: string; brandName?: string; domain?: string } | null | undefined): boolean {
  if (!c) return false;
  const name = String(c.brandName || '').trim();
  const domain = String(c.domain || '').trim().toLowerCase();
  const id = String(c.id || '');
  if (/wizard\s*qa|qa\s*brand|^qa\b/i.test(name)) return true;
  if (/\.test$|wizardqa\.com|addcamp\.test|fixverify\.test|repro\.test|wizardsave\.test/i.test(domain)) return true;
  if (/^wiz_qa|^camp_qa|^mon_wiz/i.test(id)) return true;
  return false;
}

export function isQaDnsSite(site: { domain?: string; name?: string } | null | undefined): boolean {
  if (!site) return false;
  const domain = String(site.domain || '').trim().toLowerCase();
  const name = String(site.name || '').trim();
  if (/\.test$/i.test(domain)) return true;
  if (/^(addcamp|fixverify|repro|wizardsave)\./i.test(domain)) return true;
  if (/^qa\b/i.test(name)) return true;
  return false;
}

export function isPlaceholderDnsValue(value: string): boolean {
  const v = String(value || '').trim();
  return !v
    || /^your[_\s-]?server[_\s-]?ip$/i.test(v)
    || /^example\.com$/i.test(v)
    || /^0\.0\.0\.0$/.test(v)
    || /^changeme$/i.test(v);
}

export function isQaScheduledPost(post: { content?: string; status?: string } | null | undefined): boolean {
  if (!post) return false;
  const content = String(post.content || '');
  return /browse\s+qa|qa\s+(page test|publish|scheduled|test)/i.test(content);
}