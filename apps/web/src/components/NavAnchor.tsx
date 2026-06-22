import type { AnchorHTMLAttributes, ReactNode } from 'react';

type Props = AnchorHTMLAttributes<HTMLAnchorElement> & {
  href: string;
  className?: string;
  children: ReactNode;
};

/** Plain anchor — works without client-side JS hydration. */
export function NavAnchor({ href, className, children, ...rest }: Props) {
  return (
    <a href={href} className={className} {...rest}>
      {children}
    </a>
  );
}