import React, { useCallback, useState } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter, useFocusEffect } from "expo-router";
import { api, fmtBRL } from "../../src/api";
import { C } from "../../src/theme";

export default function AdminHome() {
  const router = useRouter();
  const [stats, setStats] = useState({
    pending_deposits: 0,
    pending_withdrawals: 0,
    total_users: 0,
    total_lotes: 0,
    total_balance: 0,
  });

  const load = useCallback(async () => {
    try {
      const [d, w, u, l] = await Promise.all([
        api.get("/admin/deposits", { params: { status: "pending" } }),
        api.get("/admin/withdrawals", { params: { status: "pending" } }),
        api.get("/admin/users"),
        api.get("/admin/lotes"),
      ]);
      const totalBalance = (u.data || []).reduce((acc: number, x: any) => acc + Number(x.balance || 0), 0);
      setStats({
        pending_deposits: d.data.length,
        pending_withdrawals: w.data.length,
        total_users: u.data.length,
        total_lotes: l.data.length,
        total_balance: totalBalance,
      });
    } catch {}
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

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
        <View style={s.statsRow}>
          <Stat color="#FBBF24" icon="time" label="Depósitos pendentes" value={String(stats.pending_deposits)} />
          <Stat color="#F87171" icon="arrow-up-circle" label="Saques pendentes" value={String(stats.pending_withdrawals)} />
        </View>
        <View style={s.statsRow}>
          <Stat color={C.primary} icon="people" label="Usuários" value={String(stats.total_users)} />
          <Stat color="#60A5FA" icon="cube" label="Lotes cadastrados" value={String(stats.total_lotes)} />
        </View>
        <View style={[s.statsRow, { marginBottom: 0 }]}>
          <Stat color="#A78BFA" icon="cash" label="Saldo total dos usuários" value={fmtBRL(stats.total_balance)} full />
        </View>

        <Text style={s.sectionTitle}>Gerenciamento</Text>
        <Row icon="time" label="Aprovar Depósitos" badge={stats.pending_deposits} onPress={() => router.push("/admin/depositos")} testID="admin-deposits" />
        <Row icon="arrow-up-circle" label="Aprovar Saques" badge={stats.pending_withdrawals} onPress={() => router.push("/admin/saques")} testID="admin-withdrawals" />
        <Row icon="cube" label="Gerenciar Lotes" onPress={() => router.push("/admin/lotes")} testID="admin-lotes" />
        <Row icon="people" label="Usuários" onPress={() => router.push("/admin/usuarios")} testID="admin-users" />
        <Row icon="key" label="Configurar Chave PIX" onPress={() => router.push("/admin/pix")} testID="admin-pix" />
      </ScrollView>
    </SafeAreaView>
  );
}

function Stat({ icon, label, value, color, full }: any) {
  return (
    <View style={[s.stat, full && { flex: 2 }]}>
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
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: C.border, backgroundColor: "#fff" },
  back: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  h1: { color: C.textPrimary, fontSize: 17, fontWeight: "800" },

  statsRow: { flexDirection: "row", gap: 10, marginBottom: 10 },
  stat: { flex: 1, backgroundColor: "#fff", borderRadius: 14, padding: 14, borderWidth: 1, borderColor: C.border, flexDirection: "row", alignItems: "center", gap: 10 },
  statIcon: { width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  statLabel: { color: C.textMuted, fontSize: 11 },
  statValue: { color: C.textPrimary, fontSize: 16, fontWeight: "800" },

  sectionTitle: { color: C.textPrimary, fontSize: 16, fontWeight: "800", marginTop: 22, marginBottom: 10 },
  row: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 14, paddingVertical: 14, backgroundColor: "#fff", borderRadius: 14, marginBottom: 10, borderWidth: 1, borderColor: C.border },
  rowIcon: { width: 36, height: 36, borderRadius: 10, backgroundColor: C.surfaceAlt, alignItems: "center", justifyContent: "center" },
  rowLabel: { flex: 1, color: C.textPrimary, fontWeight: "700" },
  badge: { backgroundColor: C.pending, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10, minWidth: 24, alignItems: "center" },
  badgeText: { color: "#fff", fontWeight: "800", fontSize: 11 },
});
