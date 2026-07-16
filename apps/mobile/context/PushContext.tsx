import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Platform } from 'react-native';
import { useAuth } from '@/context/AuthContext';
import {
  getPushEnabled,
  getStoredPushToken,
  notifyLocal,
  registerForPushNotifications,
  setPushEnabled,
  unregisterPush,
  type PushRegistration,
} from '@/lib/push';

type PushContextType = {
  ready: boolean;
  enabled: boolean;
  token: string | null;
  permission: PushRegistration['permission'] | null;
  message: string | null;
  enable: () => Promise<void>;
  disable: () => Promise<void>;
  testLocal: () => Promise<void>;
};

const PushContext = createContext<PushContextType | null>(null);

export function PushProvider({ children }: { children: React.ReactNode }) {
  const { token: authToken } = useAuth();
  const [ready, setReady] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [pushToken, setPushToken] = useState<string | null>(null);
  const [permission, setPermission] = useState<PushRegistration['permission'] | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const refreshLocal = useCallback(async () => {
    const [on, stored] = await Promise.all([getPushEnabled(), getStoredPushToken()]);
    setEnabled(on && !!stored);
    setPushToken(stored);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      await refreshLocal();
      if (!cancelled) setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [refreshLocal]);

  // Auto-register on native when signed in and previously enabled
  useEffect(() => {
    if (!authToken || Platform.OS === 'web') return;
    let cancelled = false;
    (async () => {
      const on = await getPushEnabled();
      if (!on || cancelled) return;
      const reg = await registerForPushNotifications();
      if (cancelled) return;
      setPermission(reg.permission);
      setEnabled(reg.enabled);
      setPushToken(reg.token);
      setMessage(reg.message || null);
    })();
    return () => {
      cancelled = true;
    };
  }, [authToken]);

  const enable = useCallback(async () => {
    const reg = await registerForPushNotifications();
    setPermission(reg.permission);
    setEnabled(reg.enabled);
    setPushToken(reg.token);
    setMessage(reg.message || null);
    if (reg.permission === 'unsupported' && Platform.OS === 'web') {
      // Web: request Notification permission for local alerts
      try {
        if (typeof Notification !== 'undefined') {
          const p = await Notification.requestPermission();
          setPermission(p === 'granted' ? 'granted' : 'denied');
          setEnabled(p === 'granted');
          await setPushEnabled(p === 'granted');
          setMessage(p === 'granted' ? 'Browser notifications enabled.' : 'Browser notifications denied.');
        }
      } catch {
        setMessage('Web notifications unavailable.');
      }
    }
  }, []);

  const disable = useCallback(async () => {
    await unregisterPush();
    setEnabled(false);
    setPushToken(null);
    setMessage('Notifications disabled.');
  }, []);

  const testLocal = useCallback(async () => {
    await notifyLocal(
      'Social Imperialism',
      'Mission alert test — Command Center is online.',
      { type: 'test' },
    );
    setMessage('Test notification sent.');
  }, []);

  const value = useMemo(
    () => ({
      ready,
      enabled,
      token: pushToken,
      permission,
      message,
      enable,
      disable,
      testLocal,
    }),
    [ready, enabled, pushToken, permission, message, enable, disable, testLocal],
  );

  return <PushContext.Provider value={value}>{children}</PushContext.Provider>;
}

export function usePush() {
  const ctx = useContext(PushContext);
  if (!ctx) throw new Error('usePush must be used inside PushProvider');
  return ctx;
}
