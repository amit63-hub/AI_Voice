'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { api } from './api';

interface User {
  userId: string;
  name: string;
  email: string;
  plan: string;
  usage: { today: number; limit: number | string };
  voice: boolean;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (email: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const saved = localStorage.getItem('auth_token');
    if (saved) {
      setToken(saved);
      api.getMe(saved).then(setUser).catch(() => {
        localStorage.removeItem('auth_token');
        setToken(null);
      }).finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const login = async (email: string) => {
    const data = await api.login(email);
    setToken(data.token);
    localStorage.setItem('auth_token', data.token);
    const me = await api.getMe(data.token);
    setUser(me);
  };

  const register = async (name: string, email: string, password: string) => {
    const data = await api.register(name, email, password);
    setToken(data.token);
    localStorage.setItem('auth_token', data.token);
    const me = await api.getMe(data.token);
    setUser(me);
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    localStorage.removeItem('auth_token');
  };

  const refreshUser = async () => {
    if (!token) return;
    const me = await api.getMe(token);
    setUser(me);
  };

  return (
    <AuthContext.Provider value={{ user, token, loading, login, register, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be inside AuthProvider');
  return ctx;
}
