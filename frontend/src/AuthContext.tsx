import React, { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { api, saveToken, loadToken, clearToken } from "./api";
import { enableDemoMode, disableDemoMode, isDemoMode } from "./demoMode";

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
  demo: boolean;
  login: (email: string, password: string) => Promise<User>;
  register: (name: string, email: string, password: string, referralCode?: string) => Promise<User>;
  loginDemo: () => Promise<User>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
};

const Ctx = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [demo, setDemo] = useState(false);

  useEffect(() => {
    (async () => {
      setDemo(isDemoMode());
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

  const isOfflineErr = (e: any) =>
    !e?.response ||
    e?.code === "ERR_NETWORK" ||
    e?.message === "Network Error" ||
    e?.code === "ECONNABORTED" ||
    e?.response?.status === 404;

  const login = async (email: string, password: string) => {
    try {
      const { data } = await api.post("/auth/login", { email, password });
      await saveToken(data.token);
      setUser(data.user);
      return data.user as User;
    } catch (e: any) {
      if (isOfflineErr(e)) {
        // Server unreachable — silently fall back to local-only mode
        await enableDemoMode();
        setDemo(true);
        const { data } = await api.post("/auth/login", { email, password });
        await saveToken(data.token);
        setUser(data.user);
        return data.user as User;
      }
      throw e;
    }
  };

  const register = async (name: string, email: string, password: string, referralCode?: string) => {
    const payload: any = { name, email, password };
    if (referralCode && referralCode.trim()) {
      payload.referral_code = referralCode.trim().toUpperCase();
    }
    try {
      const { data } = await api.post("/auth/register", payload);
      await saveToken(data.token);
      setUser(data.user);
      return data.user as User;
    } catch (e: any) {
      if (isOfflineErr(e)) {
        // Server unreachable — silently fall back to local-only mode
        await enableDemoMode();
        setDemo(true);
        const { data } = await api.post("/auth/register", payload);
        await saveToken(data.token);
        setUser(data.user);
        return data.user as User;
      }
      throw e;
    }
  };

  const loginDemo = async () => {
    await enableDemoMode();
    setDemo(true);
    const { data } = await api.post("/auth/login", { email: "demo@neonfarm.app", password: "demo" });
    await saveToken(data.token);
    setUser(data.user);
    return data.user as User;
  };

  const logout = async () => {
    if (isDemoMode()) {
      await disableDemoMode();
      setDemo(false);
    }
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
    <Ctx.Provider value={{ user, loading, demo, login, register, loginDemo, logout, refresh }}>
      {children}
    </Ctx.Provider>
  );
}

export function useAuth() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useAuth must be used within AuthProvider");
  return v;
}
