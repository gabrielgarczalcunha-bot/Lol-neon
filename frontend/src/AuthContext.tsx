import React, { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { api, saveToken, loadToken, clearToken } from "./api";

export type User = {
  id: string;
  name: string;
  email: string;
  role: "user" | "admin";
  balance: number;
  created_at: string;
};

type AuthState = {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<User>;
  register: (name: string, email: string, password: string, referralCode?: string) => Promise<User>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
};

const Ctx = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const t = await loadToken();
      if (!t) { setLoading(false); return; }
      try {
        const { data } = await api.get("/auth/me");
        setUser(data);
      } catch {
        await clearToken();
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const login = async (email: string, password: string) => {
    const { data } = await api.post("/auth/login", { email, password });
    await saveToken(data.token);
    setUser(data.user);
    return data.user as User;
  };

  const register = async (name: string, email: string, password: string, referralCode?: string) => {
    const payload: any = { name, email, password };
    if (referralCode && referralCode.trim()) {
      payload.referral_code = referralCode.trim().toUpperCase();
    }
    const { data } = await api.post("/auth/register", payload);
    await saveToken(data.token);
    setUser(data.user);
    return data.user as User;
  };

  const logout = async () => {
    await clearToken();
    setUser(null);
  };

  const refresh = async () => {
    try {
      const { data } = await api.get("/auth/me");
      setUser(data);
    } catch {
      /* ignore */
    }
  };

  return (
    <Ctx.Provider value={{ user, loading, login, register, logout, refresh }}>
      {children}
    </Ctx.Provider>
  );
}

export function useAuth() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useAuth must be used within AuthProvider");
  return v;
}
