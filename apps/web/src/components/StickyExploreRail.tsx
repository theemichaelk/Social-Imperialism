'use client';

import { useEffect, useRef, type ReactNode } from 'react';

/**
 * Sticky rail that tracks page scroll within the article column bounds.
 * Uses CSS sticky first; reinforces with top offset under the site nav.
 */
export function StickyExploreRail({ children }: { children: ReactNode }) {
  const railRef = useRef<HTMLDivElement>(null);
  const wrapRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const wrap = wrapRef.current;
    const rail = railRef.current;
    if (!wrap || !rail) return;

    const navH = () => {
      const nav = document.querySelector('.home-nav') as HTMLElement | null;
      return (nav?.offsetHeight || 64) + 12;
    };

    const sync = () => {
      const top = navH();
      rail.style.setProperty('--si-sticky-top', `${top}px`);
      rail.style.top = `${top}px`;
      rail.style.maxHeight = `calc(100vh - ${top + 16}px)`;
    };

    sync();
    window.addEventListener('scroll', sync, { passive: true });
    window.addEventListener('resize', sync);
    return () => {
      window.removeEventListener('scroll', sync);
      window.removeEventListener('resize', sync);
    };
  }, []);

  return (
    <aside ref={wrapRef} className="si-blog-sidebar" aria-label="Blog sidebar">
      <div ref={railRef} className="si-blog-sidebar__sticky si-blog-sidebar__sticky--live">
        {children}
      </div>
    </aside>
  );
}
