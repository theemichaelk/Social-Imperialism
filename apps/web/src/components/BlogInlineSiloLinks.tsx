import { NavAnchor } from '@/components/NavAnchor';
import type { SiloLink } from '@/lib/blogPosts';

/** Natural in-article placement of home / internal / authority links (no "Silo links" chrome). */
export function BlogInlineSiloLinks({
  links,
  placement,
}: {
  links: SiloLink[];
  placement: 'early' | 'mid' | 'late';
}) {
  const home = links.find((l) => l.kind === 'home');
  const internal = links.find((l) => l.kind === 'internal');
  const authority = links.find((l) => l.kind === 'authority');

  if (placement === 'early') {
    return (
      <p className="blog-para si-inline-silo-prose">
        Operators who want the full stack can start from the{' '}
        {home ? <NavAnchor href={home.href}>{home.label}</NavAnchor> : 'homepage'} and open{' '}
        {internal ? <NavAnchor href={internal.href}>{internal.label}</NavAnchor> : 'mission control modules'}{' '}
        when they are ready to execute—not just read frameworks.
      </p>
    );
  }

  if (placement === 'mid') {
    return (
      <p className="blog-para si-inline-silo-prose">
        For deeper primary research beyond this brief, see{' '}
        {authority ? (
          <a href={authority.href} target="_blank" rel="noopener noreferrer">
            {authority.label}
          </a>
        ) : (
          'authoritative industry references'
        )}
        , then return to implement inside{' '}
        {internal ? <NavAnchor href={internal.href}>{internal.label}</NavAnchor> : 'your connected workspace'}.
      </p>
    );
  }

  return (
    <p className="blog-para si-inline-silo-prose">
      Put this into production from the{' '}
      {home ? <NavAnchor href={home.href}>{home.label}</NavAnchor> : 'Social Imperialism homepage'}
      {internal ? (
        <>
          , route work through <NavAnchor href={internal.href}>{internal.label}</NavAnchor>
        </>
      ) : null}
      {authority ? (
        <>
          , and keep a bookmark on{' '}
          <a href={authority.href} target="_blank" rel="noopener noreferrer">
            {authority.label}
          </a>{' '}
          for ongoing standards.
        </>
      ) : (
        '.'
      )}
    </p>
  );
}
