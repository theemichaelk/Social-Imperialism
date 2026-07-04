'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { invoke } from '@/lib/api';
import { ImperialismBrainAvatar } from '@/components/ImperialismBrainAvatar';
import {
  SI_BRAIN_HIGHLIGHT_NAV,
  SI_BRAIN_NAVIGATE,
  SI_BRAIN_TOAST,
  type BrainNavigateDetail,
} from '@/lib/liveSupportActions';

export function BrainNavigatorHost() {
  const router = useRouter();
  const [toast, setToast] = useState('');

  const showToast = useCallback((message: string) => {
    setToast(message);
    const t = setTimeout(() => setToast(''), 4200);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    const onNavigate = (ev: Event) => {
      const detail = (ev as CustomEvent<BrainNavigateDetail>).detail;
      if (!detail?.href) return;
      router.push(detail.href);
    };

    const onToast = (ev: Event) => {
      const msg = (ev as CustomEvent<{ message: string }>).detail?.message;
      if (msg) showToast(msg);
    };

    const onHighlight = (ev: Event) => {
      const { navId, sectionId, ms } = (ev as CustomEvent<{ navId: string; sectionId?: string; ms?: number }>).detail || {};
      if (!navId) return;
      const link = document.querySelector(`[data-nav-id="${navId}"]`);
      if (link) {
        link.classList.add('nav-link-brain-highlight');
        if (sectionId) {
          const section = document.querySelector(`[data-nav-section="${sectionId}"]`);
          section?.classList.add('nav-section-brain-highlight');
        }
        setTimeout(() => {
          link.classList.remove('nav-link-brain-highlight');
          if (sectionId) {
            document.querySelector(`[data-nav-section="${sectionId}"]`)?.classList.remove('nav-section-brain-highlight');
          }
        }, ms || 3200);
      }
    };

    const onRefreshHealth = () => {
      invoke('get-page-health').catch(() => { /* ignore */ });
    };

    window.addEventListener(SI_BRAIN_NAVIGATE, onNavigate);
    window.addEventListener(SI_BRAIN_TOAST, onToast);
    window.addEventListener(SI_BRAIN_HIGHLIGHT_NAV, onHighlight);
    window.addEventListener('si-brain-refresh-health', onRefreshHealth);

    return () => {
      window.removeEventListener(SI_BRAIN_NAVIGATE, onNavigate);
      window.removeEventListener(SI_BRAIN_TOAST, onToast);
      window.removeEventListener(SI_BRAIN_HIGHLIGHT_NAV, onHighlight);
      window.removeEventListener('si-brain-refresh-health', onRefreshHealth);
    };
  }, [router, showToast]);

  if (!toast) return null;

  return (
    <div className="brain-nav-toast" role="status" aria-live="polite">
      <ImperialismBrainAvatar size="sm" className="brain-nav-toast-icon" />
      {toast}
    </div>
  );
}