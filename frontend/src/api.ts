import axios from "axios";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

// Fallback to the live preview URL if the env var was not embedded at build time
const FALLBACK_URL = "https://lotes-gestao.preview.emergentagent.com";
const RAW_BASE = process.env.EXPO_PUBLIC_BACKEND_URL || FALLBACK_URL;
// Strip trailing slash to avoid double-slash issues
export const API_BASE = RAW_BASE.replace(/\/+$/, "");

export const api = axios.create({
  baseURL: `${API_BASE}/api`,
  timeout: 20000,
});

if (__DEV__) {
  // eslint-disable-next-line no-console
  console.log("[api] Base URL:", `${API_BASE}/api`);
}

const TOKEN_KEY = "lotepro.token";

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

export async function saveToken(token: string) { await storageSet(TOKEN_KEY, token); }
export async function loadToken(): Promise<string | null> { return await storageGet(TOKEN_KEY); }
export async function clearToken() { await storageDel(TOKEN_KEY); }

api.interceptors.request.use(async (config) => {
  const token = await loadToken();
  if (token) {
    config.headers = config.headers || {};
    (config.headers as any).Authorization = `Bearer ${token}`;
  }
  return config;
});

export function formatApiError(e: any): string {
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
