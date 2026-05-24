import React, { useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, ActivityIndicator, Alert, Platform, KeyboardAvoidingView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useAuth } from "../src/AuthContext";
import { api, formatApiError } from "../src/api";
import { C } from "../src/theme";

export default function SenhaSaque() {
  const router = useRouter();
  const { user, refresh } = useAuth();
  const { redirect } = useLocalSearchParams<{ redirect?: string }>();
  const hasPassword = !!(user as any)?.has_withdraw_password;

  const [currentPwd, setCurrentPwd] = useState("");
  const [newPwd, setNewPwd] = useState("");
  const [confirmPwd, setConfirmPwd] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (newPwd.length < 4) { Alert.alert("Atenção", "Senha deve ter no mínimo 4 caracteres."); return; }
    if (newPwd !== confirmPwd) { Alert.alert("Atenção", "As senhas não coincidem."); return; }
    if (hasPassword && !currentPwd) { Alert.alert("Atenção", "Informe sua senha atual."); return; }
    setLoading(true);
    try {
      await api.post("/me/withdraw-password", {
        password: newPwd, ...(hasPassword ? { current_password: currentPwd } : {}),
      });
      await refresh();
      Alert.alert("Pronto!", hasPassword ? "Senha de saque alterada." : "Senha de saque cadastrada.");
      if (redirect === "saque") router.replace("/saque");
      else router.back();
    } catch (e: any) {
      Alert.alert("Erro", formatApiError(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={s.safe} edges={["top", "bottom"]}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <View style={s.header}>
          <TouchableOpacity onPress={() => router.back()} style={s.back} testID="senha-back">
            <Ionicons name="chevron-back" size={22} color={C.textPrimary} />
          </TouchableOpacity>
          <Text style={s.h1}>{hasPassword ? "Alterar senha de saque" : "Cadastrar senha de saque"}</Text>
          <View style={{ width: 36 }} />
        </View>

        <ScrollView contentContainerStyle={{ padding: 20 }} keyboardShouldPersistTaps="handled">
          <View style={s.icon}><Ionicons name="lock-closed" size={26} color={C.primary} /></View>
          <Text style={s.title}>Sua segurança em primeiro lugar</Text>
          <Text style={s.subtitle}>
            Essa senha será solicitada toda vez que você fizer um saque. Não compartilhe com ninguém.
          </Text>

          {hasPassword && (
            <>
              <Text style={s.label}>Senha atual</Text>
              <TextInput
                testID="senha-current"
                style={s.input}
                secureTextEntry
                value={currentPwd}
                onChangeText={setCurrentPwd}
                placeholder="••••"
                placeholderTextColor={C.textMuted}
              />
            </>
          )}

          <Text style={s.label}>Nova senha de saque</Text>
          <TextInput
            testID="senha-new"
            style={s.input}
            secureTextEntry
            value={newPwd}
            onChangeText={setNewPwd}
            placeholder="Mínimo 4 caracteres"
            placeholderTextColor={C.textMuted}
            keyboardType="number-pad"
          />

          <Text style={s.label}>Confirme a senha</Text>
          <TextInput
            testID="senha-confirm"
            style={s.input}
            secureTextEntry
            value={confirmPwd}
            onChangeText={setConfirmPwd}
            placeholder="Repita a senha"
            placeholderTextColor={C.textMuted}
            keyboardType="number-pad"
          />

          <TouchableOpacity style={[s.btn, loading && { opacity: 0.7 }]} onPress={submit} disabled={loading} testID="senha-submit">
            {loading ? <ActivityIndicator color="#0A0612" /> : <Text style={s.btnText}>{hasPassword ? "Salvar nova senha" : "Cadastrar senha"}</Text>}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: C.border, backgroundColor: C.card },
  back: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  h1: { color: C.textPrimary, fontSize: 16, fontWeight: "800" },
  icon: { alignSelf: "center", width: 64, height: 64, borderRadius: 18, backgroundColor: C.primaryLight, alignItems: "center", justifyContent: "center", marginTop: 18 },
  title: { color: C.textPrimary, fontSize: 20, fontWeight: "800", textAlign: "center", marginTop: 14 },
  subtitle: { color: C.textSecondary, textAlign: "center", marginTop: 6, marginBottom: 24, fontSize: 13, lineHeight: 18 },
  label: { color: C.textSecondary, fontSize: 12, fontWeight: "700", marginTop: 14, marginBottom: 6 },
  input: { backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 14, color: C.textPrimary, fontSize: 18, letterSpacing: 4, textAlign: "center" },
  btn: { marginTop: 24, backgroundColor: C.primary, paddingVertical: 16, borderRadius: 14, alignItems: "center" },
  btnText: { color: "#0A0612", fontWeight: "900", fontSize: 15 },
});
