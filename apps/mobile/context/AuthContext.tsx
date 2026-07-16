import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import * as api from '@/lib/api';
import type { MeResponse } from '@/lib/api';

type AuthContextType = {
  ready: boolean;
  token: string | null;
  me: MeResponse | null;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshMe: () => Promise<MeResponse | null>;
};

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [me, setMe] = useState<MeResponse | null>(null);

  const refreshMe = useCallback(async () => {
    try {
      const profile = await api.repairSession();
      setMe(profile);
      return profile;
    } catch {
      await api.clearSession();
      setToken(null);
      setMe(null);
      return null;
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const t = await api.getToken();
        if (!t) {
          if (!cancelled) {
            setToken(null);
            setMe(null);
            setReady(true);
          }
          return;
        }
        const profile = await api.repairSession();
        if (!cancelled) {
          setToken(t);
          setMe(profile);
        }
      } catch {
        await api.clearSession();
        if (!cancelled) {
          setToken(null);
          setMe(null);
        }
      } finally {
        if (!cancelled) setReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    const session = await api.auth.login(email, password);
    await api.setSession(session);
    setToken(session.token);
    const profile = await api.repairSession();
    setMe(profile);
  }, []);

  const signOut = useCallback(async () => {
    try {
      await api.auth.logout();
    } catch {
      /* clear local anyway */
    }
    await api.clearSession();
    setToken(null);
    setMe(null);
  }, []);

  const value = useMemo(
    () => ({ ready, token, me, signIn, signOut, refreshMe }),
    [ready, token, me, signIn, signOut, refreshMe],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
