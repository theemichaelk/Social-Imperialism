'use client';

import { useEffect, useRef } from 'react';
import { getApiBase, getProjectId, getToken } from '@/lib/api';

export type SiDomainEvent = {
  type: string;
  data?: Record<string, unknown>;
  projectId?: string;
  organizationId?: string;
  at?: string;
};

type Options = {
  onEvent?: (event: SiDomainEvent) => void;
  enabled?: boolean;
};

export function useSiEvents({ onEvent, enabled = true }: Options) {
  const handlerRef = useRef(onEvent);
  handlerRef.current = onEvent;

  useEffect(() => {
    if (!enabled || typeof window === 'undefined') return;
    const token = getToken();
    if (!token) return;

    let closed = false;

    async function connectFetchStream() {
      const projectId = getProjectId();
      const url = `${getApiBase()}/api/events/stream`;
      try {
        const res = await fetch(url, {
          headers: {
            Authorization: `Bearer ${token}`,
            ...(projectId ? { 'x-project-id': projectId } : {}),
          },
        });
        if (!res.ok || !res.body) return;

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        while (!closed) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const parts = buffer.split('\n\n');
          buffer = parts.pop() || '';
          for (const part of parts) {
            const line = part.split('\n').find((l) => l.startsWith('data: '));
            if (!line) continue;
            try {
              const evt = JSON.parse(line.slice(6)) as SiDomainEvent;
              handlerRef.current?.(evt);
            } catch { /* ignore */ }
          }
        }
      } catch {
        if (!closed) setTimeout(connectFetchStream, 5000);
      }
    }

    connectFetchStream();

    return () => {
      closed = true;
    };
  }, [enabled]);
}