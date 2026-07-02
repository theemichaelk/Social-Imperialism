import { SITE_FOOTER } from '@/lib/siteBlueprint';

export function FooterCredit({ className = 'home-footer-copy' }: { className?: string }) {
  return (
    <p className={className}>
      Powered By{' '}
      <a href={SITE_FOOTER.creditUrl} target="_blank" rel="noopener noreferrer">
        {SITE_FOOTER.creditOrg}
      </a>
      {' · '}
      {SITE_FOOTER.creditPerson}
    </p>
  );
}