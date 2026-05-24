import React, { useCallback, useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, Image, TouchableOpacity, ActivityIndicator, RefreshControl,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import { api, fmtBRL } from "../../src/api";
import { C } from "../../src/theme";

type Lote = {
  id: string; name: string; description: string; price: number;
  hourly_yield: number; duration_days: number; image_url: string;
};

export default function Loja() {
  const router = useRouter();
  const [lotes, setLotes] = useState<Lote[]>([]);
  const [loading, setLoading] = useState(true);
  const [refresh, setRefresh] = useState(false);

  const load = useCallback(async () => {
    try {
      const { data } = await api.get("/lotes");
      setLotes(data);
    } catch {}
  }, []);

  useFocusEffect(useCallback(() => {
    setLoading(true);
    load().finally(() => setLoading(false));
  }, [load]));

  const onRefresh = async () => { setRefresh(true); await load(); setRefresh(false); };

  return (
    <SafeAreaView style={s.safe} edges={["top"]}>
      <View style={s.header}>
        <Text style={s.h1}>Loja de Lotes</Text>
        <Text style={s.sub}>Invista e receba rendimentos por hora</Text>
      </View>

      {loading ? (
        <View style={s.center}><ActivityIndicator size="large" color={C.primary} /></View>
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: 20, paddingBottom: 40 }}
          refreshControl={<RefreshControl refreshing={refresh} onRefresh={onRefresh} tintColor={C.primary} />}
        >
          {lotes.length === 0 ? (
            <View style={s.empty}>
              <Ionicons name="bag-handle-outline" size={46} color={C.textMuted} />
              <Text style={s.emptyTitle}>Nenhum lote disponível</Text>
              <Text style={s.emptySub}>Aguarde o lançamento de novos lotes.</Text>
            </View>
          ) : (
            lotes.map((l) => (
              <TouchableOpacity
                key={l.id}
                testID={`loja-lote-${l.id}`}
                style={s.card}
                onPress={() => router.push(`/lote/${l.id}`)}
                activeOpacity={0.85}
              >
                {l.image_url ? (
                  <Image source={{ uri: l.image_url }} style={s.img} />
                ) : (
                  <View style={[s.img, { alignItems: "center", justifyContent: "center", backgroundColor: C.primaryLight }]}>
                    <Ionicons name="cube" size={46} color={C.primary} />
                  </View>
                )}
                <View style={s.body}>
                  <Text style={s.name}>{l.name}</Text>
                  {!!l.description && <Text style={s.desc} numberOfLines={2}>{l.description}</Text>}
                  <View style={s.row}>
                    <View style={s.pill}>
                      <Ionicons name="trending-up" size={12} color={C.primaryDark} />
                      <Text style={s.pillText}>{fmtBRL(l.hourly_yield)}/h</Text>
                    </View>
                    <View style={s.pill}>
                      <Ionicons name="calendar" size={12} color={C.primaryDark} />
                      <Text style={s.pillText}>{l.duration_days} dias</Text>
                    </View>
                  </View>
                  <View style={s.buyRow}>
                    <Text style={s.price}>{fmtBRL(l.price)}</Text>
                    <View style={s.buyBtn}>
                      <Text style={s.buyBtnText}>Comprar</Text>
                      <Ionicons name="arrow-forward" size={14} color="#fff" />
                    </View>
                  </View>
                </View>
              </TouchableOpacity>
            ))
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.surface },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  header: { paddingHorizontal: 20, paddingTop: 14, paddingBottom: 6 },
  h1: { color: C.textPrimary, fontSize: 24, fontWeight: "800" },
  sub: { color: C.textSecondary, marginTop: 2 },
  empty: { alignItems: "center", padding: 30, marginTop: 30 },
  emptyTitle: { marginTop: 10, fontWeight: "700", color: C.textPrimary },
  emptySub: { marginTop: 4, color: C.textSecondary, textAlign: "center" },

  card: {
    backgroundColor: C.card, borderRadius: 20, marginBottom: 16, overflow: "hidden",
    borderWidth: 1, borderColor: C.border,
    shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 14, shadowOffset: { width: 0, height: 4 }, elevation: 2,
  },
  img: { width: "100%", height: 170, backgroundColor: C.surfaceAlt },
  body: { padding: 16 },
  name: { color: C.textPrimary, fontSize: 17, fontWeight: "800" },
  desc: { color: C.textSecondary, marginTop: 4, fontSize: 13 },
  row: { flexDirection: "row", gap: 8, marginTop: 10 },
  pill: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: C.primaryLight, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 20 },
  pillText: { color: C.primaryDark, fontWeight: "700", fontSize: 12 },
  buyRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 14 },
  price: { color: C.textPrimary, fontSize: 22, fontWeight: "800" },
  buyBtn: { flexDirection: "row", gap: 6, alignItems: "center", backgroundColor: C.primary, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12 },
  buyBtnText: { color: "#fff", fontWeight: "800" },
});
