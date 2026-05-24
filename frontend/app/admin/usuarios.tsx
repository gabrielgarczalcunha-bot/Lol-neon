import React, { useCallback, useState } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Modal, TextInput, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter, useFocusEffect } from "expo-router";
import { api, fmtBRL, formatApiError } from "../../src/api";
import { C } from "../../src/theme";

type U = { id: string; name: string; email: string; role: string; balance: number; created_at: string; banned?: boolean; banned_reason?: string };

export default function AdminUsers() {
  const router = useRouter();
  const [items, setItems] = useState<U[]>([]);
  const [loading, setLoading] = useState(true);
  const [banFor, setBanFor] = useState<U | null>(null);
  const [banReason, setBanReason] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/admin/users");
      setItems(data);
    } finally { setLoading(false); }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const submitBan = async () => {
    if (!banFor) return;
    try {
      await api.post(`/admin/users/${banFor.id}/ban`, { reason: banReason });
      setBanFor(null); setBanReason("");
      await load();
    } catch (e: any) {
      Alert.alert("Erro", formatApiError(e));
    }
  };

  const unban = async (u: U) => {
    try {
      await api.post(`/admin/users/${u.id}/unban`);
      await load();
    } catch (e: any) {
      Alert.alert("Erro", formatApiError(e));
    }
  };

  return (
    <SafeAreaView style={s.safe} edges={["top"]}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.back} testID="admin-users-back">
          <Ionicons name="chevron-back" size={22} color={C.textPrimary} />
        </TouchableOpacity>
        <Text style={s.h1}>Usuários ({items.length})</Text>
        <View style={{ width: 36 }} />
      </View>

      {loading ? <View style={s.center}><ActivityIndicator color={C.primary} /></View> : (
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
          {items.map((u) => (
            <View key={u.id} style={[s.card, u.banned && { borderColor: C.danger, opacity: 0.85 }]}>
              <View style={s.row}>
                <View style={s.avatar}><Text style={s.avatarText}>{(u.name || "U").substring(0, 1).toUpperCase()}</Text></View>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                    <Text style={s.name}>{u.name}</Text>
                    {u.role === "admin" && <View style={s.role}><Text style={s.roleText}>ADMIN</Text></View>}
                    {u.banned && <View style={s.banned}><Text style={s.bannedText}>BLOQUEADO</Text></View>}
                  </View>
                  <Text style={s.email}>{u.email}</Text>
                  <Text style={s.date}>Cadastro: {new Date(u.created_at).toLocaleDateString("pt-BR")}</Text>
                  {u.banned && u.banned_reason ? (
                    <Text style={s.banReason}>Motivo: {u.banned_reason}</Text>
                  ) : null}
                </View>
                <Text style={s.balance}>{fmtBRL(u.balance)}</Text>
              </View>

              {u.role !== "admin" && (
                <View style={{ marginTop: 10, flexDirection: "row", justifyContent: "flex-end" }}>
                  {u.banned ? (
                    <TouchableOpacity style={[s.actBtn, { backgroundColor: C.primary }]} onPress={() => unban(u)} testID={`unban-${u.id}`}>
                      <Ionicons name="checkmark-circle" size={14} color="#0A0612" />
                      <Text style={[s.actText, { color: "#0A0612" }]}>Desbloquear</Text>
                    </TouchableOpacity>
                  ) : (
                    <TouchableOpacity style={[s.actBtn, { backgroundColor: C.danger }]} onPress={() => { setBanFor(u); setBanReason(""); }} testID={`ban-${u.id}`}>
                      <Ionicons name="ban" size={14} color="#fff" />
                      <Text style={s.actText}>Bloquear</Text>
                    </TouchableOpacity>
                  )}
                </View>
              )}
            </View>
          ))}
        </ScrollView>
      )}

      <Modal visible={!!banFor} transparent animationType="fade" onRequestClose={() => setBanFor(null)}>
        <View style={s.modalBg}>
          <View style={s.modalCard}>
            <Text style={s.modalTitle}>Bloquear {banFor?.name}?</Text>
            <Text style={s.modalDesc}>O usuário não poderá mais acessar a conta. Esta mensagem é exibida ao tentar entrar.</Text>
            <TextInput
              testID="ban-reason-input"
              style={s.modalInput}
              placeholder="Motivo do bloqueio (opcional)"
              placeholderTextColor={C.textMuted}
              value={banReason}
              onChangeText={setBanReason}
              multiline
              maxLength={400}
            />
            <View style={s.modalActions}>
              <TouchableOpacity style={[s.modalBtn, { backgroundColor: C.surfaceAlt }]} onPress={() => setBanFor(null)} testID="ban-cancel">
                <Text style={{ color: C.textPrimary, fontWeight: "700" }}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.modalBtn, { backgroundColor: C.danger }]} onPress={submitBan} testID="ban-confirm">
                <Text style={{ color: "#fff", fontWeight: "800" }}>Bloquear</Text>
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
  card: { backgroundColor: C.card, padding: 14, borderRadius: 14, borderWidth: 1, borderColor: C.border, marginBottom: 10 },
  row: { flexDirection: "row", alignItems: "center", gap: 12 },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: C.primary, alignItems: "center", justifyContent: "center" },
  avatarText: { color: "#0A0612", fontWeight: "800" },
  name: { fontWeight: "800", color: C.textPrimary },
  email: { color: C.textMuted, fontSize: 12, marginTop: 2 },
  date: { color: C.textMuted, fontSize: 11, marginTop: 2 },
  balance: { color: C.primary, fontWeight: "800", fontSize: 15 },
  role: { backgroundColor: C.primary, paddingHorizontal: 6, paddingVertical: 1, borderRadius: 4 },
  roleText: { color: "#0A0612", fontSize: 9, fontWeight: "800" },
  banned: { backgroundColor: C.danger, paddingHorizontal: 6, paddingVertical: 1, borderRadius: 4 },
  bannedText: { color: "#fff", fontSize: 9, fontWeight: "800" },
  banReason: { color: C.danger, fontSize: 11, marginTop: 4, fontStyle: "italic" },
  actBtn: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8 },
  actText: { color: "#fff", fontWeight: "700", fontSize: 12 },
  modalBg: { flex: 1, backgroundColor: "rgba(0,0,0,0.7)", alignItems: "center", justifyContent: "center", padding: 24 },
  modalCard: { backgroundColor: C.card, borderRadius: 18, padding: 22, width: "100%", maxWidth: 420, borderWidth: 1, borderColor: C.border },
  modalTitle: { color: C.textPrimary, fontSize: 18, fontWeight: "800" },
  modalDesc: { color: C.textSecondary, marginTop: 6, fontSize: 13 },
  modalInput: { marginTop: 12, backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, borderRadius: 10, padding: 12, minHeight: 80, textAlignVertical: "top", color: C.textPrimary },
  modalActions: { flexDirection: "row", gap: 10, marginTop: 16 },
  modalBtn: { flex: 1, paddingVertical: 13, borderRadius: 10, alignItems: "center" },
});
