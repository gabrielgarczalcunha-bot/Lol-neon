import axios from "axios";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

// ---------------------------------------------------------------------------
// API base URL resolution
//   priority: 1) user override saved in storage (SettingsModal on login)
//             2) build-time env (EXPO_PUBLIC_BACKEND_URL)
//             3) hardcoded fallback to the current preview URL
// ---------------------------------------------------------------------------
const FALLBACK_URL = "https://lotes-gestao.preview.emergentagent.com";
const ENV_BASE = (process.env.EXPO_PUBLIC_BACKEND_URL || "").trim();
const URL_OVERRIDE_KEY = "neonfarm.api_url_override";

function sanitize(u: string): string {
  return (u || "").trim().replace(/\/+$/, "");
}

// In-memory current URL (updated when user changes it)
let CURRENT_BASE = sanitize(ENV_BASE || FALLBACK_URL);

export function getApiBase(): string {
  return CURRENT_BASE;
}

export const TOKEN_KEY = "lotepro.token";

async function storageSet(k: string, v: string) {
  if (Platform.OS === "web") {
    try { localStorage.setItem(k, v); } catch {}
    return;
  }
  await SecureStore.setItemAsync(k, v);
}
async function storageGet(k: string): Promise<string | null> {
  if (Platform.OS === "web") {
    try { return localStorage.getItem(k); } catch { return null; }
  }
  return await SecureStore.getItemAsync(k);
}
async function storageDel(k: string) {
  if (Platform.OS === "web") {
    try { localStorage.removeItem(k); } catch {}
    return;
  }
  await SecureStore.deleteItemAsync(k);
}

export async function loadStoredApiUrl(): Promise<string | null> {
  return await storageGet(URL_OVERRIDE_KEY);
}

export async function saveApiUrl(url: string) {
  const clean = sanitize(url);
  if (!clean) {
    await storageDel(URL_OVERRIDE_KEY);
    CURRENT_BASE = sanitize(ENV_BASE || FALLBACK_URL);
  } else {
    await storageSet(URL_OVERRIDE_KEY, clean);
    CURRENT_BASE = clean;
  }
  api.defaults.baseURL = `${CURRENT_BASE}/api`;
}

export async function clearApiUrlOverride() {
  await storageDel(URL_OVERRIDE_KEY);
  CURRENT_BASE = sanitize(ENV_BASE || FALLBACK_URL);
  api.defaults.baseURL = `${CURRENT_BASE}/api`;
}

export async function initApiBase() {
  try {
    const stored = await loadStoredApiUrl();
    if (stored) {
      CURRENT_BASE = sanitize(stored);
      api.defaults.baseURL = `${CURRENT_BASE}/api`;
    }
  } catch {}
  try {
    const { loadDemoFlag } = await import("./demoMode");
    await loadDemoFlag();
  } catch {}
}

// Constants used by login screen for diagnostics
export const API_BASE = CURRENT_BASE;
export const DEFAULT_API_BASE = sanitize(ENV_BASE || FALLBACK_URL);

export const api = axios.create({
  baseURL: `${CURRENT_BASE}/api`,
  timeout: 25000,                 // mobile networks can be slow
  headers: { Accept: "application/json" },
});

if (__DEV__) {
  // eslint-disable-next-line no-console
  console.log("[api] Initial base URL:", `${CURRENT_BASE}/api`);
}

export async function saveToken(token: string) { await storageSet(TOKEN_KEY, token); }
export async function loadToken(): Promise<string | null> { return await storageGet(TOKEN_KEY); }
export async function clearToken() { await storageDel(TOKEN_KEY); }

api.interceptors.request.use(async (config) => {
  // Demo / offline mode — short-circuit every request with mocked data
  try {
    const { isDemoMode, demoHandle } = await import("./demoMode");
    if (isDemoMode()) {
      const url = (config.url || "").replace(/^\/+/, "");
      const method = (config.method || "get").toUpperCase();
      const body = typeof config.data === "string" ? safeJson(config.data) : config.data;
      const resp = await demoHandle(method, url, body);
      if (resp) {
        // Throw a fake adapter response that axios understands
        config.adapter = async () => resp;
      }
    }
  } catch {}
  const token = await loadToken();
  if (token) {
    config.headers = config.headers || {};
    (config.headers as any).Authorization = `Bearer ${token}`;
  }
  return config;
});

function safeJson(s: string): any { try { return JSON.parse(s); } catch { return s; } }

// Retry once on transient network errors (timeout / no response).
api.interceptors.response.use(
  (resp) => resp,
  async (error) => {
    const cfg = error?.config;
    const isNetwork = !error?.response || error?.code === "ECONNABORTED" || error?.message === "Network Error";
    if (cfg && isNetwork && !cfg._retried) {
      cfg._retried = true;
      await new Promise((r) => setTimeout(r, 600));
      try { return await api.request(cfg); } catch { /* fall through */ }
    }
    return Promise.reject(error);
  }
);

export function formatApiError(e: any): string {
  if (e?.message === "Network Error" || e?.code === "ERR_NETWORK") {
    return "Sem conexão com o servidor. Tente novamente em alguns instantes.";
  }
  if (e?.code === "ECONNABORTED") {
    return "O servidor demorou demais para responder. Tente novamente.";
  }
  const status = e?.response?.status;
  if (status === 404) {
    return "Não foi possível concluir a operação. Tente novamente em instantes.";
  }
  const d = e?.response?.data?.detail;
  if (!d) return e?.message || "Erro desconhecido";
  if (typeof d === "string") return d;
  if (Array.isArray(d)) return d.map((x: any) => x?.msg || JSON.stringify(x)).join(" ");
  return String(d);
}

export function fmtBRL(v: number | undefined | null): string {
  const n = Number(v || 0);
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
