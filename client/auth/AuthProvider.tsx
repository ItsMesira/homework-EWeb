// auth/AuthProvider.tsx — Authentication context

import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { apiClient, Principal } from '../api/client';

interface AuthContextValue {
  principal: Principal | null;
  loading: boolean;
  refresh: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({
  principal: null,
  loading: true,
  refresh: async () => {},
  logout: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [principal, setPrincipal] = useState<Principal | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const { principal } = await apiClient.auth.me();
      setPrincipal(principal);
    } catch {
      setPrincipal(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await apiClient.auth.logout();
    } catch { /* ignore */ }
    setPrincipal(null);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return (
    <AuthContext.Provider value={{ principal, loading, refresh, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
