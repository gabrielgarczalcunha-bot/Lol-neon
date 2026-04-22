import React, { useCallback, useState } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, ActivityIndicator, Image, Modal } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter, useFocusEffect } from "expo-router";
import { api, fmtBRL, formatApiError } from "../../src/api";
import { C } from "../../src/theme";

type Dep = { id: string; user_name: string; user_email: string; amount: number; status: string; created_at: string; proof_image?: string };

export default function AdminDeposits() {
  const router = useRouter();
  const [filter, setFilter] = useState<"pending" | "approved" | "rejected">("pending");
  const [items, setItems] = useState<Dep[]>([]);
  const [loading, setLoading] = useState(true);
  const [preview, setPreview] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/admin/deposits", { params: { status: filter } });
      setItems(data);
    } finally { setLoading(false); }
  }, [filter]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const act = async (id: string, action: "approve" | "reject") => {
    try {
      await api.post(`/admin/deposits/${id}/${action}`);
      await load();
    } catch (e: any) {
      Alert.alert("Erro", formatApiError(e));
    }
  };

  return (
    <SafeAreaView style={s.safe} edges={["top"]}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.back} testID="admin-dep-back">
          <Ionicons name="chevron-back" size={22} color={C.textPrimary} />
        </TouchableOpacity>
        <Text style={s.h1}>Depósitos</Text>
        <View style={{ width: 36 }} />
      </View>

      <View style={s.tabs}>
        {(["pending", "approved", "rejected"] as const).map((f) => (
          <TouchableOpacity key={f} style={[s.tab, filter === f && s.tabActive]} onPress={() => setFilter(f)} testID={`dep-filter-${f}`}>
            <Text style={[s.tabText, filter === f && s.tabTextActive]}>
              {f === "pending" ? "Pendentes" : f === "approved" ? "Aprovados" : "Rejeitados"}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? <View style={s.center}><ActivityIndicator color={C.primary} /></View> : (
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
          {items.length === 0 ? (
            <View style={s.empty}><Text style={{ color: C.textMuted }}>Nenhum depósito {filter === "pending" ? "pendente" : filter === "approved" ? "aprovado" : "rejeitado"}.</Text></View>
          ) : items.map((d) => (
            <View key={d.id} style={s.card}>
              <View style={{ flex: 1 }}>
                <Text style={s.name}>{d.user_name}</Text>
                <Text style={s.email}>{d.user_email}</Text>
                <Text style={s.date}>{new Date(d.created_at).toLocaleString("pt-BR")}</Text>
              </View>
              <View style={{ alignItems: "flex-end" }}>
                <Text style={s.amount}>{fmtBRL(d.amount)}</Text>
                {filter === "pending" ? (
                  <View style={s.actions}>
                    <TouchableOpacity style={[s.actBtn, { backgroundColor: C.primary }]} onPress={() => act(d.id, "approve")} testID={`approve-${d.id}`}>
                      <Ionicons name="checkmark" size={14} color="#fff" />
                      <Text style={s.actText}>Aprovar</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[s.actBtn, { backgroundColor: C.danger }]} onPress={() => act(d.id, "reject")} testID={`reject-${d.id}`}>
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
  name: { fontWeight: "800", color: C.textPrimary },
  email: { color: C.textMuted, fontSize: 12, marginTop: 2 },
  date: { color: C.textMuted, fontSize: 11, marginTop: 2 },
  amount: { fontWeight: "800", fontSize: 18, color: C.primary },
  actions: { flexDirection: "row", gap: 8, marginTop: 10 },
  actBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 4, paddingVertical: 10, borderRadius: 10 },
  actText: { color: "#fff", fontWeight: "700", fontSize: 12 },
  status: { fontSize: 12, fontWeight: "700", marginTop: 10, textAlign: "right" },
  empty: { padding: 30, alignItems: "center" },
  proofBtn: { marginTop: 10, borderRadius: 12, overflow: "hidden", position: "relative" },
  proofImg: { width: "100%", height: 160, backgroundColor: C.surfaceAlt },
  proofOverlay: { position: "absolute", bottom: 8, right: 8, flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "rgba(0,0,0,0.65)", paddingHorizontal: 10, paddingVertical: 6, borderRadius: 20 },
  proofText: { color: "#fff", fontSize: 11, fontWeight: "700" },
  noProof: { marginTop: 10, flexDirection: "row", alignItems: "center", gap: 6, padding: 10, backgroundColor: "#FFFBEB", borderRadius: 8, borderWidth: 1, borderColor: "#FDE68A" },
  noProofText: { color: "#92400E", fontSize: 11, fontWeight: "600" },
  modal: { flex: 1, backgroundColor: "rgba(0,0,0,0.95)", alignItems: "center", justifyContent: "center" },
  modalImg: { width: "100%", height: "85%" },
  modalClose: { position: "absolute", top: 50, right: 20, zIndex: 10, width: 44, height: 44, borderRadius: 22, backgroundColor: "rgba(255,255,255,0.15)", alignItems: "center", justifyContent: "center" },
});
