import React, { useCallback, useState } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter, useFocusEffect } from "expo-router";
import { api, fmtBRL, formatApiError } from "../../src/api";
import { C } from "../../src/theme";

type W = { id: string; user_name: string; user_email: string; amount: number; status: string; created_at: string; pix_key: string; pix_key_type: string };

export default function AdminWithdrawals() {
  const router = useRouter();
  const [filter, setFilter] = useState<"pending" | "approved" | "rejected">("pending");
  const [items, setItems] = useState<W[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/admin/withdrawals", { params: { status: filter } });
      setItems(data);
    } finally { setLoading(false); }
  }, [filter]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const act = async (id: string, action: "approve" | "reject") => {
    try {
      await api.post(`/admin/withdrawals/${id}/${action}`);
      await load();
    } catch (e: any) {
      Alert.alert("Erro", formatApiError(e));
    }
  };

  return (
    <SafeAreaView style={s.safe} edges={["top"]}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.back} testID="admin-wd-back">
          <Ionicons name="chevron-back" size={22} color={C.textPrimary} />
        </TouchableOpacity>
        <Text style={s.h1}>Saques</Text>
        <View style={{ width: 36 }} />
      </View>

      <View style={s.tabs}>
        {(["pending", "approved", "rejected"] as const).map((f) => (
          <TouchableOpacity key={f} style={[s.tab, filter === f && s.tabActive]} onPress={() => setFilter(f)} testID={`wd-filter-${f}`}>
            <Text style={[s.tabText, filter === f && s.tabTextActive]}>
              {f === "pending" ? "Pendentes" : f === "approved" ? "Aprovados" : "Rejeitados"}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? <View style={s.center}><ActivityIndicator color={C.primary} /></View> : (
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
          {items.length === 0 ? (
            <View style={s.empty}><Text style={{ color: C.textMuted }}>Nenhum saque {filter}.</Text></View>
          ) : items.map((d) => (
            <View key={d.id} style={s.card}>
              <View style={s.cardTop}>
                <View style={{ flex: 1 }}>
                  <Text style={s.name}>{d.user_name}</Text>
                  <Text style={s.email}>{d.user_email}</Text>
                  <Text style={s.date}>{new Date(d.created_at).toLocaleString("pt-BR")}</Text>
                </View>
                <Text style={s.amount}>{fmtBRL(d.amount)}</Text>
              </View>
              <View style={s.pixBox}>
                <Text style={s.pixLabel}>Chave PIX ({d.pix_key_type})</Text>
                <Text style={s.pixValue} selectable>{d.pix_key}</Text>
              </View>
              {filter === "pending" ? (
                <View style={s.actions}>
                  <TouchableOpacity style={[s.actBtn, { backgroundColor: C.primary }]} onPress={() => act(d.id, "approve")} testID={`wd-approve-${d.id}`}>
                    <Ionicons name="checkmark" size={14} color="#fff" />
                    <Text style={s.actText}>Aprovar</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[s.actBtn, { backgroundColor: C.danger }]} onPress={() => act(d.id, "reject")} testID={`wd-reject-${d.id}`}>
                    <Ionicons name="close" size={14} color="#fff" />
                    <Text style={s.actText}>Rejeitar</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <Text style={[s.status, { color: d.status === "approved" ? C.primary : C.danger }]}>
                  {d.status === "approved" ? "Aprovado" : "Rejeitado"}
                </Text>
              )}
            </View>
          ))}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.surface },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: C.border, backgroundColor: "#fff" },
  back: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  h1: { color: C.textPrimary, fontSize: 17, fontWeight: "800" },
  tabs: { flexDirection: "row", padding: 12, gap: 8, backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: C.border },
  tab: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: C.surfaceAlt },
  tabActive: { backgroundColor: C.primary },
  tabText: { color: C.textSecondary, fontWeight: "700", fontSize: 12 },
  tabTextActive: { color: "#fff" },
  card: { backgroundColor: "#fff", padding: 14, borderRadius: 14, borderWidth: 1, borderColor: C.border, marginBottom: 10 },
  cardTop: { flexDirection: "row", alignItems: "center" },
  name: { fontWeight: "800", color: C.textPrimary },
  email: { color: C.textMuted, fontSize: 12, marginTop: 2 },
  date: { color: C.textMuted, fontSize: 11, marginTop: 2 },
  amount: { fontWeight: "800", fontSize: 18, color: C.danger },
  pixBox: { marginTop: 10, backgroundColor: C.surface, borderRadius: 10, padding: 10 },
  pixLabel: { color: C.textMuted, fontSize: 11 },
  pixValue: { color: C.textPrimary, fontWeight: "700", marginTop: 2, fontSize: 13 },
  actions: { flexDirection: "row", gap: 8, marginTop: 10 },
  actBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 10, borderRadius: 10 },
  actText: { color: "#fff", fontWeight: "700" },
  status: { fontSize: 12, fontWeight: "700", marginTop: 10, textAlign: "right" },
  empty: { padding: 30, alignItems: "center" },
});
