// Local-only demo / offline mode.
// Returns canned responses for every API endpoint so the user can test the
// whole app without any network connectivity.
import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";

const DEMO_FLAG = "neonfarm.demo_mode";
const DEMO_DATA_KEY = "neonfarm.demo_state";

// ---- storage helpers (mirror api.ts) ---------------------------------------
async function sSet(k: string, v: string) {
  if (Platform.OS === "web") { try { localStorage.setItem(k, v); } catch {} return; }
  await SecureStore.setItemAsync(k, v);
}
async function sGet(k: string): Promise<string | null> {
  if (Platform.OS === "web") { try { return localStorage.getItem(k); } catch { return null; } }
  return await SecureStore.getItemAsync(k);
}
async function sDel(k: string) {
  if (Platform.OS === "web") { try { localStorage.removeItem(k); } catch {} return; }
  await SecureStore.deleteItemAsync(k);
}

let DEMO_ACTIVE = false;
export function isDemoMode() { return DEMO_ACTIVE; }
export async function loadDemoFlag() {
  const v = await sGet(DEMO_FLAG);
  DEMO_ACTIVE = v === "1";
  if (DEMO_ACTIVE && !STATE.loaded) await loadState();
  return DEMO_ACTIVE;
}
export async function enableDemoMode() {
  DEMO_ACTIVE = true;
  await sSet(DEMO_FLAG, "1");
  await loadState();
}
export async function disableDemoMode() {
  DEMO_ACTIVE = false;
  await sDel(DEMO_FLAG);
  await sDel(DEMO_DATA_KEY);
  STATE.loaded = false;
}

// ---------------------------------------------------------------------------
// Mock state (persisted)
// ---------------------------------------------------------------------------
const NOW = () => new Date().toISOString();
const uid = () => Math.random().toString(36).slice(2, 10);

type DemoState = {
  loaded: boolean;
  user: any;
  wallet: { balance: number; pending_deposits: number; pending_withdrawals: number };
  lotes: any[];
  purchases: any[];           // {id, lote_id, price_paid, started_at, collected}
  deposits: any[];
  withdrawals: any[];
  transactions: any[];
  notifications: any[];
  settings: { pix_display_key: string; pix_display_owner: string; pix_display_bank: string };
};

const STATE: DemoState = {
  loaded: false,
  user: {
    id: "demo-user",
    name: "Usuário Demo",
    email: "demo@neonfarm.app",
    role: "admin",
    balance: 250,
    has_withdraw_password: true,
    referral_code: "DEMO12",
  },
  wallet: { balance: 250, pending_deposits: 0, pending_withdrawals: 0 },
  lotes: [
    { id: "l1", name: "PC Gamer", description: "Renda diária em jogos digitais", price: 30, hourly_yield: 0.5, duration_days: 30, image_url: "", active: true, created_at: NOW() },
    { id: "l2", name: "Sítio Rural", description: "Cultive e colha rendimentos", price: 100, hourly_yield: 2.0, duration_days: 30, image_url: "", active: true, created_at: NOW() },
    { id: "l3", name: "Mercado de Bairro", description: "Negócio local rentável", price: 250, hourly_yield: 5.5, duration_days: 30, image_url: "", active: true, created_at: NOW() },
  ],
  purchases: [],
  deposits: [],
  withdrawals: [],
  transactions: [],
  notifications: [
    { id: uid(), user_id: "demo-user", title: "Bem-vindo ao modo demo!", body: "Você está testando o app localmente. Nenhuma operação é enviada para o servidor.", kind: "info", read: false, created_at: NOW() },
  ],
  settings: { pix_display_key: "demo@neonfarm.app", pix_display_owner: "Neon Farm", pix_display_bank: "Banco Demo" },
};

async function saveState() {
  const { loaded, ...rest } = STATE;
  await sSet(DEMO_DATA_KEY, JSON.stringify(rest));
}
async function loadState() {
  try {
    const raw = await sGet(DEMO_DATA_KEY);
    if (raw) Object.assign(STATE, JSON.parse(raw));
  } catch {}
  STATE.loaded = true;
}

// ---------------------------------------------------------------------------
// Endpoint matcher — returns { status, data } or null if unhandled
// ---------------------------------------------------------------------------
function ok(data: any) { return { status: 200, statusText: "OK", data, headers: {}, config: {} } as any; }
function err(status: number, detail: string) { return { status, statusText: detail, data: { detail }, headers: {}, config: {} } as any; }

function lotePurchaseInfo(p: any, lote: any) {
  const started = new Date(p.started_at).getTime();
  const totalSec = (lote.duration_days || 30) * 86400;
  const activeSec = Math.min(totalSec, (Date.now() - started) / 1000);
  const remainingSec = Math.max(0, totalSec - activeSec);
  const earned = +(lote.hourly_yield * (activeSec / 3600)).toFixed(2);
  return { started_at: p.started_at, ends_at: new Date(started + totalSec * 1000).toISOString(), earned_total: earned, active_seconds: activeSec, total_seconds: totalSec, remaining_seconds: remainingSec, completed: remainingSec <= 0 };
}

export async function demoHandle(method: string, url: string, body?: any): Promise<any | null> {
  if (!STATE.loaded) await loadState();
  const m = method.toUpperCase();
  const p = url.replace(/^\/+/, "").split("?")[0];   // strip leading slash + querystring

  // ---- health
  if (p === "" || p === "/") return ok({ service: "Neon Farm (Demo)", status: "ok" });

  // ---- auth
  if (p === "auth/me") return ok(STATE.user);
  if (p === "auth/login" && m === "POST") return ok({ token: "demo-token", user: STATE.user });
  if (p === "auth/register" && m === "POST") {
    STATE.user = { ...STATE.user, name: body?.name || "Demo", email: body?.email || "demo@x.com" };
    await saveState();
    return ok({ token: "demo-token", user: STATE.user });
  }

  // ---- wallet / lotes
  if (p === "wallet") return ok({ ...STATE.wallet, balance: STATE.user.balance });
  if (p === "lotes") return ok(STATE.lotes.filter(l => l.active));
  if (p === "me/lotes") {
    return ok(STATE.purchases.map(pu => {
      const lote = STATE.lotes.find(l => l.id === pu.lote_id) || STATE.lotes[0];
      const info = lotePurchaseInfo(pu, lote);
      const available = +(info.earned_total - (pu.collected || 0)).toFixed(2);
      return { purchase_id: pu.id, lote, ...info, collected: pu.collected || 0, available, progress_pct: info.total_seconds ? +(100 * info.active_seconds / info.total_seconds).toFixed(2) : 0 };
    }));
  }
  const buyMatch = p.match(/^me\/lotes\/([^/]+)\/buy$/);
  if (buyMatch && m === "POST") {
    const lote = STATE.lotes.find(l => l.id === buyMatch[1]);
    if (!lote) return err(404, "Lote não encontrado");
    if ((STATE.user.balance || 0) < lote.price) return err(400, "Saldo insuficiente");
    STATE.user.balance -= lote.price;
    const purchase = { id: uid(), lote_id: lote.id, price_paid: lote.price, started_at: NOW(), collected: 0, created_at: NOW() };
    STATE.purchases.push(purchase);
    STATE.transactions.unshift({ id: uid(), type: "purchase", amount: -lote.price, description: `Compra do lote ${lote.name}`, created_at: NOW() });
    await saveState();
    return ok({ ok: true, purchase });
  }
  const collectMatch = p.match(/^me\/lotes\/([^/]+)\/collect$/);
  if (collectMatch && m === "POST") {
    const pu = STATE.purchases.find(x => x.id === collectMatch[1]);
    if (!pu) return err(404, "Compra não encontrada");
    const lote = STATE.lotes.find(l => l.id === pu.lote_id);
    if (!lote) return err(404, "Lote não encontrado");
    const info = lotePurchaseInfo(pu, lote);
    const available = +(info.earned_total - (pu.collected || 0)).toFixed(2);
    if (available <= 0) return err(400, "Nada para coletar agora");
    pu.collected = (pu.collected || 0) + available;
    STATE.user.balance += available;
    STATE.transactions.unshift({ id: uid(), type: "yield", amount: available, description: `Rendimento de ${lote.name}`, created_at: NOW() });
    await saveState();
    return ok({ ok: true, collected: available, new_balance: STATE.user.balance });
  }

  // ---- transactions
  if (p === "transactions") return ok(STATE.transactions);

  // ---- deposits
  if (p === "deposits" && m === "POST") {
    const d = { id: uid(), user_id: "demo-user", amount: body.amount, status: "pending", proof_image: "", created_at: NOW() };
    STATE.deposits.unshift(d);
    STATE.notifications.unshift({ id: uid(), user_id: "demo-user", title: "Depósito enviado (demo)", body: `Seu depósito de R$ ${(+body.amount).toFixed(2)} foi registrado localmente.`, kind: "deposit", read: false, created_at: NOW() });
    await saveState();
    return ok({ ok: true, deposit_id: d.id });
  }
  if (p === "deposits/mine") return ok(STATE.deposits);

  // ---- withdrawals
  if (p === "withdrawals/rules") {
    const hasApproved = STATE.withdrawals.some(w => w.status === "approved");
    return ok({ is_first_withdrawal: !hasApproved, min_amount: hasApproved ? 30 : 10, tax_pct: hasApproved ? 10 : 0, message: hasApproved ? "Saques subsequentes: mínimo R$30, taxa 10%" : "Primeiro saque: mínimo R$10, sem taxa" });
  }
  if (p === "withdrawals" && m === "POST") {
    const amount = +body.amount;
    if (amount > STATE.user.balance) return err(400, "Saldo insuficiente");
    STATE.user.balance -= amount;
    const w = { id: uid(), amount, pix_key: body.pix_key, pix_key_type: body.pix_key_type, status: "pending", net_amount: amount, tax_amount: 0, created_at: NOW() };
    STATE.withdrawals.unshift(w);
    STATE.notifications.unshift({ id: uid(), user_id: "demo-user", title: "Saque solicitado (demo)", body: `Pedido de saque de R$ ${amount.toFixed(2)} registrado localmente.`, kind: "withdraw", read: false, created_at: NOW() });
    await saveState();
    return ok({ ok: true, withdrawal_id: w.id });
  }
  if (p === "withdrawals/mine") return ok(STATE.withdrawals);

  // ---- notifications
  if (p === "me/notifications") return ok({ items: STATE.notifications, unread: STATE.notifications.filter(n => !n.read).length });
  if (p === "me/notifications/unread-count") return ok({ unread: STATE.notifications.filter(n => !n.read).length });
  if (p === "me/notifications/read-all" && m === "POST") {
    STATE.notifications.forEach(n => n.read = true); await saveState();
    return ok({ ok: true });
  }
  const notifReadMatch = p.match(/^me\/notifications\/([^/]+)\/read$/);
  if (notifReadMatch && m === "POST") {
    const n = STATE.notifications.find(x => x.id === notifReadMatch[1]);
    if (n) n.read = true; await saveState();
    return ok({ ok: true });
  }

  // ---- referrals
  if (p === "me/referrals") return ok({ code: STATE.user.referral_code || "DEMO12", bonus_pct: 10, bonus_cap: 50, total_referrals: 0, paid_referrals: 0, total_earned: 0, referrals: [] });

  // ---- settings / pix
  if (p === "settings/pix") return ok({ pix_display_key: STATE.settings.pix_display_key, pix_display_owner: STATE.settings.pix_display_owner, pix_display_bank: STATE.settings.pix_display_bank, pix_key_type: "email" });

  // ---- admin endpoints (all minimal)
  if (p === "admin/lotes") {
    if (m === "GET") return ok(STATE.lotes);
    if (m === "POST") {
      const l = { id: uid(), ...body, created_at: NOW(), active: body.active !== false };
      STATE.lotes.push(l); await saveState();
      return ok(l);
    }
  }
  const adminLoteMatch = p.match(/^admin\/lotes\/([^/]+)$/);
  if (adminLoteMatch) {
    const id = adminLoteMatch[1];
    if (m === "PUT") {
      const idx = STATE.lotes.findIndex(l => l.id === id);
      if (idx < 0) return err(404, "Lote não encontrado");
      STATE.lotes[idx] = { ...STATE.lotes[idx], ...body }; await saveState();
      return ok(STATE.lotes[idx]);
    }
    if (m === "DELETE") {
      STATE.lotes = STATE.lotes.filter(l => l.id !== id); await saveState();
      return ok({ ok: true });
    }
  }
  if (p === "admin/users") return ok([STATE.user]);
  if (p === "admin/deposits") return ok(STATE.deposits);
  if (p === "admin/withdrawals") return ok(STATE.withdrawals);
  if (p === "admin/banned-ips") return ok([]);
  if (p === "admin/stats") {
    return ok({
      total_users: 1, total_lotes: STATE.lotes.length, total_deposits: STATE.deposits.length,
      pending_deposits: STATE.deposits.filter(d => d.status === "pending").length, approved_deposits: 0,
      total_withdrawals: STATE.withdrawals.length, pending_withdrawals: STATE.withdrawals.filter(w => w.status === "pending").length,
      total_transactions: STATE.transactions.length, total_notifications: STATE.notifications.length,
      total_referrals: 0, total_banned_ips: 0,
      total_balance: STATE.user.balance, sum_approved_deposits: 0, sum_approved_withdrawals: 0,
    });
  }
  if (p === "admin/generate-image" && m === "POST") {
    return err(503, "Geração de imagem por IA não está disponível no modo demo (sem internet).");
  }

  // catch-all admin/* — return empty list to avoid breaking screens
  if (p.startsWith("admin/")) return ok([]);

  return null; // unhandled — caller will surface a clean error
}
