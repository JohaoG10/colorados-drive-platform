'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { User } from '@/lib/api';
import { getMe, login as apiLogin, onSessionExpired } from '@/lib/api';

interface AuthContextType {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const stored = typeof window !== 'undefined' ? localStorage.getItem('colorados_token') : null;
    if (stored) {
      getMe(stored)
        .then((u) => {
          setUser(u);
          setToken(stored);
        })
        .catch(() => {
          localStorage.removeItem('colorados_token');
          setToken(null);
          setUser(null);
        })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const clearSession = () => {
      localStorage.removeItem('colorados_token');
      setToken(null);
      setUser(null);
      router.replace('/login');
    };
    return onSessionExpired(clearSession);
  }, [router]);

  const login = async (email: string, password: string) => {
    const data = await apiLogin(email, password);
    localStorage.setItem('colorados_token', data.accessToken);
    setToken(data.accessToken);
    setUser(data.user);
    router.push(data.user.role === 'admin' ? '/admin' : '/student');
  };

  const logout = () => {
    localStorage.removeItem('colorados_token');
    setToken(null);
    setUser(null);
    router.push('/login');
  };

  return (
    <AuthContext.Provider value={{ user, token, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
