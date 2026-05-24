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

export default function Register() {
  const { register } = useAuth();
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const onSubmit = async () => {
    if (!name.trim() || !email.trim() || !password) {
      Alert.alert("Atenção", "Preencha todos os campos.");
      return;
    }
    if (password.length < 6) {
      Alert.alert("Atenção", "Senha deve ter no mínimo 6 caracteres.");
      return;
    }
    setLoading(true);
    try {
      await register(name.trim(), email.trim(), password);
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
          <TouchableOpacity onPress={() => router.back()} style={s.back} testID="register-back-button">
            <Ionicons name="chevron-back" size={24} color={C.textPrimary} />
          </TouchableOpacity>

          <Text style={s.h1}>Criar conta</Text>
          <Text style={s.sub}>Comece a investir em poucos segundos</Text>

          <View style={s.card}>
            <Text style={s.label}>Nome completo</Text>
            <View style={s.inputWrap}>
              <Ionicons name="person-outline" size={18} color={C.textMuted} />
              <TextInput
                testID="register-name-input"
                style={s.input}
                placeholder="Seu nome"
                placeholderTextColor={C.textMuted}
                value={name}
                onChangeText={setName}
              />
            </View>

            <Text style={s.label}>Email</Text>
            <View style={s.inputWrap}>
              <Ionicons name="mail-outline" size={18} color={C.textMuted} />
              <TextInput
                testID="register-email-input"
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
                testID="register-password-input"
                style={s.input}
                secureTextEntry
                placeholder="Mínimo 6 caracteres"
                placeholderTextColor={C.textMuted}
                value={password}
                onChangeText={setPassword}
              />
            </View>

            <TouchableOpacity
              testID="register-submit-button"
              style={[s.btn, loading && { opacity: 0.7 }]}
              onPress={onSubmit}
              disabled={loading}
            >
              {loading ? <ActivityIndicator color="#fff" /> : <Text style={s.btnText}>Criar conta</Text>}
            </TouchableOpacity>

            <View style={s.footer}>
              <Text style={s.footerText}>Já tem conta?</Text>
              <Link href="/(auth)/login" asChild>
                <TouchableOpacity testID="go-login-link"><Text style={s.link}>Entrar</Text></TouchableOpacity>
              </Link>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  scroll: { padding: 24, flexGrow: 1 },
  back: { width: 40, height: 40, alignItems: "flex-start", justifyContent: "center" },
  h1: { fontSize: 28, fontWeight: "800", color: C.textPrimary, marginTop: 8 },
  sub: { color: C.textSecondary, marginTop: 4, marginBottom: 20 },
  card: {
    backgroundColor: C.card, borderRadius: 20, padding: 22, borderWidth: 1, borderColor: C.border,
    shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 18, shadowOffset: { width: 0, height: 4 }, elevation: 3,
  },
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
  btnText: { color: "#fff", fontWeight: "800", fontSize: 16 },
  footer: { flexDirection: "row", justifyContent: "center", gap: 6, marginTop: 18 },
  footerText: { color: C.textSecondary },
  link: { color: C.primary, fontWeight: "700" },
});
