import React, { useCallback, useState } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter, useFocusEffect } from "expo-router";
import { api, fmtBRL } from "../../src/api";
import { C } from "../../src/theme";

type U = { id: string; name: string; email: string; role: string; balance: number; created_at: string };

export default function AdminUsers() {
  const router = useRouter();
  const [items, setItems] = useState<U[]>([]);
  const [loading, setLoading] = useState(true);

  useFocusEffect(useCallback(() => {
    setLoading(true);
    api.get("/admin/users").then(r => setItems(r.data)).finally(() => setLoading(false));
  }, []));

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
            <View key={u.id} style={s.card}>
              <View style={s.avatar}><Text style={s.avatarText}>{(u.name || "U").substring(0, 1).toUpperCase()}</Text></View>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                  <Text style={s.name}>{u.name}</Text>
                  {u.role === "admin" && (
                    <View style={s.role}><Text style={s.roleText}>ADMIN</Text></View>
                  )}
                </View>
                <Text style={s.email}>{u.email}</Text>
                <Text style={s.date}>Cadastro: {new Date(u.created_at).toLocaleDateString("pt-BR")}</Text>
              </View>
              <Text style={s.balance}>{fmtBRL(u.balance)}</Text>
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
  card: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: "#fff", padding: 14, borderRadius: 14, borderWidth: 1, borderColor: C.border, marginBottom: 10 },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: C.primary, alignItems: "center", justifyContent: "center" },
  avatarText: { color: "#fff", fontWeight: "800" },
  name: { fontWeight: "800", color: C.textPrimary },
  email: { color: C.textMuted, fontSize: 12, marginTop: 2 },
  date: { color: C.textMuted, fontSize: 11, marginTop: 2 },
  balance: { color: C.primary, fontWeight: "800", fontSize: 15 },
  role: { backgroundColor: C.primary, paddingHorizontal: 6, paddingVertical: 1, borderRadius: 4 },
  roleText: { color: "#fff", fontSize: 9, fontWeight: "800" },
});
