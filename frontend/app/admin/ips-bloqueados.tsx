import React, { useCallback, useState } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Alert, TextInput } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter, useFocusEffect } from "expo-router";
import { api, formatApiError } from "../../src/api";
import { C } from "../../src/theme";

type BannedIP = {
  ip: string; user_id?: string; user_email?: string; user_name?: string;
  reason?: string; banned_at?: string; banned_by_admin?: string;
};

export default function IPsBloqueados() {
  const router = useRouter();
  const [items, setItems] = useState<BannedIP[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/admin/banned-ips");
      setItems(data);
    } catch (e: any) {
      Alert.alert("Erro", formatApiError(e));
    } finally { setLoading(false); }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const unbanIP = async (ip: string) => {
    try {
      await api.delete(`/admin/banned-ips/${encodeURIComponent(ip)}`);
      await load();
    } catch (e: any) {
      Alert.alert("Erro", formatApiError(e));
    }
  };

  const formatDate = (iso?: string) => {
    if (!iso) return "—";
    try { return new Date(iso).toLocaleString("pt-BR"); } catch { return iso; }
  };

  const filtered = items.filter(i => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      (i.ip || "").includes(q) ||
      (i.user_email || "").toLowerCase().includes(q) ||
      (i.user_name || "").toLowerCase().includes(q)
    );
  });

  return (
    <SafeAreaView style={s.safe} edges={["top"]}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.back} testID="banned-ips-back">
          <Ionicons name="chevron-back" size={22} color={C.textPrimary} />
        </TouchableOpacity>
        <Text style={s.h1}>IPs Bloqueados ({items.length})</Text>
        <View style={{ width: 36 }} />
      </View>

      <View style={s.searchBox}>
        <Ionicons name="search" size={16} color={C.textMuted} />
        <TextInput
          style={s.searchInput}
          placeholder="Buscar IP, email ou nome…"
          placeholderTextColor={C.textMuted}
          value={search}
          onChangeText={setSearch}
        />
      </View>

      {loading ? <View style={s.center}><ActivityIndicator color={C.primary} /></View> : (
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
          {filtered.length === 0 ? (
            <View style={s.empty}>
              <Ionicons name="shield-checkmark-outline" size={42} color={C.textMuted} />
              <Text style={s.emptyTitle}>Nenhum IP bloqueado</Text>
              <Text style={s.emptyDesc}>Ao bloquear um usuário todos os IPs usados por ele aparecerão aqui.</Text>
            </View>
          ) : filtered.map((i) => (
            <View key={i.ip} style={s.card}>
              <View style={s.topRow}>
                <View style={{ flex: 1 }}>
                  <Text style={s.ip} selectable>{i.ip}</Text>
                  {i.user_name ? (
                    <Text style={s.user}>
                      {i.user_name} <Text style={{ color: C.textMuted }}>• {i.user_email}</Text>
                    </Text>
                  ) : null}
                  {i.reason ? <Text style={s.reason}>Motivo: {i.reason}</Text> : null}
                  <Text style={s.date}>Bloqueado em: {formatDate(i.banned_at)}</Text>
                  {i.banned_by_admin ? <Text style={s.admin}>Por: {i.banned_by_admin}</Text> : null}
                </View>
              </View>
              <TouchableOpacity style={s.unbanBtn} onPress={() => unbanIP(i.ip)} testID={`unban-ip-${i.ip}`}>
                <Ionicons name="lock-open" size={14} color="#0A0612" />
                <Text style={s.unbanText}>Desbloquear este IP</Text>
              </TouchableOpacity>
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
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: C.border, backgroundColor: C.card },
  back: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  h1: { color: C.textPrimary, fontSize: 17, fontWeight: "800" },

  searchBox: { flexDirection: "row", alignItems: "center", gap: 8, marginHorizontal: 16, marginTop: 12, backgroundColor: C.card, borderRadius: 12, paddingHorizontal: 12, borderWidth: 1, borderColor: C.border },
  searchInput: { flex: 1, paddingVertical: 10, color: C.textPrimary, fontSize: 13 },

  empty: { alignItems: "center", padding: 40, gap: 6 },
  emptyTitle: { color: C.textPrimary, fontWeight: "800", marginTop: 8 },
  emptyDesc: { color: C.textMuted, textAlign: "center", fontSize: 12, lineHeight: 18 },

  card: { backgroundColor: C.card, padding: 14, borderRadius: 14, borderWidth: 1, borderColor: C.danger, marginBottom: 10 },
  topRow: { flexDirection: "row" },
  ip: { color: C.textPrimary, fontWeight: "800", fontSize: 16, fontFamily: "monospace" },
  user: { color: C.textPrimary, fontSize: 13, marginTop: 4 },
  reason: { color: C.danger, fontSize: 12, marginTop: 4, fontStyle: "italic" },
  date: { color: C.textMuted, fontSize: 11, marginTop: 4 },
  admin: { color: C.textMuted, fontSize: 11 },
  unbanBtn: { marginTop: 12, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 10, borderRadius: 10, backgroundColor: C.primary },
  unbanText: { color: "#0A0612", fontWeight: "800", fontSize: 13 },
});
