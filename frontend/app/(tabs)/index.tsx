import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, RefreshControl, TouchableOpacity, ActivityIndicator, Image,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter, useFocusEffect } from "expo-router";
import { api, fmtBRL } from "../../src/api";
import { C } from "../../src/theme";
import { useAuth } from "../../src/AuthContext";

type WalletData = { balance: number; pending_yield: number; pending_deposits: number; pending_withdrawals: number };
type MyLote = {
  purchase_id: string;
  lote: { id: string; name: string; price: number; hourly_yield: number; duration_days: number; image_url: string };
  earned_total: number; collected: number; available: number;
  active_seconds: number; total_seconds: number; remaining_seconds: number;
  progress_pct: number; completed: boolean; started_at: string; ends_at: string;
};

export default function Home() {
  const { user } = useAuth();
  const router = useRouter();
  const [wallet, setWallet] = useState<WalletData | null>(null);
  const [mine, setMine] = useState<MyLote[]>([]);
  const [loading, setLoading] = useState(true);
  const [refresh, setRefresh] = useState(false);
  const [unread, setUnread] = useState(0);
  const tickRef = useRef<any>(null);
  const [tick, setTick] = useState(0);

  const load = useCallback(async () => {
    try {
      const [w, m, n] = await Promise.all([
        api.get("/wallet"),
        api.get("/me/lotes"),
        api.get("/me/notifications/unread-count").catch(() => ({ data: { unread: 0 } })),
      ]);
      setWallet(w.data);
      setMine(m.data);
      setUnread(n.data.unread || 0);
    } catch {}
  }, []);

  useFocusEffect(useCallback(() => {
    setLoading(true);
    load().finally(() => setLoading(false));
  }, [load]));

  useEffect(() => {
    tickRef.current = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(tickRef.current);
  }, []);

  // Live yield simulation: for each lote, add (hourly/3600) per second ticked locally
  const liveYield = (() => {
    if (!mine.length) return 0;
    let total = 0;
    const nowMs = Date.now();
    mine.forEach(m => {
      const started = new Date(m.started_at).getTime();
      const ends = new Date(m.ends_at).getTime();
      const activeMs = Math.max(0, Math.min(nowMs, ends) - started);
      const earned = (activeMs / 3_600_000) * m.lote.hourly_yield;
      total += Math.max(0, earned - m.collected);
    });
    return total;
  })();

  const onRefresh = async () => {
    setRefresh(true);
    await load();
    setRefresh(false);
  };

  const collect = async () => {
    try {
      await api.post("/me/collect");
      await load();
    } catch {}
  };

  if (loading) {
    return (
      <SafeAreaView style={s.safe}><View style={s.center}><ActivityIndicator size="large" color={C.primary} /></View></SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.safe} edges={["top"]}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={refresh} onRefresh={onRefresh} tintColor={C.primary} />}
      >
        <View style={s.header}>
          <View style={{ flex: 1 }}>
            <Text style={s.hi}>Olá,</Text>
            <Text style={s.name} numberOfLines={1}>{user?.name?.split(" ")[0] || "investidor"}</Text>
          </View>
          <TouchableOpacity onPress={() => router.push("/notificacoes")} style={s.bellBtn} testID="home-notifications">
            <Ionicons name="notifications" size={20} color={C.textPrimary} />
            {unread > 0 && (
              <View style={s.badge}>
                <Text style={s.badgeText}>{unread > 9 ? "9+" : String(unread)}</Text>
              </View>
            )}
          </TouchableOpacity>
          <TouchableOpacity onPress={() => router.push("/(tabs)/perfil")} style={s.avatar} testID="home-profile-button">
            <Text style={s.avatarText}>{(user?.name || "U").substring(0, 1).toUpperCase()}</Text>
          </TouchableOpacity>
        </View>

        {/* Hero balance card */}
        <View style={s.hero}>
          <View style={s.heroTop}>
            <Text style={s.heroLabel}>Saldo na carteira</Text>
            <Ionicons name="shield-checkmark" size={18} color="#D1FAE5" />
          </View>
          <Text style={s.heroValue} testID="home-balance">{fmtBRL(wallet?.balance || 0)}</Text>
          <View style={s.heroRow}>
            <View>
              <Text style={s.heroSmall}>Rendimentos acumulados</Text>
              <Text style={s.heroAccent} testID="home-pending-yield">{fmtBRL(liveYield)}</Text>
            </View>
            <TouchableOpacity style={s.heroBtn} onPress={collect} testID="home-collect-button">
              <Ionicons name="arrow-down-circle" size={18} color={C.primary} />
              <Text style={s.heroBtnText}>Coletar</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Quick actions */}
        <View style={s.actions}>
          <Action icon="add-circle" label="Depositar" onPress={() => router.push("/deposito")} testID="home-deposit" />
          <Action icon="arrow-up-circle" label="Sacar" onPress={() => router.push("/saque")} testID="home-withdraw" />
          <Action icon="bag-handle" label="Loja" onPress={() => router.push("/(tabs)/loja")} testID="home-shop" />
          <Action icon="wallet" label="Carteira" onPress={() => router.push("/(tabs)/carteira")} testID="home-wallet" />
        </View>

        {/* My Lotes */}
        <View style={s.sectionHeader}>
          <Text style={s.sectionTitle}>Meus lotes ativos</Text>
          <TouchableOpacity onPress={() => router.push("/(tabs)/loja")} testID="home-go-shop">
            <Text style={s.sectionLink}>Ver loja</Text>
          </TouchableOpacity>
        </View>

        {mine.length === 0 ? (
          <View style={s.empty}>
            <Ionicons name="cube-outline" size={42} color={C.textMuted} />
            <Text style={s.emptyTitle}>Você ainda não tem lotes</Text>
            <Text style={s.emptySub}>Visite a loja e adquira seu primeiro lote para começar a render.</Text>
            <TouchableOpacity style={s.emptyBtn} onPress={() => router.push("/(tabs)/loja")} testID="home-empty-shop">
              <Text style={s.emptyBtnText}>Ir para a loja</Text>
            </TouchableOpacity>
          </View>
        ) : (
          mine.map((m) => <LoteActiveCard key={m.purchase_id} m={m} />)
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function Action({ icon, label, onPress, testID }: any) {
  return (
    <TouchableOpacity style={s.action} onPress={onPress} testID={testID}>
      <View style={s.actionIcon}><Ionicons name={icon} size={22} color={C.primary} /></View>
      <Text style={s.actionLabel}>{label}</Text>
    </TouchableOpacity>
  );
}

function LoteActiveCard({ m }: { m: MyLote }) {
  const daysDone = Math.floor(m.active_seconds / 86400);
  const daysTotal = Math.round(m.total_seconds / 86400);
  const liveEarned = (() => {
    const started = new Date(m.started_at).getTime();
    const ends = new Date(m.ends_at).getTime();
    const nowMs = Date.now();
    const activeMs = Math.max(0, Math.min(nowMs, ends) - started);
    return (activeMs / 3_600_000) * m.lote.hourly_yield;
  })();

  return (
    <View style={s.card}>
      <View style={{ flexDirection: "row", gap: 12 }}>
        {m.lote.image_url ? (
          <Image source={{ uri: m.lote.image_url }} style={s.cardImg} />
        ) : (
          <View style={[s.cardImg, { backgroundColor: C.primaryLight, alignItems: "center", justifyContent: "center" }]}>
            <Ionicons name="cube" size={28} color={C.primary} />
          </View>
        )}
        <View style={{ flex: 1 }}>
          <Text style={s.cardTitle} numberOfLines={1}>{m.lote.name}</Text>
          <Text style={s.cardSub}>Rende {fmtBRL(m.lote.hourly_yield)}/h</Text>
          <Text style={[s.cardSub, { color: C.primary, fontWeight: "700", marginTop: 2 }]}>
            Ganho: {fmtBRL(liveEarned)}
          </Text>
        </View>
        {m.completed ? (
          <View style={[s.badge, { backgroundColor: C.primaryLight }]}>
            <Text style={[s.badgeText, { color: C.primaryDark }]}>Finalizado</Text>
          </View>
        ) : (
          <View style={s.badge}><Text style={s.badgeText}>{daysDone}/{daysTotal}d</Text></View>
        )}
      </View>
      <View style={s.progressTrack}>
        <View style={[s.progressFill, { width: `${Math.min(100, m.progress_pct)}%` }]} />
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.surface },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 20, paddingTop: 10, paddingBottom: 8 },
  hi: { color: C.textMuted, fontSize: 13 },
  name: { color: C.textPrimary, fontSize: 22, fontWeight: "800", marginTop: 2 },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: C.primary, alignItems: "center", justifyContent: "center" },
  avatarText: { color: "#0A0612", fontWeight: "800" },
  bellBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: C.card, borderWidth: 1, borderColor: C.border, alignItems: "center", justifyContent: "center", marginRight: 10 },
  badge: { position: "absolute", top: 6, right: 6, minWidth: 16, height: 16, borderRadius: 8, backgroundColor: C.danger, alignItems: "center", justifyContent: "center", paddingHorizontal: 3 },
  badgeText: { color: "#fff", fontSize: 9, fontWeight: "800" },

  hero: {
    marginHorizontal: 20, marginTop: 10, backgroundColor: C.primary, borderRadius: 24, padding: 22,
    shadowColor: C.primary, shadowOpacity: 0.35, shadowRadius: 20, shadowOffset: { width: 0, height: 10 }, elevation: 6,
  },
  heroTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  heroLabel: { color: "#D1FAE5", fontSize: 13, fontWeight: "600" },
  heroValue: { color: "#fff", fontSize: 38, fontWeight: "800", marginTop: 8, letterSpacing: -1 },
  heroRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end", marginTop: 16 },
  heroSmall: { color: "#D1FAE5", fontSize: 12 },
  heroAccent: { color: "#fff", fontSize: 18, fontWeight: "700", marginTop: 2 },
  heroBtn: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: C.card, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12 },
  heroBtnText: { color: C.primary, fontWeight: "700" },

  actions: { flexDirection: "row", paddingHorizontal: 20, marginTop: 18, justifyContent: "space-between" },
  action: { alignItems: "center", width: 72 },
  actionIcon: { width: 54, height: 54, borderRadius: 18, backgroundColor: C.primaryLight, alignItems: "center", justifyContent: "center" },
  actionLabel: { marginTop: 6, color: C.textPrimary, fontWeight: "600", fontSize: 12 },

  sectionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 20, marginTop: 28, marginBottom: 10 },
  sectionTitle: { color: C.textPrimary, fontSize: 18, fontWeight: "800" },
  sectionLink: { color: C.primary, fontWeight: "700", fontSize: 13 },

  empty: { alignItems: "center", padding: 30, marginHorizontal: 20, backgroundColor: C.card, borderRadius: 20, borderWidth: 1, borderColor: C.border },
  emptyTitle: { marginTop: 10, fontWeight: "700", fontSize: 15, color: C.textPrimary },
  emptySub: { marginTop: 4, color: C.textSecondary, textAlign: "center", fontSize: 13 },
  emptyBtn: { marginTop: 14, backgroundColor: C.primary, paddingHorizontal: 18, paddingVertical: 10, borderRadius: 12 },
  emptyBtnText: { color: "#fff", fontWeight: "700" },

  card: {
    marginHorizontal: 20, marginBottom: 12, backgroundColor: C.card, borderRadius: 18, padding: 14,
    borderWidth: 1, borderColor: C.border,
  },
  cardImg: { width: 64, height: 64, borderRadius: 14, backgroundColor: C.surfaceAlt },
  cardTitle: { color: C.textPrimary, fontWeight: "700", fontSize: 15 },
  cardSub: { color: C.textSecondary, fontSize: 12, marginTop: 2 },
  badge: { backgroundColor: C.surfaceAlt, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10, alignSelf: "flex-start" },
  badgeText: { fontSize: 11, fontWeight: "700", color: C.textSecondary },
  progressTrack: { marginTop: 12, height: 6, backgroundColor: C.surfaceAlt, borderRadius: 3, overflow: "hidden" },
  progressFill: { height: "100%", backgroundColor: C.primary },
});
