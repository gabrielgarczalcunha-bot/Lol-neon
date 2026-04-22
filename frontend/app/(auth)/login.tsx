import React, { useState } from "react";
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform,
  ScrollView, ActivityIndicator, Alert,
} from "react-native";
import { useRouter, Link } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "../../src/AuthContext";
import { C } from "../../src/theme";
import { formatApiError } from "../../src/api";

export default function Login() {
  const { login } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPass, setShowPass] = useState(false);

  const onSubmit = async () => {
    if (!email || !password) {
      Alert.alert("Atenção", "Preencha email e senha.");
      return;
    }
    setLoading(true);
    try {
      await login(email.trim(), password);
      router.replace("/(tabs)");
    } catch (e: any) {
      Alert.alert("Erro", formatApiError(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={s.safe} edges={["top", "bottom"]}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
          <View style={s.brand}>
            <View style={s.logoBox}>
              <Ionicons name="shield-checkmark" size={36} color="#fff" />
            </View>
            <Text style={s.brandTitle}>LotePro</Text>
            <Text style={s.brandSub}>Investimentos com rendimento diário</Text>
          </View>

          <View style={s.card}>
            <Text style={s.h1}>Entrar</Text>
            <Text style={s.sub}>Acesse sua conta para gerenciar seus lotes</Text>

            <Text style={s.label}>Email</Text>
            <View style={s.inputWrap}>
              <Ionicons name="mail-outline" size={18} color={C.textMuted} />
              <TextInput
                testID="login-email-input"
                style={s.input}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
                placeholder="voce@exemplo.com"
                placeholderTextColor={C.textMuted}
                value={email}
                onChangeText={setEmail}
              />
            </View>

            <Text style={s.label}>Senha</Text>
            <View style={s.inputWrap}>
              <Ionicons name="lock-closed-outline" size={18} color={C.textMuted} />
              <TextInput
                testID="login-password-input"
                style={s.input}
                secureTextEntry={!showPass}
                placeholder="••••••••"
                placeholderTextColor={C.textMuted}
                value={password}
                onChangeText={setPassword}
              />
              <TouchableOpacity onPress={() => setShowPass(v => !v)} testID="login-toggle-password">
                <Ionicons name={showPass ? "eye-off-outline" : "eye-outline"} size={18} color={C.textMuted} />
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              testID="login-submit-button"
              style={[s.btn, loading && { opacity: 0.7 }]}
              onPress={onSubmit}
              disabled={loading}
            >
              {loading ? <ActivityIndicator color="#fff" /> : <Text style={s.btnText}>Entrar</Text>}
            </TouchableOpacity>

            <View style={s.footer}>
              <Text style={s.footerText}>Não tem conta?</Text>
              <Link href="/(auth)/register" asChild>
                <TouchableOpacity testID="go-register-link"><Text style={s.link}>Cadastre-se</Text></TouchableOpacity>
              </Link>
            </View>
          </View>

          <TouchableOpacity onPress={() => router.push("/sobre")} testID="about-link">
            <Text style={s.aboutLink}>Sobre a empresa e licença</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  scroll: { padding: 24, flexGrow: 1, justifyContent: "center" },
  brand: { alignItems: "center", marginBottom: 28 },
  logoBox: {
    width: 72, height: 72, borderRadius: 20, backgroundColor: C.primary,
    alignItems: "center", justifyContent: "center",
    shadowColor: C.primary, shadowOpacity: 0.25, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 6,
  },
  brandTitle: { fontSize: 30, fontWeight: "800", color: C.textPrimary, marginTop: 14, letterSpacing: -0.5 },
  brandSub: { fontSize: 14, color: C.textSecondary, marginTop: 4 },
  card: {
    backgroundColor: "#fff", borderRadius: 20, padding: 22, borderWidth: 1, borderColor: C.border,
    shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 18, shadowOffset: { width: 0, height: 4 }, elevation: 3,
  },
  h1: { fontSize: 22, fontWeight: "800", color: C.textPrimary },
  sub: { fontSize: 13, color: C.textSecondary, marginTop: 4, marginBottom: 18 },
  label: { fontSize: 13, fontWeight: "600", color: C.textPrimary, marginTop: 10, marginBottom: 6 },
  inputWrap: {
    flexDirection: "row", alignItems: "center", gap: 10,
    backgroundColor: C.surface, borderWidth: 1, borderColor: C.border,
    borderRadius: 12, paddingHorizontal: 14, paddingVertical: Platform.OS === "ios" ? 14 : 8,
  },
  input: { flex: 1, fontSize: 15, color: C.textPrimary, paddingVertical: 6 },
  btn: {
    marginTop: 22, backgroundColor: C.primary, borderRadius: 14, paddingVertical: 16,
    alignItems: "center", justifyContent: "center",
    shadowColor: C.primary, shadowOpacity: 0.3, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 4,
  },
  btnText: { color: "#fff", fontWeight: "800", fontSize: 16, letterSpacing: 0.2 },
  footer: { flexDirection: "row", justifyContent: "center", gap: 6, marginTop: 18 },
  footerText: { color: C.textSecondary },
  link: { color: C.primary, fontWeight: "700" },
  aboutLink: { textAlign: "center", color: C.textMuted, marginTop: 18, fontSize: 12 },
});
