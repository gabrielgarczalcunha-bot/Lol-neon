import React, { useCallback, useState } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Modal, TextInput, ActivityIndicator, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter, useFocusEffect } from "expo-router";
import { api, fmtBRL, formatApiError } from "../../src/api";
import { C } from "../../src/theme";

type Stats = {
  total_users: number;
  total_lotes: number;
  total_deposits: number;
  pending_deposits: number;
  approved_deposits: number;
  total_withdrawals: number;
  pending_withdrawals: number;
  total_transactions: number;
  total_notifications: number;
  total_referrals: number;
  total_banned_ips: number;
  total_balance: number;
  sum_approved_deposits: number;
  sum_approved_withdrawals: number;
};

export default function AdminHome() {
  const router = useRouter();
  const [stats, setStats] = useState<Stats | null>(null);
  const [resetOpen, setResetOpen] = useState(false);
  const [resetText, setResetText] = useState("");
  const [keepLotes, setKeepLotes] = useState(true);
  const [resetting, setResetting] = useState(false);

  const load = useCallback(async () => {
    try {
      const { data } = await api.get("/admin/stats");
      setStats(data);
    } catch {}
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const doReset = async () => {
    if (resetText !== "RESET") {
      Alert.alert("Atenção", 'Digite "RESET" em maiúsculas para confirmar.');
      return;
    }
    setResetting(true);
    try {
      const { data } = await api.post("/admin/reset", { confirm: "RESET", keep_lotes: keepLotes });
      const d = data.deleted || {};
      setResetOpen(false);
      setResetText("");
      await load();
      Alert.alert(
        "Reset concluído",
        `Removidos: ${d.users || 0} usuários, ${d.deposits || 0} depósitos, ${d.withdrawals || 0} saques, ${d.transactions || 0} transações, ${d.notifications || 0} notificações${d.lotes ? `, ${d.lotes} lotes` : ""}.`
      );
    } catch (e: any) {
      Alert.alert("Erro", formatApiError(e));
    } finally {
      setResetting(false);
    }
  };

  return (
    <SafeAreaView style={s.safe} edges={["top"]}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.back} testID="admin-back">
          <Ionicons name="chevron-back" size={22} color={C.textPrimary} />
        </TouchableOpacity>
        <Text style={s.h1}>Painel Admin</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
        {/* Financial overview */}
        <View style={s.bigCard}>
          <Text style={s.bigCardLabel}>Saldo total dos usuários</Text>
          <Text style={s.bigCardValue}>{fmtBRL(stats?.total_balance || 0)}</Text>
          <View style={s.bigCardRow}>
            <View style={s.bigCardStat}>
              <Text style={s.bigCardStatLabel}>Depósitos aprovados</Text>
              <Text style={s.bigCardStatValue}>{fmtBRL(stats?.sum_approved_deposits || 0)}</Text>
            </View>
            <View style={s.bigCardDivider} />
            <View style={s.bigCardStat}>
              <Text style={s.bigCardStatLabel}>Saques aprovados</Text>
              <Text style={[s.bigCardStatValue, { color: "#FCA5A5" }]}>{fmtBRL(stats?.sum_approved_withdrawals || 0)}</Text>
            </View>
          </View>
        </View>

        <View style={s.statsRow}>
          <Stat color="#FBBF24" icon="time" label="Depósitos pendentes" value={String(stats?.pending_deposits || 0)} />
          <Stat color="#F87171" icon="arrow-up-circle" label="Saques pendentes" value={String(stats?.pending_withdrawals || 0)} />
        </View>
        <View style={s.statsRow}>
          <Stat color={C.primary} icon="people" label="Usuários" value={String(stats?.total_users || 0)} />
          <Stat color="#60A5FA" icon="cube" label="Lotes" value={String(stats?.total_lotes || 0)} />
        </View>
        <View style={s.statsRow}>
          <Stat color="#F472B6" icon="gift" label="Indicações" value={String(stats?.total_referrals || 0)} />
          <Stat color={C.danger} icon="ban" label="IPs bloqueados" value={String(stats?.total_banned_ips || 0)} />
        </View>

        <Text style={s.sectionTitle}>Gerenciamento</Text>
        <Row icon="time" label="Aprovar Depósitos" badge={stats?.pending_deposits || 0} onPress={() => router.push("/admin/depositos")} testID="admin-deposits" />
        <Row icon="arrow-up-circle" label="Aprovar Saques" badge={stats?.pending_withdrawals || 0} onPress={() => router.push("/admin/saques")} testID="admin-withdrawals" />
        <Row icon="cube" label="Gerenciar Lotes" onPress={() => router.push("/admin/lotes")} testID="admin-lotes" />
        <Row icon="people" label="Usuários" onPress={() => router.push("/admin/usuarios")} testID="admin-users" />
        <Row icon="ban" label="IPs Bloqueados" onPress={() => router.push("/admin/ips-bloqueados")} testID="admin-blocked-ips" />
        <Row icon="key" label="Configurar Chave PIX" onPress={() => router.push("/admin/pix")} testID="admin-pix" />

        <Text style={[s.sectionTitle, { color: C.danger, marginTop: 28 }]}>Zona de perigo</Text>
        <TouchableOpacity style={s.dangerBtn} onPress={() => { setResetText(""); setKeepLotes(true); setResetOpen(true); }} testID="admin-reset-btn">
          <Ionicons name="nuclear" size={20} color={C.danger} />
          <View style={{ flex: 1 }}>
            <Text style={s.dangerTitle}>Limpar tudo (reset)</Text>
            <Text style={s.dangerDesc}>Apaga todos os usuários, depósitos, saques, transações e notificações.</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={C.danger} />
        </TouchableOpacity>
      </ScrollView>

      {/* Reset Modal */}
      <Modal visible={resetOpen} transparent animationType="fade" onRequestClose={() => !resetting && setResetOpen(false)}>
        <View style={s.modalBg}>
          <View style={s.modalCard}>
            <View style={s.modalIcon}><Ionicons name="warning" size={40} color={C.danger} /></View>
            <Text style={s.modalTitle}>Limpar todos os dados?</Text>
            <Text style={s.modalDesc}>
              Esta ação <Text style={{ fontWeight: "900", color: C.danger }}>NÃO pode ser desfeita</Text>.{"\n\n"}
              Serão removidos:
              {"\n"}• Todos os usuários (exceto admin)
              {"\n"}• Todos os depósitos, saques e transações
              {"\n"}• Notificações, indicações e IPs bloqueados
              {"\n"}• Compras de lotes (usuários "zerados")
              {"\n\n"}
              Os {keepLotes ? "lotes serão mantidos" : <Text style={{ color: C.danger, fontWeight: "800" }}>LOTES TAMBÉM SERÃO APAGADOS</Text>} e o admin permanece.
            </Text>

            <TouchableOpacity style={s.keepLotesRow} onPress={() => setKeepLotes(!keepLotes)} testID="reset-keep-lotes">
              <View style={[s.checkbox, keepLotes && s.checkboxActive]}>
                {keepLotes && <Ionicons name="checkmark" size={14} color="#0A0612" />}
              </View>
              <Text style={s.keepLotesText}>Manter os lotes cadastrados</Text>
            </TouchableOpacity>

            <Text style={s.confirmLabel}>Digite "RESET" para confirmar:</Text>
            <TextInput
              testID="reset-input"
              style={s.modalInput}
              value={resetText}
              onChangeText={setResetText}
              autoCapitalize="characters"
              placeholder="RESET"
              placeholderTextColor={C.textMuted}
            />

            <View style={s.modalActions}>
              <TouchableOpacity style={[s.modalBtn, { backgroundColor: C.surfaceAlt }]} onPress={() => setResetOpen(false)} disabled={resetting} testID="reset-cancel">
                <Text style={{ color: C.textPrimary, fontWeight: "700" }}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.modalBtn, { backgroundColor: C.danger }, (resetText !== "RESET" || resetting) && { opacity: 0.5 }]}
                onPress={doReset}
                disabled={resetText !== "RESET" || resetting}
                testID="reset-confirm"
              >
                {resetting ? <ActivityIndicator color="#fff" /> : <Text style={{ color: "#fff", fontWeight: "800" }}>Limpar tudo</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function Stat({ icon, label, value, color }: any) {
  return (
    <View style={s.stat}>
      <View style={[s.statIcon, { backgroundColor: `${color}22` }]}>
        <Ionicons name={icon} size={18} color={color} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={s.statLabel}>{label}</Text>
        <Text style={s.statValue}>{value}</Text>
      </View>
    </View>
  );
}

function Row({ icon, label, onPress, badge, testID }: any) {
  return (
    <TouchableOpacity style={s.row} onPress={onPress} testID={testID}>
      <View style={s.rowIcon}><Ionicons name={icon} size={18} color={C.textPrimary} /></View>
      <Text style={s.rowLabel}>{label}</Text>
      {badge ? <View style={s.badge}><Text style={s.badgeText}>{badge}</Text></View> : null}
      <Ionicons name="chevron-forward" size={18} color={C.textMuted} />
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.surface },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: C.border, backgroundColor: C.card },
  back: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  h1: { color: C.textPrimary, fontSize: 17, fontWeight: "800" },

  bigCard: { backgroundColor: C.primary, borderRadius: 20, padding: 20, marginBottom: 14 },
  bigCardLabel: { color: "#0A0612", fontSize: 12, fontWeight: "700", opacity: 0.8 },
  bigCardValue: { color: "#0A0612", fontSize: 32, fontWeight: "900", marginTop: 4, letterSpacing: -0.5 },
  bigCardRow: { flexDirection: "row", marginTop: 16, backgroundColor: "rgba(10,6,18,0.15)", borderRadius: 12, padding: 12 },
  bigCardStat: { flex: 1 },
  bigCardStatLabel: { color: "#0A0612", fontSize: 10, fontWeight: "700", opacity: 0.7 },
  bigCardStatValue: { color: "#0A0612", fontSize: 15, fontWeight: "800", marginTop: 2 },
  bigCardDivider: { width: 1, backgroundColor: "rgba(10,6,18,0.15)", marginHorizontal: 12 },

  statsRow: { flexDirection: "row", gap: 10, marginBottom: 10 },
  stat: { flex: 1, backgroundColor: C.card, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: C.border, flexDirection: "row", alignItems: "center", gap: 10 },
  statIcon: { width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  statLabel: { color: C.textMuted, fontSize: 11 },
  statValue: { color: C.textPrimary, fontSize: 16, fontWeight: "800" },

  sectionTitle: { color: C.textPrimary, fontSize: 16, fontWeight: "800", marginTop: 22, marginBottom: 10 },
  row: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 14, paddingVertical: 14, backgroundColor: C.card, borderRadius: 14, marginBottom: 10, borderWidth: 1, borderColor: C.border },
  rowIcon: { width: 36, height: 36, borderRadius: 10, backgroundColor: C.surfaceAlt, alignItems: "center", justifyContent: "center" },
  rowLabel: { flex: 1, color: C.textPrimary, fontWeight: "700" },
  badge: { backgroundColor: C.pending, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10, minWidth: 24, alignItems: "center" },
  badgeText: { color: "#fff", fontWeight: "800", fontSize: 11 },

  dangerBtn: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 14, paddingVertical: 14, backgroundColor: "#2A0E12", borderRadius: 14, borderWidth: 1, borderColor: C.danger },
  dangerTitle: { color: C.danger, fontWeight: "800", fontSize: 14 },
  dangerDesc: { color: "#FCA5A5", fontSize: 12, marginTop: 2 },

  modalBg: { flex: 1, backgroundColor: "rgba(0,0,0,0.85)", alignItems: "center", justifyContent: "center", padding: 24 },
  modalCard: { backgroundColor: C.card, borderRadius: 22, padding: 24, width: "100%", maxWidth: 420, borderWidth: 1, borderColor: C.danger, alignItems: "center" },
  modalIcon: { width: 76, height: 76, borderRadius: 38, backgroundColor: "#2A0E12", alignItems: "center", justifyContent: "center" },
  modalTitle: { color: C.textPrimary, fontSize: 20, fontWeight: "900", marginTop: 14, textAlign: "center" },
  modalDesc: { color: C.textSecondary, marginTop: 10, fontSize: 13, lineHeight: 20, alignSelf: "stretch" },
  keepLotesRow: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 14, alignSelf: "stretch", padding: 10, backgroundColor: C.surfaceAlt, borderRadius: 10 },
  checkbox: { width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: C.border, alignItems: "center", justifyContent: "center" },
  checkboxActive: { backgroundColor: C.primary, borderColor: C.primary },
  keepLotesText: { color: C.textPrimary, fontWeight: "700", fontSize: 13 },
  confirmLabel: { color: C.textSecondary, marginTop: 16, fontSize: 12, alignSelf: "stretch" },
  modalInput: { marginTop: 6, backgroundColor: C.surface, borderWidth: 2, borderColor: C.danger, borderRadius: 12, padding: 14, color: C.textPrimary, fontWeight: "800", fontSize: 16, alignSelf: "stretch", textAlign: "center", letterSpacing: 4 },
  modalActions: { flexDirection: "row", gap: 10, marginTop: 18, alignSelf: "stretch" },
  modalBtn: { flex: 1, paddingVertical: 14, borderRadius: 12, alignItems: "center", justifyContent: "center" },
});
