import React, { useCallback, useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import { api } from "../src/api";
import { C } from "../src/theme";

type Notif = { id: string; title: string; body: string; kind: string; link?: string; read: boolean; created_at: string };

const ICONS: Record<string, any> = {
  deposit: "arrow-down-circle",
  withdraw: "arrow-up-circle",
  referral: "gift",
  info: "information-circle",
};

const COLORS: Record<string, string> = {
  deposit: C.primary,
  withdraw: "#F59E0B",
  referral: "#F472B6",
  info: C.textSecondary,
};

export default function Notificacoes() {
  const router = useRouter();
  const [items, setItems] = useState<Notif[]>([]);
  const [loading, setLoading] = useState(true);
  const [refresh, setRefresh] = useState(false);
  const [unread, setUnread] = useState(0);

  const load = useCallback(async () => {
    try {
      const { data } = await api.get("/me/notifications");
      setItems(data.items || []);
      setUnread(data.unread || 0);
    } finally {
      setLoading(false);
      setRefresh(false);
    }
  }, []);

  useFocusEffect(useCallback(() => {
    setLoading(true);
    load();
  }, [load]));

  const markAll = async () => {
    try {
      await api.post("/me/notifications/read-all");
      setItems((arr) => arr.map(n => ({ ...n, read: true })));
      setUnread(0);
    } catch {}
  };

  const onItemPress = async (n: Notif) => {
    if (!n.read) {
      try {
        await api.post(`/me/notifications/${n.id}/read`);
        setItems(arr => arr.map(x => x.id === n.id ? { ...x, read: true } : x));
        setUnread(u => Math.max(0, u - 1));
      } catch {}
    }
    if (n.link) {
      try { router.push(n.link as any); } catch {}
    }
  };

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    const diff = (Date.now() - d.getTime()) / 1000;
    if (diff < 60) return "Agora";
    if (diff < 3600) return `${Math.floor(diff / 60)}min`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
    if (diff < 86400 * 7) return `${Math.floor(diff / 86400)}d`;
    return d.toLocaleDateString("pt-BR");
  };

  return (
    <SafeAreaView style={s.safe} edges={["top", "bottom"]}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.back} testID="notif-back">
          <Ionicons name="chevron-back" size={22} color={C.textPrimary} />
        </TouchableOpacity>
        <Text style={s.h1}>Notificações</Text>
        {unread > 0 ? (
          <TouchableOpacity onPress={markAll} testID="notif-mark-all">
            <Text style={s.markAll}>Marcar lidas</Text>
          </TouchableOpacity>
        ) : <View style={{ width: 70 }} />}
      </View>

      {loading ? (
        <View style={s.center}><ActivityIndicator color={C.primary} /></View>
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
          refreshControl={<RefreshControl refreshing={refresh} onRefresh={() => { setRefresh(true); load(); }} tintColor={C.primary} />}
        >
          {items.length === 0 ? (
            <View style={s.empty}>
              <Ionicons name="notifications-off-outline" size={48} color={C.textMuted} />
              <Text style={s.emptyTitle}>Nenhuma notificação</Text>
              <Text style={s.emptyDesc}>Quando houver novidades sobre seus depósitos, saques ou indicações, elas aparecerão aqui.</Text>
            </View>
          ) : items.map((n) => {
            const color = COLORS[n.kind] || C.textSecondary;
            const icon = ICONS[n.kind] || "notifications";
            return (
              <TouchableOpacity
                key={n.id}
                style={[s.item, !n.read && s.itemUnread]}
                onPress={() => onItemPress(n)}
                testID={`notif-${n.id}`}
                activeOpacity={0.7}
              >
                <View style={[s.iconBox, { backgroundColor: `${color}22` }]}>
                  <Ionicons name={icon} size={22} color={color} />
                </View>
                <View style={{ flex: 1 }}>
                  <View style={s.itemTopRow}>
                    <Text style={[s.itemTitle, !n.read && { color: C.textPrimary, fontWeight: "800" }]}>{n.title}</Text>
                    <Text style={s.itemDate}>{formatDate(n.created_at)}</Text>
                  </View>
                  <Text style={s.itemBody} numberOfLines={3}>{n.body}</Text>
                </View>
                {!n.read && <View style={s.unreadDot} />}
              </TouchableOpacity>
            );
          })}
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
  markAll: { color: C.primary, fontWeight: "700", fontSize: 13 },

  empty: { alignItems: "center", padding: 40, gap: 8 },
  emptyTitle: { color: C.textPrimary, fontWeight: "800", fontSize: 16, marginTop: 8 },
  emptyDesc: { color: C.textMuted, textAlign: "center", fontSize: 13, lineHeight: 18 },

  item: { flexDirection: "row", gap: 12, backgroundColor: C.card, padding: 14, borderRadius: 14, borderWidth: 1, borderColor: C.border, marginBottom: 8, alignItems: "flex-start" },
  itemUnread: { borderColor: C.primary, backgroundColor: C.card },
  iconBox: { width: 42, height: 42, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  itemTopRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  itemTitle: { flex: 1, color: C.textSecondary, fontSize: 14, fontWeight: "700" },
  itemDate: { color: C.textMuted, fontSize: 11, marginLeft: 6 },
  itemBody: { color: C.textSecondary, fontSize: 13, marginTop: 4, lineHeight: 18 },
  unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: C.primary, marginTop: 6 },
});
