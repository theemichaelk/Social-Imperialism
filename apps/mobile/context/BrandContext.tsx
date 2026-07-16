import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import * as api from '@/lib/api';
import type { BrandProject, MeResponse } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';

type BrandContextType = {
  brands: BrandProject[];
  activeBrand: BrandProject | null;
  loading: boolean;
  error: string | null;
  planLimit: boolean;
  refresh: () => Promise<void>;
  selectBrand: (id: string) => Promise<void>;
  createBrand: (name: string) => Promise<{ ok: boolean; error?: string; planLimit?: boolean }>;
  platformCount: number;
};

const BrandContext = createContext<BrandContextType | null>(null);

function pickActive(brands: BrandProject[], me: MeResponse | null, projectId: string | null) {
  if (!brands.length) return null;
  if (projectId) {
    const match = brands.find((b) => b.id === projectId);
    if (match) return match;
  }
  if (me?.project?.id) {
    const match = brands.find((b) => b.id === me.project!.id);
    if (match) return match;
  }
  return brands.find((b) => b.isActive) || brands[0];
}

export function BrandProvider({ children }: { children: React.ReactNode }) {
  const { token, me, refreshMe } = useAuth();
  const [brands, setBrands] = useState<BrandProject[]>([]);
  const [activeBrand, setActiveBrand] = useState<BrandProject | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [planLimit, setPlanLimit] = useState(false);
  const [platformCount, setPlatformCount] = useState(0);

  const refresh = useCallback(async () => {
    if (!token) {
      setBrands([]);
      setActiveBrand(null);
      setError(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      // Dual-path load: /me projects first (stable), then /orgs/projects if available.
      let list: BrandProject[] = [];
      try {
        const profile = await api.fetchMe();
        list = api.normalizeProjects(profile);
      } catch (e) {
        const msg = (e as Error)?.message || 'Could not load your brands';
        // Last attempt via orgs route
        try {
          list = await api.listProjects();
        } catch {
          throw new Error(msg);
        }
      }

      if (!list.length) {
        try {
          list = await api.listProjects();
        } catch {
          /* empty is ok — user may need onboarding */
        }
      }

      const projectId = await api.getProjectId();
      const active = pickActive(list, me, projectId);
      if (active?.id && active.id !== projectId) {
        await api.setProjectId(active.id);
      }

      setBrands(list);
      setActiveBrand(active);

      // Linked accounts count for "Active · N platforms"
      try {
        const accounts = await api.invoke<unknown[]>('get-linked-accounts');
        const n = Array.isArray(accounts) ? accounts.length : 0;
        setPlatformCount(n);
      } catch {
        setPlatformCount(0);
      }
    } catch (e) {
      const msg = (e as Error)?.message || 'Could not load your brands';
      setError(msg);
      setBrands([]);
      setActiveBrand(null);
    } finally {
      setLoading(false);
    }
  }, [token, me]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const selectBrand = useCallback(async (id: string) => {
    setError(null);
    try {
      await api.activateProject(id);
      await refreshMe();
      await refresh();
    } catch (e) {
      // Soft-fail: still switch local project header so invoke works
      await api.setProjectId(id);
      const found = brands.find((b) => b.id === id) || null;
      setActiveBrand(found);
      setError((e as Error)?.message || 'Could not switch brand');
    }
  }, [brands, refresh, refreshMe]);

  const createBrand = useCallback(async (name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return { ok: false, error: 'Brand name is required.' };
    try {
      setPlanLimit(false);
      const project = await api.createProject({ name: trimmed, brandName: trimmed });
      await api.activateProject(project.id);
      await refreshMe();
      await refresh();
      return { ok: true };
    } catch (e) {
      const err = e as api.ApiError;
      const planHit = !!err.planLimit || /free plan|1 brand|plan limit|upgrade/i.test(err.message || '');
      if (planHit) setPlanLimit(true);
      return {
        ok: false,
        error: err.message || 'Could not create brand',
        planLimit: planHit,
      };
    }
  }, [refresh, refreshMe]);

  const value = useMemo(
    () => ({
      brands,
      activeBrand,
      loading,
      error,
      planLimit,
      refresh,
      selectBrand,
      createBrand,
      platformCount,
    }),
    [brands, activeBrand, loading, error, planLimit, refresh, selectBrand, createBrand, platformCount],
  );

  return <BrandContext.Provider value={value}>{children}</BrandContext.Provider>;
}

export function useBrand() {
  const ctx = useContext(BrandContext);
  if (!ctx) throw new Error('useBrand must be used inside BrandProvider');
  return ctx;
}
