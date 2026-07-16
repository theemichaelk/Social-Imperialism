'use client';

import { useEffect, useRef, type ReactNode } from 'react';

/**
 * Explore rail that sticks under the site nav and tracks the full article
 * column height while the post scrolls (CSS sticky + layout height lock).
 */
export function StickyExploreRail({ children }: { children: ReactNode }) {
  const railRef = useRef<HTMLDivElement>(null);
  const wrapRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const wrap = wrapRef.current;
    const rail = railRef.current;
    if (!wrap || !rail) return;

    const layout = wrap.closest('.si-article-layout') as HTMLElement | null;
    const main = layout?.querySelector('.si-article-layout__main') as HTMLElement | null;

    const navOffset = () => {
      const nav = document.querySelector('.home-nav') as HTMLElement | null;
      // Prefer measured sticky nav height so the rail clears it
      const h = nav?.getBoundingClientRect().height || nav?.offsetHeight || 64;
      return Math.round(h + 12);
    };

    /** Stretch the sidebar track to the article column so sticky has travel room. */
    const lockColumnHeight = () => {
      if (!main) return;
      const mainH = Math.ceil(main.getBoundingClientRect().height);
      if (mainH > 0) {
        wrap.style.minHeight = `${mainH}px`;
        wrap.style.height = '100%';
        wrap.style.alignSelf = 'stretch';
      }
    };

    const syncStickyMetrics = () => {
      const top = navOffset();
      rail.style.setProperty('--si-sticky-top', `${top}px`);
      rail.style.top = `${top}px`;
      rail.style.maxHeight = `calc(100vh - ${top + 16}px)`;
      // Reinforce sticky in case a media-query or cascade dropped it
      if (window.matchMedia('(min-width: 1025px)').matches) {
        rail.style.position = 'sticky';
      } else {
        rail.style.position = '';
        rail.style.top = '';
        rail.style.maxHeight = '';
        wrap.style.minHeight = '';
      }
    };

    const sync = () => {
      lockColumnHeight();
      syncStickyMetrics();
    };

    sync();

    // Re-measure when article images / fonts change height
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => sync()) : null;
    if (main) ro?.observe(main);
    ro?.observe(rail);
    if (layout) ro?.observe(layout);

    window.addEventListener('scroll', syncStickyMetrics, { passive: true });
    window.addEventListener('resize', sync);
    // Images can load after first paint and change main column height
    window.addEventListener('load', sync);

    return () => {
      ro?.disconnect();
      window.removeEventListener('scroll', syncStickyMetrics);
      window.removeEventListener('resize', sync);
      window.removeEventListener('load', sync);
    };
  }, []);

  return (
    <aside ref={wrapRef} className="si-blog-sidebar" aria-label="Explore">
      <div
        ref={railRef}
        className="si-blog-sidebar__sticky si-blog-sidebar__sticky--live"
        data-sticky-explore="true"
      >
        {children}
      </div>
    </aside>
  );
}
