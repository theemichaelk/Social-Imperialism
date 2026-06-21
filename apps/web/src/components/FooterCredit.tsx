export function FooterCredit({ className = 'home-footer-copy' }: { className?: string }) {
  return (
    <p className={className}>
      Powered By{' '}
      <a href="https://tsbrenterprises.com" target="_blank" rel="noopener noreferrer">
        The Stone Builders Rejected
      </a>{' '}
      Michael K
    </p>
  );
}