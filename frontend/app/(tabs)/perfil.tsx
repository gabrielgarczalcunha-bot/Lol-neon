import React, { useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Modal, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useAuth } from "../../src/AuthContext";
import { C } from "../../src/theme";

export default function Perfil() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [infoOpen, setInfoOpen] = useState<{ title: string; body: string } | null>(null);
  const [loggingOut, setLoggingOut] = useState(false);

  const confirmLogout = async () => {
    setLoggingOut(true);
    try {
      await logout();
      setConfirmOpen(false);
      router.replace("/(auth)/welcome");
    } finally {
      setLoggingOut(false);
    }
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
            icon="people"
            label="Indique e ganhe"
            onPress={() => router.push("/indicacao")}
            testID="profile-referral"
          />
          <Row
            icon="key"
            label="Senha de saque"
            onPress={() => router.push("/senha-saque")}
            testID="profile-withdraw-pwd"
          />
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
            onPress={() => setInfoOpen({ title: "Segurança", body: "Sua sessão é criptografada com JWT. Nunca compartilhe suas credenciais ou senha de saque." })}
            testID="profile-security"
          />
        </View>

        <TouchableOpacity style={s.logout} onPress={() => setConfirmOpen(true)} testID="profile-logout" activeOpacity={0.8}>
          <Ionicons name="log-out-outline" size={20} color={C.danger} />
          <Text style={s.logoutText}>Sair da conta</Text>
        </TouchableOpacity>

        <Text style={s.version}>Neon Farm • v1.0.0</Text>
      </ScrollView>

      {/* Logout confirmation modal */}
      <Modal visible={confirmOpen} transparent animationType="fade" onRequestClose={() => !loggingOut && setConfirmOpen(false)}>
        <View style={s.modalBg}>
          <View style={s.modalCard}>
            <View style={[s.modalIcon, { backgroundColor: "#FEE2E2" }]}>
              <Ionicons name="log-out-outline" size={40} color={C.danger} />
            </View>
            <Text style={s.modalTitle}>Sair da conta?</Text>
            <Text style={s.modalDesc}>
              Você precisará fazer login novamente para acessar a Neon Farm.
            </Text>
            <View style={s.modalRow}>
              <TouchableOpacity
                style={[s.modalBtn, s.modalBtnSecondary]}
                onPress={() => setConfirmOpen(false)}
                disabled={loggingOut}
                testID="logout-cancel"
              >
                <Text style={s.modalBtnSecondaryText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.modalBtn, { backgroundColor: C.danger }]}
                onPress={confirmLogout}
                disabled={loggingOut}
                testID="logout-confirm"
              >
                {loggingOut ? <ActivityIndicator color="#fff" /> : <Text style={s.modalBtnText}>Sair</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Info modal */}
      <Modal visible={!!infoOpen} transparent animationType="fade" onRequestClose={() => setInfoOpen(null)}>
        <View style={s.modalBg}>
          <View style={s.modalCard}>
            <View style={[s.modalIcon, { backgroundColor: C.primaryLight }]}>
              <Ionicons name="information-circle" size={40} color={C.primary} />
            </View>
            <Text style={s.modalTitle}>{infoOpen?.title}</Text>
            <Text style={s.modalDesc}>{infoOpen?.body}</Text>
            <TouchableOpacity
              style={[s.modalBtn, { backgroundColor: C.primary, alignSelf: "stretch", marginTop: 18 }]}
              onPress={() => setInfoOpen(null)}
              testID="info-close"
            >
              <Text style={[s.modalBtnText, { color: "#0A0612" }]}>Entendi</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
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
  avatarText: { color: "#0A0612", fontSize: 32, fontWeight: "800" },
  name: { color: C.textPrimary, fontSize: 20, fontWeight: "800", marginTop: 12 },
  email: { color: C.textSecondary, marginTop: 2 },
  roleBadge: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: C.primary, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, marginTop: 8 },
  roleText: { color: "#0A0612", fontWeight: "700", fontSize: 11 },

  list: { backgroundColor: C.card, marginHorizontal: 20, borderRadius: 18, overflow: "hidden", borderWidth: 1, borderColor: C.border },
  row: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: C.border },
  rowIcon: { width: 36, height: 36, borderRadius: 10, backgroundColor: C.surfaceAlt, alignItems: "center", justifyContent: "center" },
  rowLabel: { flex: 1, color: C.textPrimary, fontWeight: "600" },

  logout: { marginTop: 24, marginHorizontal: 20, padding: 14, borderRadius: 14, backgroundColor: "#2A0E12", borderWidth: 1, borderColor: C.danger, flexDirection: "row", gap: 8, alignItems: "center", justifyContent: "center" },
  logoutText: { color: C.danger, fontWeight: "800" },

  version: { textAlign: "center", color: C.textMuted, marginTop: 18, fontSize: 12 },

  modalBg: { flex: 1, backgroundColor: "rgba(0,0,0,0.8)", alignItems: "center", justifyContent: "center", padding: 24 },
  modalCard: { backgroundColor: C.card, borderRadius: 22, padding: 24, width: "100%", maxWidth: 380, borderWidth: 1, borderColor: C.border, alignItems: "center" },
  modalIcon: { width: 80, height: 80, borderRadius: 40, alignItems: "center", justifyContent: "center" },
  modalTitle: { color: C.textPrimary, fontSize: 20, fontWeight: "900", marginTop: 14, textAlign: "center" },
  modalDesc: { color: C.textSecondary, marginTop: 8, fontSize: 14, lineHeight: 20, textAlign: "center" },
  modalRow: { flexDirection: "row", gap: 10, marginTop: 22, alignSelf: "stretch" },
  modalBtn: { flex: 1, paddingVertical: 14, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  modalBtnSecondary: { backgroundColor: C.surfaceAlt, borderWidth: 1, borderColor: C.border },
  modalBtnSecondaryText: { color: C.textPrimary, fontWeight: "700" },
  modalBtnText: { color: "#fff", fontWeight: "800" },
});
