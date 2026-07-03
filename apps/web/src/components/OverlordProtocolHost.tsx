'use client';

import { usePathname } from 'next/navigation';
import { useCallback, useEffect, useRef } from 'react';
import { invoke } from '@/lib/api';
import { checkPlatformAdmin } from '@/lib/adminAccess';
import {
  SI_OVERLORD_FLASH,
  SI_OVERLORD_UI_MUTATE,
  pollOverlordInterventions,
  recordPageEnter,
  type PageHealthSnapshot,
  type UiMutateDetail,
} from '@/lib/theeMichaelOverlord';
import { OverlordInterventionBanner } from './OverlordInterventionBanner';
import { OverlordConfirmModal } from './OverlordConfirmModal';
import { OverlordFieldGuard } from './OverlordFieldGuard';

async function simulateTyping(el: HTMLInputElement | HTMLTextAreaElement, value: string) {
  el.focus();
  el.value = '';
  for (let i = 0; i < value.length; i += 1) {
    el.value += value[i];
    el.dispatchEvent(new Event('input', { bubbles: true }));
    await new Promise((r) => setTimeout(r, 12 + Math.random() * 18));
  }
  el.dispatchEvent(new Event('change', { bubbles: true }));
}

const HEALTH_POLL_MS = 45_000;

export function OverlordProtocolHost() {
  const pathname = usePathname();
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isAdminRef = useRef(false);

  useEffect(() => {
    recordPageEnter(pathname);
  }, [pathname]);

  useEffect(() => {
    checkPlatformAdmin().then((admin) => { isAdminRef.current = admin; }).catch(() => { /* ignore */ });
  }, []);

  useEffect(() => {
    const applyMutate = async (detail: UiMutateDetail) => {
      if (detail.selector) {
        const el = document.querySelector(detail.selector) as HTMLElement | null;
        if (el) {
          el.classList.add('overlord-ui-highlight');
          if (detail.scrollIntoView) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          if (detail.autofillValue && (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement)) {
            if (detail.simulateTyping) await simulateTyping(el, detail.autofillValue);
            else {
              el.value = detail.autofillValue;
              el.dispatchEvent(new Event('input', { bubbles: true }));
              el.dispatchEvent(new Event('change', { bubbles: true }));
            }
          }
          setTimeout(() => el.classList.remove('overlord-ui-highlight'), detail.highlightMs || 3500);
        }
      }
    };

    const onMutate = (ev: Event) => {
      const detail = (ev as CustomEvent<UiMutateDetail>).detail;
      if (detail) applyMutate(detail).catch(() => { /* ignore */ });
    };

    const onFlash = () => {
      document.body.classList.add('overlord-screen-flash');
      setTimeout(() => document.body.classList.remove('overlord-screen-flash'), 480);
    };

    window.addEventListener(SI_OVERLORD_UI_MUTATE, onMutate);
    window.addEventListener(SI_OVERLORD_FLASH, onFlash);

    return () => {
      window.removeEventListener(SI_OVERLORD_UI_MUTATE, onMutate);
      window.removeEventListener(SI_OVERLORD_FLASH, onFlash);
    };
  }, []);

  const runHealthPoll = useCallback(async () => {
    const entered = sessionStorage.getItem('si_overlord_telemetry');
    if (!entered) return;
    let tel: { pathname: string; enteredAt: number };
    try {
      tel = JSON.parse(entered);
    } catch {
      return;
    }
    if (tel.pathname !== pathname) return;
    const dwellMs = Date.now() - tel.enteredAt;

    if (!isAdminRef.current) {
      isAdminRef.current = await checkPlatformAdmin().catch(() => false);
    }

    await pollOverlordInterventions({
      pathname,
      dwellMs,
      isAdmin: isAdminRef.current,
      invokeHealth: () => invoke<PageHealthSnapshot>('get-page-health'),
    });
  }, [pathname]);

  useEffect(() => {
    if (pollRef.current) clearInterval(pollRef.current);

    // Immediate health check on login / route change — don't wait 45s
    runHealthPoll().catch(() => { /* ignore */ });

    pollRef.current = setInterval(() => {
      runHealthPoll().catch(() => { /* ignore */ });
    }, HEALTH_POLL_MS);

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [pathname, runHealthPoll]);

  useEffect(() => {
    const onRefreshHealth = () => {
      runHealthPoll().catch(() => { /* ignore */ });
    };
    window.addEventListener('si-brain-refresh-health', onRefreshHealth);
    return () => window.removeEventListener('si-brain-refresh-health', onRefreshHealth);
  }, [runHealthPoll]);

  return (
    <>
      <OverlordInterventionBanner />
      <OverlordConfirmModal />
      <OverlordFieldGuard />
    </>
  );
}