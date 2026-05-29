import React, { useCallback, useState } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Modal, TextInput, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter, useFocusEffect } from "expo-router";
import { api, fmtBRL, formatApiError } from "../../src/api";
import { C } from "../../src/theme";

type U = {
  id: string; name: string; email: string; role: string; balance: number; created_at: string;
  banned?: boolean; banned_reason?: string;
  last_ip?: string; last_ip_city?: string; last_ip_region?: string; last_ip_country?: string;
  last_ip_country_code?: string; last_ip_isp?: string; last_login_at?: string;
  register_ip?: string;
};

type IPLog = {
  id: string; ip: string; action: string; city?: string; region?: string;
  country?: string; country_code?: string; isp?: string; created_at: string; banned?: boolean;
};

export default function AdminUsers() {
  const router = useRouter();
  const [items, setItems] = useState<U[]>([]);
  const [loading, setLoading] = useState(true);
  const [banFor, setBanFor] = useState<U | null>(null);
  const [banReason, setBanReason] = useState("");
  const [ipsFor, setIpsFor] = useState<U | null>(null);
  const [ipLogs, setIpLogs] = useState<IPLog[]>([]);
  const [ipsLoading, setIpsLoading] = useState(false);
  const [search, setSearch] = useState("");

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
      const { data } = await api.post(`/admin/users/${banFor.id}/ban`, { reason: banReason });
      setBanFor(null); setBanReason("");
      await load();
      const count = data?.ip_count || 0;
      Alert.alert("Usuário bloqueado", count > 0
        ? `Conta bloqueada. ${count} IP${count > 1 ? "s" : ""} associado${count > 1 ? "s" : ""} também ficaram bloqueado${count > 1 ? "s" : ""}.`
        : "Conta bloqueada com sucesso.");
    } catch (e: any) {
      Alert.alert("Erro", formatApiError(e));
    }
  };

  const unban = async (u: U) => {
    try {
      const { data } = await api.post(`/admin/users/${u.id}/unban`);
      await load();
      const ipsUnbanned = data?.ips_unbanned || 0;
      Alert.alert("Usuário desbloqueado", ipsUnbanned > 0
        ? `Conta liberada e ${ipsUnbanned} IP${ipsUnbanned > 1 ? "s foram" : " foi"} desbloqueado${ipsUnbanned > 1 ? "s" : ""}.`
        : "Conta liberada.");
    } catch (e: any) {
      Alert.alert("Erro", formatApiError(e));
    }
  };

  const openIPs = async (u: U) => {
    setIpsFor(u);
    setIpsLoading(true);
    setIpLogs([]);
    try {
      const { data } = await api.get(`/admin/users/${u.id}/ips`);
      setIpLogs(data.logs || []);
    } catch (e: any) {
      Alert.alert("Erro", formatApiError(e));
      setIpsFor(null);
    } finally {
      setIpsLoading(false);
    }
  };

  const flagEmoji = (cc?: string) => {
    if (!cc || cc.length !== 2) return "🌐";
    const code = cc.toUpperCase();
    return String.fromCodePoint(...[...code].map(c => 0x1F1A5 + c.charCodeAt(0)));
  };

  const formatDateTime = (iso?: string) => {
    if (!iso) return "—";
    try { return new Date(iso).toLocaleString("pt-BR"); } catch { return iso; }
  };

  const filtered = items.filter((u) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      (u.name || "").toLowerCase().includes(q) ||
      (u.email || "").toLowerCase().includes(q) ||
      (u.last_ip || "").includes(q) ||
      (u.last_ip_city || "").toLowerCase().includes(q) ||
      (u.last_ip_country || "").toLowerCase().includes(q)
    );
  });

  return (
    <SafeAreaView style={s.safe} edges={["top"]}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.back} testID="admin-users-back">
          <Ionicons name="chevron-back" size={22} color={C.textPrimary} />
        </TouchableOpacity>
        <Text style={s.h1}>Usuários ({items.length})</Text>
        <TouchableOpacity onPress={() => router.push("/admin/ips-bloqueados")} style={s.ipsBtn} testID="admin-blocked-ips">
          <Ionicons name="ban" size={14} color={C.danger} />
        </TouchableOpacity>
      </View>

      <View style={s.searchBox}>
        <Ionicons name="search" size={16} color={C.textMuted} />
        <TextInput
          style={s.searchInput}
          placeholder="Buscar por nome, email, IP ou cidade…"
          placeholderTextColor={C.textMuted}
          value={search}
          onChangeText={setSearch}
          testID="admin-users-search"
        />
      </View>

      {loading ? <View style={s.center}><ActivityIndicator color={C.primary} /></View> : (
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
          {filtered.map((u) => (
            <View key={u.id} style={[s.card, u.banned && { borderColor: C.danger }]}>
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

              {/* Last IP / Location block */}
              {u.role !== "admin" && (
                <View style={s.geoBox}>
                  <View style={s.geoRow}>
                    <Text style={s.geoFlag}>{flagEmoji(u.last_ip_country_code)}</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={s.geoCity}>
                        {u.last_ip_city || "Cidade desconhecida"}
                        {u.last_ip_region ? `, ${u.last_ip_region}` : ""}
                        {u.last_ip_country ? ` — ${u.last_ip_country}` : ""}
                      </Text>
                      <Text style={s.geoIp} selectable>IP: {u.last_ip || "—"}</Text>
                      {u.last_ip_isp ? <Text style={s.geoIsp}>ISP: {u.last_ip_isp}</Text> : null}
                      <Text style={s.geoTime}>Último acesso: {formatDateTime(u.last_login_at)}</Text>
                    </View>
                  </View>
                </View>
              )}

              {u.role !== "admin" && (
                <View style={{ marginTop: 10, flexDirection: "row", gap: 8, justifyContent: "flex-end" }}>
                  <TouchableOpacity style={[s.actBtn, { backgroundColor: C.surfaceAlt, borderWidth: 1, borderColor: C.border }]} onPress={() => openIPs(u)} testID={`view-ips-${u.id}`}>
                    <Ionicons name="map-outline" size={14} color={C.textPrimary} />
                    <Text style={[s.actText, { color: C.textPrimary }]}>Ver IPs</Text>
                  </TouchableOpacity>
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
          {filtered.length === 0 && !loading && (
            <View style={s.empty}><Text style={{ color: C.textMuted }}>Nenhum usuário encontrado.</Text></View>
          )}
        </ScrollView>
      )}

      {/* Ban Modal */}
      <Modal visible={!!banFor} transparent animationType="fade" onRequestClose={() => setBanFor(null)}>
        <View style={s.modalBg}>
          <View style={s.modalCard}>
            <Text style={s.modalTitle}>Bloquear {banFor?.name}?</Text>
            <Text style={s.modalDesc}>
              O usuário e <Text style={{ color: C.danger, fontWeight: "800" }}>todos os IPs já utilizados</Text> por ele serão bloqueados.
              Não será possível criar nova conta ou fazer login a partir desses IPs.
            </Text>
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
                <Text style={{ color: "#fff", fontWeight: "800" }}>Bloquear tudo</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* IP History Modal */}
      <Modal visible={!!ipsFor} transparent animationType="slide" onRequestClose={() => setIpsFor(null)}>
        <View style={s.ipModalBg}>
          <View style={s.ipModalCard}>
            <View style={s.ipModalHeader}>
              <Text style={s.ipModalTitle}>Histórico de IPs</Text>
              <TouchableOpacity onPress={() => setIpsFor(null)} testID="ips-close">
                <Ionicons name="close" size={26} color={C.textPrimary} />
              </TouchableOpacity>
            </View>
            <Text style={s.ipModalSub}>{ipsFor?.name} • {ipsFor?.email}</Text>

            {ipsLoading ? (
              <View style={{ padding: 40, alignItems: "center" }}><ActivityIndicator color={C.primary} /></View>
            ) : (
              <ScrollView style={{ marginTop: 12 }} contentContainerStyle={{ paddingBottom: 20 }}>
                {ipLogs.length === 0 ? (
                  <Text style={{ color: C.textMuted, textAlign: "center", padding: 30 }}>Nenhum acesso registrado ainda.</Text>
                ) : ipLogs.map((l) => (
                  <View key={l.id} style={[s.ipLogCard, l.banned && { borderColor: C.danger }]}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                      <Text style={{ fontSize: 22 }}>{flagEmoji(l.country_code)}</Text>
                      <View style={{ flex: 1 }}>
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                          <Text style={s.ipLogIp} selectable>{l.ip}</Text>
                          <View style={[s.actionBadge, l.action === "register" && { backgroundColor: "#7C3AED22" }]}>
                            <Text style={[s.actionBadgeText, l.action === "register" && { color: "#A78BFA" }]}>
                              {l.action === "register" ? "Cadastro" : "Login"}
                            </Text>
                          </View>
                          {l.banned && <View style={s.bannedTag}><Text style={s.bannedTagText}>Bloqueado</Text></View>}
                        </View>
                        <Text style={s.ipLogLoc}>
                          {l.city || "—"}{l.region ? `, ${l.region}` : ""}{l.country ? ` • ${l.country}` : ""}
                        </Text>
                        {l.isp ? <Text style={s.ipLogIsp}>{l.isp}</Text> : null}
                        <Text style={s.ipLogDate}>{formatDateTime(l.created_at)}</Text>
                      </View>
                    </View>
                  </View>
                ))}
              </ScrollView>
            )}
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
  ipsBtn: { width: 36, height: 36, alignItems: "center", justifyContent: "center", backgroundColor: "#2A0E12", borderRadius: 8, borderWidth: 1, borderColor: C.danger },
  h1: { color: C.textPrimary, fontSize: 17, fontWeight: "800" },

  searchBox: { flexDirection: "row", alignItems: "center", gap: 8, marginHorizontal: 16, marginTop: 12, backgroundColor: C.card, borderRadius: 12, paddingHorizontal: 12, borderWidth: 1, borderColor: C.border },
  searchInput: { flex: 1, paddingVertical: 10, color: C.textPrimary, fontSize: 13 },

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

  geoBox: { marginTop: 12, padding: 10, backgroundColor: C.surface, borderRadius: 10, borderWidth: 1, borderColor: C.border },
  geoRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  geoFlag: { fontSize: 28 },
  geoCity: { color: C.textPrimary, fontWeight: "700", fontSize: 13 },
  geoIp: { color: C.textSecondary, fontSize: 12, marginTop: 2, fontFamily: "monospace" },
  geoIsp: { color: C.textMuted, fontSize: 11, marginTop: 1 },
  geoTime: { color: C.textMuted, fontSize: 11, marginTop: 1 },

  actBtn: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8 },
  actText: { color: "#fff", fontWeight: "700", fontSize: 12 },

  empty: { padding: 30, alignItems: "center" },

  modalBg: { flex: 1, backgroundColor: "rgba(0,0,0,0.7)", alignItems: "center", justifyContent: "center", padding: 24 },
  modalCard: { backgroundColor: C.card, borderRadius: 18, padding: 22, width: "100%", maxWidth: 420, borderWidth: 1, borderColor: C.border },
  modalTitle: { color: C.textPrimary, fontSize: 18, fontWeight: "800" },
  modalDesc: { color: C.textSecondary, marginTop: 6, fontSize: 13, lineHeight: 18 },
  modalInput: { marginTop: 12, backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, borderRadius: 10, padding: 12, minHeight: 80, textAlignVertical: "top", color: C.textPrimary },
  modalActions: { flexDirection: "row", gap: 10, marginTop: 16 },
  modalBtn: { flex: 1, paddingVertical: 13, borderRadius: 10, alignItems: "center" },

  ipModalBg: { flex: 1, backgroundColor: "rgba(0,0,0,0.85)", justifyContent: "flex-end" },
  ipModalCard: { backgroundColor: C.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 22, maxHeight: "85%" },
  ipModalHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  ipModalTitle: { color: C.textPrimary, fontSize: 18, fontWeight: "800" },
  ipModalSub: { color: C.textSecondary, fontSize: 13, marginTop: 2 },

  ipLogCard: { backgroundColor: C.card, borderRadius: 12, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: C.border },
  ipLogIp: { color: C.textPrimary, fontWeight: "800", fontSize: 13, fontFamily: "monospace" },
  ipLogLoc: { color: C.textSecondary, fontSize: 12, marginTop: 3 },
  ipLogIsp: { color: C.textMuted, fontSize: 11, marginTop: 1 },
  ipLogDate: { color: C.textMuted, fontSize: 11, marginTop: 3 },
  actionBadge: { backgroundColor: C.primaryLight, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  actionBadgeText: { color: C.primary, fontSize: 9, fontWeight: "800" },
  bannedTag: { backgroundColor: C.danger, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  bannedTagText: { color: "#fff", fontSize: 9, fontWeight: "800" },
});
