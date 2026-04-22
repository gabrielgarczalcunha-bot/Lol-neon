import React from "react";
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useAuth } from "../../src/AuthContext";
import { C } from "../../src/theme";

export default function Perfil() {
  const { user, logout } = useAuth();
  const router = useRouter();

  const doLogout = () => {
    Alert.alert("Sair da conta", "Tem certeza que deseja sair?", [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Sair", style: "destructive", onPress: async () => {
          await logout();
          router.replace("/(auth)/login");
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={s.safe} edges={["top"]}>
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        <View style={s.header}>
          <View style={s.avatar}>
            <Text style={s.avatarText}>{(user?.name || "U").substring(0, 1).toUpperCase()}</Text>
          </View>
          <Text style={s.name}>{user?.name}</Text>
          <Text style={s.email}>{user?.email}</Text>
          {user?.role === "admin" && (
            <View style={s.roleBadge}>
              <Ionicons name="shield-checkmark" size={12} color="#fff" />
              <Text style={s.roleText}>Administrador</Text>
            </View>
          )}
        </View>

        <View style={s.list}>
          {user?.role === "admin" && (
            <Row
              icon="construct"
              color={C.primary}
              label="Painel Administrativo"
              onPress={() => router.push("/admin")}
              testID="profile-admin-link"
            />
          )}
          <Row
            icon="information-circle"
            label="Sobre a empresa"
            onPress={() => router.push("/sobre")}
            testID="profile-about"
          />
          <Row
            icon="document-text"
            label="Termos e Licença"
            onPress={() => router.push("/sobre")}
            testID="profile-terms"
          />
          <Row
            icon="lock-closed"
            label="Segurança"
            onPress={() => Alert.alert("Segurança", "Sua sessão é criptografada. Não compartilhe suas credenciais.")}
            testID="profile-security"
          />
        </View>

        <TouchableOpacity style={s.logout} onPress={doLogout} testID="profile-logout">
          <Ionicons name="log-out-outline" size={20} color={C.danger} />
          <Text style={s.logoutText}>Sair da conta</Text>
        </TouchableOpacity>

        <Text style={s.version}>LotePro • v1.0.0</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function Row({ icon, label, onPress, testID, color }: any) {
  return (
    <TouchableOpacity style={s.row} onPress={onPress} testID={testID}>
      <View style={[s.rowIcon, color && { backgroundColor: `${color}22` }]}>
        <Ionicons name={icon} size={18} color={color || C.textPrimary} />
      </View>
      <Text style={s.rowLabel}>{label}</Text>
      <Ionicons name="chevron-forward" size={18} color={C.textMuted} />
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.surface },
  header: { alignItems: "center", paddingVertical: 24 },
  avatar: { width: 80, height: 80, borderRadius: 40, backgroundColor: C.primary, alignItems: "center", justifyContent: "center" },
  avatarText: { color: "#fff", fontSize: 32, fontWeight: "800" },
  name: { color: C.textPrimary, fontSize: 20, fontWeight: "800", marginTop: 12 },
  email: { color: C.textSecondary, marginTop: 2 },
  roleBadge: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: C.primary, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, marginTop: 8 },
  roleText: { color: "#fff", fontWeight: "700", fontSize: 11 },

  list: { backgroundColor: "#fff", marginHorizontal: 20, borderRadius: 18, overflow: "hidden", borderWidth: 1, borderColor: C.border },
  row: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: C.border },
  rowIcon: { width: 36, height: 36, borderRadius: 10, backgroundColor: C.surfaceAlt, alignItems: "center", justifyContent: "center" },
  rowLabel: { flex: 1, color: C.textPrimary, fontWeight: "600" },

  logout: { marginTop: 24, marginHorizontal: 20, padding: 14, borderRadius: 14, backgroundColor: "#FEE2E2", flexDirection: "row", gap: 8, alignItems: "center", justifyContent: "center" },
  logoutText: { color: C.danger, fontWeight: "800" },

  version: { textAlign: "center", color: C.textMuted, marginTop: 18, fontSize: 12 },
});
