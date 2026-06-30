import React, { createContext, useContext, useEffect, useState } from 'react';
import * as api from '@/lib/api';

type AuthContextType = {
  ready: boolean;
  token: string | null;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const t = await api.getToken();
      if (t) {
        try {
          await api.repairSession();
          setToken(t);
        } catch {
          await api.clearSession();
        }
      }
      setReady(true);
    })();
  }, []);

  const signIn = async (email: string, password: string) => {
    const session = await api.auth.login(email, password);
    await api.setSession(session);
    setToken(session.token);
    await api.repairSession();
  };

  const signOut = async () => {
    try {
      await api.auth.logout();
    } catch {
      /* still clear local session */
    }
    await api.clearSession();
    setToken(null);
  };

  return (
    <AuthContext.Provider value={{ ready, token, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth outside AuthProvider');
  return ctx;
}