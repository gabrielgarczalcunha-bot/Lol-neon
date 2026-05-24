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
  const [rejectFor, setRejectFor] = useState<Dep | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/admin/deposits", { params: { status: filter } });
      setItems(data);
    } finally { setLoading(false); }
  }, [filter]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const act = async (id: string, action: "approve" | "reject", reason?: string) => {
    try {
      await api.post(`/admin/deposits/${id}/${action}`, action === "reject" ? { reason: reason || "" } : undefined);
      await load();
    } catch (e: any) {
      Alert.alert("Erro", formatApiError(e));
    }
  };

  const submitReject = async () => {
    if (!rejectFor) return;
    await act(rejectFor.id, "reject", rejectReason);
    setRejectFor(null);
    setRejectReason("");
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
              <View style={s.cardTop}>
                <View style={{ flex: 1 }}>
                  <Text style={s.name}>{d.user_name}</Text>
                  <Text style={s.email}>{d.user_email}</Text>
                  <Text style={s.date}>{new Date(d.created_at).toLocaleString("pt-BR")}</Text>
                </View>
                <Text style={s.amount}>{fmtBRL(d.amount)}</Text>
              </View>

              {d.proof_image ? (
                <TouchableOpacity
                  onPress={() => setPreview(d.proof_image!)}
                  style={s.proofBtn}
                  testID={`view-proof-${d.id}`}
                  activeOpacity={0.85}
                >
                  <Image source={{ uri: d.proof_image }} style={s.proofImg} resizeMode="cover" />
                  <View style={s.proofOverlay}>
                    <Ionicons name="expand-outline" size={18} color="#fff" />
                    <Text style={s.proofText}>Ver comprovante</Text>
                  </View>
                </TouchableOpacity>
              ) : (
                <View style={s.noProof}>
                  <Ionicons name="alert-circle-outline" size={14} color="#92400E" />
                  <Text style={s.noProofText}>Sem comprovante anexado</Text>
                </View>
              )}

              {filter === "pending" ? (
                <View style={s.actions}>
                  <TouchableOpacity style={[s.actBtn, { backgroundColor: C.primary }]} onPress={() => act(d.id, "approve")} testID={`approve-${d.id}`}>
                    <Ionicons name="checkmark" size={14} color="#fff" />
                    <Text style={s.actText}>Aprovar</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[s.actBtn, { backgroundColor: C.danger }]} onPress={() => { setRejectFor(d); setRejectReason(""); }} testID={`reject-${d.id}`}>
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

      <Modal visible={!!preview} transparent animationType="fade" onRequestClose={() => setPreview(null)}>
        <View style={s.modal}>
          <TouchableOpacity style={s.modalClose} onPress={() => setPreview(null)} testID="proof-close">
            <Ionicons name="close" size={28} color="#fff" />
          </TouchableOpacity>
          {preview ? <Image source={{ uri: preview }} style={s.modalImg} resizeMode="contain" /> : null}
        </View>
      </Modal>

      <Modal visible={!!rejectFor} transparent animationType="fade" onRequestClose={() => setRejectFor(null)}>
        <View style={s.rejectBg}>
          <View style={s.rejectCard}>
            <Text style={s.rejectTitle}>Rejeitar depósito</Text>
            <Text style={s.rejectDesc}>Esta mensagem será exibida ao usuário no histórico:</Text>
            <TextInput
              testID="reject-reason-input"
              style={s.rejectInput}
              placeholder="Ex: Comprovante inválido / valor não confere"
              placeholderTextColor={C.textMuted}
              value={rejectReason}
              onChangeText={setRejectReason}
              multiline
              maxLength={400}
            />
            <View style={s.rejectActions}>
              <TouchableOpacity style={[s.rejBtn, { backgroundColor: C.surfaceAlt }]} onPress={() => setRejectFor(null)} testID="reject-cancel">
                <Text style={{ color: C.textPrimary, fontWeight: "700" }}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.rejBtn, { backgroundColor: C.danger }]} onPress={submitReject} testID="reject-confirm">
                <Text style={{ color: "#fff", fontWeight: "800" }}>Rejeitar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.surface },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: C.border, backgroundColor: C.card },
  back: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  h1: { color: C.textPrimary, fontSize: 17, fontWeight: "800" },
  tabs: { flexDirection: "row", padding: 12, gap: 8, backgroundColor: C.card, borderBottomWidth: 1, borderBottomColor: C.border },
  tab: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: C.surfaceAlt },
  tabActive: { backgroundColor: C.primary },
  tabText: { color: C.textSecondary, fontWeight: "700", fontSize: 12 },
  tabTextActive: { color: "#fff" },
  card: { backgroundColor: C.card, padding: 14, borderRadius: 14, borderWidth: 1, borderColor: C.border, marginBottom: 10 },
  cardTop: { flexDirection: "row", alignItems: "center" },
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
  proofImg: { width: "100%", height: 180, backgroundColor: C.surfaceAlt },
  proofOverlay: { position: "absolute", bottom: 8, right: 8, flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "rgba(0,0,0,0.65)", paddingHorizontal: 10, paddingVertical: 6, borderRadius: 20 },
  proofText: { color: "#fff", fontSize: 11, fontWeight: "700" },
  noProof: { marginTop: 10, flexDirection: "row", alignItems: "center", gap: 6, padding: 10, backgroundColor: "#FFFBEB", borderRadius: 8, borderWidth: 1, borderColor: "#FDE68A" },
  noProofText: { color: "#92400E", fontSize: 11, fontWeight: "600" },
  modal: { flex: 1, backgroundColor: "rgba(0,0,0,0.95)", alignItems: "center", justifyContent: "center" },
  modalImg: { width: "100%", height: "85%" },
  modalClose: { position: "absolute", top: 50, right: 20, zIndex: 10, width: 44, height: 44, borderRadius: 22, backgroundColor: "rgba(255,255,255,0.15)", alignItems: "center", justifyContent: "center" },
  rejectBg: { flex: 1, backgroundColor: "rgba(0,0,0,0.7)", alignItems: "center", justifyContent: "center", padding: 24 },
  rejectCard: { backgroundColor: C.card, borderRadius: 18, padding: 22, width: "100%", maxWidth: 420, borderWidth: 1, borderColor: C.border },
  rejectTitle: { color: C.textPrimary, fontSize: 18, fontWeight: "800" },
  rejectDesc: { color: C.textSecondary, marginTop: 6, fontSize: 13 },
  rejectInput: { marginTop: 12, backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, borderRadius: 10, padding: 12, minHeight: 90, textAlignVertical: "top", color: C.textPrimary },
  rejectActions: { flexDirection: "row", gap: 10, marginTop: 16 },
  rejBtn: { flex: 1, paddingVertical: 13, borderRadius: 10, alignItems: "center" },
});
