import React, { useCallback, useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl, ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import { api, fmtBRL } from "../../src/api";
import { C } from "../../src/theme";

type Tx = { id: string; type: string; amount: number; description: string; created_at: string };
type W = { balance: number; pending_yield: number; pending_deposits: number; pending_withdrawals: number };

const typeIcon: Record<string, any> = {
  deposit: "arrow-down-circle",
  withdraw: "arrow-up-circle",
  withdraw_request: "time",
  withdraw_refund: "return-up-back",
  purchase: "cart",
  yield: "trending-up",
};

export default function Carteira() {
  const router = useRouter();
  const [w, setW] = useState<W | null>(null);
  const [txs, setTxs] = useState<Tx[]>([]);
  const [loading, setLoading] = useState(true);
  const [refresh, setRefresh] = useState(false);

  const load = useCallback(async () => {
    try {
      const [a, b] = await Promise.all([api.get("/wallet"), api.get("/transactions")]);
      setW(a.data);
      setTxs(b.data);
    } catch {}
  }, []);

  useFocusEffect(useCallback(() => {
    setLoading(true);
    load().finally(() => setLoading(false));
  }, [load]));

  const onRefresh = async () => { setRefresh(true); await load(); setRefresh(false); };

  const collect = async () => {
    try { await api.post("/me/collect"); await load(); } catch {}
  };

  if (loading) return <SafeAreaView style={s.safe}><View style={s.center}><ActivityIndicator size="large" color={C.primary} /></View></SafeAreaView>;

  return (
    <SafeAreaView style={s.safe} edges={["top"]}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={refresh} onRefresh={onRefresh} tintColor={C.primary} />}
      >
        <View style={s.header}>
          <Text style={s.h1}>Carteira</Text>
          <Text style={s.sub}>Gerencie seu saldo e histórico</Text>
        </View>

        <View style={s.balanceCard}>
          <Text style={s.balanceLabel}>Saldo disponível</Text>
          <Text style={s.balanceValue} testID="wallet-balance">{fmtBRL(w?.balance || 0)}</Text>
          <View style={s.divider} />
          <View style={s.row}>
            <View style={{ flex: 1 }}>
              <Text style={s.smallLabel}>A receber</Text>
              <Text style={s.smallValue}>{fmtBRL(w?.pending_yield || 0)}</Text>
            </View>
            <TouchableOpacity style={s.collectBtn} onPress={collect} testID="wallet-collect">
              <Ionicons name="download" size={16} color="#fff" />
              <Text style={s.collectBtnText}>Coletar</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={s.actions}>
          <TouchableOpacity style={[s.actionBtn, { backgroundColor: C.primary }]} onPress={() => router.push("/deposito")} testID="wallet-deposit">
            <Ionicons name="add-circle-outline" size={18} color="#fff" />
            <Text style={[s.actionText, { color: "#fff" }]}>Depositar</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[s.actionBtn, { backgroundColor: C.surfaceAlt }]} onPress={() => router.push("/saque")} testID="wallet-withdraw">
            <Ionicons name="arrow-up-circle-outline" size={18} color={C.textPrimary} />
            <Text style={[s.actionText, { color: C.textPrimary }]}>Sacar</Text>
          </TouchableOpacity>
        </View>

        {((w?.pending_deposits || 0) > 0 || (w?.pending_withdrawals || 0) > 0) && (
          <View style={s.pending}>
            <Ionicons name="time-outline" size={18} color={C.pending} />
            <Text style={s.pendingText}>
              {(w?.pending_deposits || 0) > 0 && `${w!.pending_deposits} depósito(s) em análise. `}
              {(w?.pending_withdrawals || 0) > 0 && `${w!.pending_withdrawals} saque(s) em análise.`}
            </Text>
          </View>
        )}

        <Text style={s.sectionTitle}>Histórico de transações</Text>
        {txs.length === 0 ? (
          <View style={s.empty}>
            <Text style={s.emptyText}>Nenhuma transação ainda.</Text>
          </View>
        ) : (
          txs.map((t) => (
            <View key={t.id} style={s.tx}>
              <View style={[s.txIcon, { backgroundColor: t.amount >= 0 ? C.primaryLight : "#FEE2E2" }]}>
                <Ionicons name={typeIcon[t.type] || "ellipse"} size={18} color={t.amount >= 0 ? C.primaryDark : C.danger} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.txDesc} numberOfLines={1}>{t.description}</Text>
                <Text style={s.txDate}>{new Date(t.created_at).toLocaleString("pt-BR")}</Text>
              </View>
              <Text style={[s.txAmount, { color: t.amount >= 0 ? C.primary : C.danger }]}>
                {t.amount >= 0 ? "+" : ""}{fmtBRL(t.amount)}
              </Text>
            </View>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.surface },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  header: { paddingHorizontal: 20, paddingTop: 14 },
  h1: { color: C.textPrimary, fontSize: 24, fontWeight: "800" },
  sub: { color: C.textSecondary, marginTop: 2 },

  balanceCard: {
    marginHorizontal: 20, marginTop: 14, backgroundColor: "#fff", borderRadius: 20, padding: 22,
    borderWidth: 1, borderColor: C.border,
    shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 14, shadowOffset: { width: 0, height: 4 },
  },
  balanceLabel: { color: C.textSecondary, fontSize: 13 },
  balanceValue: { color: C.textPrimary, fontSize: 34, fontWeight: "800", marginTop: 6, letterSpacing: -0.8 },
  divider: { height: 1, backgroundColor: C.border, marginVertical: 14 },
  row: { flexDirection: "row", alignItems: "center" },
  smallLabel: { color: C.textMuted, fontSize: 12 },
  smallValue: { color: C.textPrimary, fontSize: 18, fontWeight: "700", marginTop: 2 },
  collectBtn: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: C.primary, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12 },
  collectBtnText: { color: "#fff", fontWeight: "700" },

  actions: { flexDirection: "row", gap: 10, paddingHorizontal: 20, marginTop: 16 },
  actionBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 14, borderRadius: 14 },
  actionText: { fontWeight: "700" },

  pending: {
    marginHorizontal: 20, marginTop: 14, padding: 12, borderRadius: 12, backgroundColor: "#FFFBEB",
    borderWidth: 1, borderColor: "#FDE68A", flexDirection: "row", gap: 8, alignItems: "center",
  },
  pendingText: { color: "#92400E", fontSize: 12, flex: 1 },

  sectionTitle: { color: C.textPrimary, fontSize: 16, fontWeight: "800", paddingHorizontal: 20, marginTop: 24, marginBottom: 8 },
  empty: { alignItems: "center", padding: 30 },
  emptyText: { color: C.textMuted },

  tx: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 20, paddingVertical: 12 },
  txIcon: { width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  txDesc: { color: C.textPrimary, fontWeight: "600" },
  txDate: { color: C.textMuted, fontSize: 11, marginTop: 2 },
  txAmount: { fontWeight: "800" },
});
