'use client';

import { useEffect, useRef } from 'react';
import { executeGuideActions, pollRemoteGuideActions } from '@/lib/guide_executor';
import { dispatchBrainToast } from '@/lib/liveSupportActions';

const POLL_MS = 4000;

export function GuideExecutorHost() {
  const busyRef = useRef(false);

  useEffect(() => {
    const tick = async () => {
      if (busyRef.current) return;
      busyRef.current = true;
      try {
        const { pending, actions, reply } = await pollRemoteGuideActions();
        if (pending && actions.length) {
          if (reply) dispatchBrainToast(`Imperialism Brain: ${reply.replace(/\*\*/g, '')}`);
          await executeGuideActions(actions);
        }
      } catch {
        /* silent — user may be offline */
      } finally {
        busyRef.current = false;
      }
    };

    tick();
    const id = setInterval(tick, POLL_MS);
    return () => clearInterval(id);
  }, []);

  return null;
}