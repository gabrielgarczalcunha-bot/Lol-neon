import React, { useEffect, useState } from "react";
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform,
  ScrollView, ActivityIndicator, Alert, Modal,
} from "react-native";
import { useRouter, Link } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "../../src/AuthContext";
import { C } from "../../src/theme";
import { formatApiError, api, getApiBase, saveApiUrl, clearApiUrlOverride, DEFAULT_API_BASE } from "../../src/api";

export default function Login() {
  const { login } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPass, setShowPass] = useState(false);
  const [serverStatus, setServerStatus] = useState<"checking" | "online" | "offline">("checking");
  const [apiUrl, setApiUrl] = useState(getApiBase());

  // Settings modal
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [draftUrl, setDraftUrl] = useState(apiUrl);
  const [savingUrl, setSavingUrl] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; msg: string } | null>(null);

  const openSettings = () => {
    setDraftUrl(getApiBase());
    setTestResult(null);
    setSettingsOpen(true);
  };

  const checkServer = async () => {
    setServerStatus("checking");
    try {
      await api.get("/", { timeout: 6000 });
      setServerStatus("online");
    } catch {
      setServerStatus("offline");
    }
  };

  useEffect(() => {
    setApiUrl(getApiBase());
    checkServer();
  }, []);

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
      const status = e?.response?.status;
      const isConn = !e?.response || e?.code === "ERR_NETWORK" || e?.message === "Network Error" || e?.code === "ECONNABORTED";
      if (status === 404 || isConn) {
        // Auto-offer to fix the server URL
        Alert.alert(
          "Servidor não encontrado",
          `${formatApiError(e)}\n\nTrocar a URL do servidor agora?`,
          [
            { text: "Agora não", style: "cancel" },
            { text: "Trocar URL", onPress: openSettings },
          ]
        );
      } else {
        Alert.alert("Erro", formatApiError(e));
      }
    } finally {
      setLoading(false);
    }
  };

  const onDemoLogin = async () => {
    setDemoLoading(true);
    try {
      await loginDemo();
      router.replace("/(tabs)");
    } catch (e: any) {
      Alert.alert("Erro", formatApiError(e));
    } finally {
      setDemoLoading(false);
    }
  };

  const testDraft = async () => {
    const url = (draftUrl || "").trim().replace(/\/+$/, "");
    if (!url) {
      setTestResult({ ok: false, msg: "Informe uma URL" });
      return;
    }
    if (!/^https?:\/\//i.test(url)) {
      setTestResult({ ok: false, msg: "URL deve começar com http:// ou https://" });
      return;
    }
    setTestResult({ ok: false, msg: "Testando…" });
    try {
      const resp = await fetch(`${url}/api/`, { method: "GET" });
      if (resp.ok) {
        setTestResult({ ok: true, msg: "✓ Servidor respondeu (200 OK)" });
      } else {
        setTestResult({ ok: false, msg: `Servidor respondeu ${resp.status}` });
      }
    } catch (e: any) {
      setTestResult({ ok: false, msg: "Não conseguiu conectar. Verifique a URL e a internet." });
    }
  };

  const saveUrl = async () => {
    setSavingUrl(true);
    try {
      await saveApiUrl(draftUrl);
      setApiUrl(getApiBase());
      setSettingsOpen(false);
      setTestResult(null);
      await checkServer();
    } catch (e: any) {
      Alert.alert("Erro", "Não foi possível salvar a URL.");
    } finally {
      setSavingUrl(false);
    }
  };

  const restoreDefault = async () => {
    setSavingUrl(true);
    try {
      await clearApiUrlOverride();
      setApiUrl(getApiBase());
      setDraftUrl(getApiBase());
      setTestResult(null);
      await checkServer();
    } finally {
      setSavingUrl(false);
    }
  };

  return (
    <SafeAreaView style={s.safe} edges={["top", "bottom"]}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
        {/* Gear icon for server URL config */}
        <TouchableOpacity
          style={s.gearBtn}
          onPress={() => { setDraftUrl(apiUrl); setTestResult(null); setSettingsOpen(true); }}
          testID="login-settings-gear"
        >
          <Ionicons name="settings-outline" size={20} color={C.textMuted} />
        </TouchableOpacity>

        <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
          <View style={s.brand}>
            <View style={s.logoBox}>
              <Ionicons name="shield-checkmark" size={36} color="#0A0612" />
            </View>
            <Text style={s.brandTitle}>Neon Farm</Text>
            <Text style={s.brandSub}>Cultive seus rendimentos</Text>
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
              {loading ? <ActivityIndicator color="#0A0612" /> : <Text style={s.btnText}>Entrar</Text>}
            </TouchableOpacity>

            <TouchableOpacity onPress={openSettings} style={s.urlBtn} testID="login-change-url">
              <Ionicons name="globe-outline" size={14} color={C.textSecondary} />
              <Text style={s.urlBtnText}>Configurar servidor</Text>
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

          <TouchableOpacity onPress={checkServer} style={s.serverInfo} testID="check-server">
            <View style={[s.dot,
              serverStatus === "online" && { backgroundColor: C.primary },
              serverStatus === "offline" && { backgroundColor: C.danger },
              serverStatus === "checking" && { backgroundColor: C.textMuted }
            ]} />
            <Text style={s.serverText}>
              {serverStatus === "online" ? "Servidor online" : serverStatus === "offline" ? "Servidor offline — toque aqui ou ajuste a URL ⚙️" : "Verificando servidor…"}
            </Text>
          </TouchableOpacity>
          <Text style={s.serverUrl} selectable numberOfLines={1}>{apiUrl}</Text>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Server URL Settings Modal */}
      <Modal visible={settingsOpen} transparent animationType="slide" onRequestClose={() => !savingUrl && setSettingsOpen(false)}>
        <View style={s.modalBg}>
          <View style={s.modalCard}>
            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>Servidor do app</Text>
              <TouchableOpacity onPress={() => setSettingsOpen(false)} disabled={savingUrl} testID="settings-close">
                <Ionicons name="close" size={24} color={C.textPrimary} />
              </TouchableOpacity>
            </View>

            <Text style={s.modalDesc}>
              Se o app não está conseguindo conectar, ajuste a URL do servidor abaixo. Você não precisa reinstalar o app para isso funcionar.
            </Text>

            <Text style={s.modalLabel}>URL do servidor</Text>
            <TextInput
              testID="settings-url-input"
              style={s.modalInput}
              value={draftUrl}
              onChangeText={(t) => { setDraftUrl(t); setTestResult(null); }}
              placeholder="https://meuservidor.com"
              placeholderTextColor={C.textMuted}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
            />
            <Text style={s.modalHint}>
              Exemplo: https://neonfarm-abc.emergent.host{"\n"}
              Não inclua /api no final — o app adiciona automaticamente.
            </Text>

            {testResult && (
              <View style={[s.testBox, testResult.ok ? s.testOk : s.testFail]}>
                <Ionicons name={testResult.ok ? "checkmark-circle" : "alert-circle"} size={16} color={testResult.ok ? C.primary : C.danger} />
                <Text style={[s.testText, { color: testResult.ok ? C.primary : C.danger }]}>{testResult.msg}</Text>
              </View>
            )}

            <View style={s.modalActions}>
              <TouchableOpacity style={[s.modalBtn, s.modalBtnGhost]} onPress={testDraft} disabled={savingUrl} testID="settings-test">
                <Ionicons name="flash-outline" size={16} color={C.primary} />
                <Text style={[s.modalBtnTextGhost]}>Testar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.modalBtn, s.modalBtnPrimary, savingUrl && { opacity: 0.6 }]}
                onPress={saveUrl}
                disabled={savingUrl}
                testID="settings-save"
              >
                {savingUrl ? <ActivityIndicator color="#0A0612" /> : (
                  <>
                    <Ionicons name="checkmark" size={16} color="#0A0612" />
                    <Text style={s.modalBtnTextPrimary}>Salvar e usar</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>

            <TouchableOpacity style={s.restoreBtn} onPress={restoreDefault} disabled={savingUrl} testID="settings-restore">
              <Text style={s.restoreText}>Restaurar URL padrão</Text>
            </TouchableOpacity>

            <Text style={s.defaultUrl} selectable numberOfLines={1}>Padrão: {DEFAULT_API_BASE}</Text>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  gearBtn: { position: "absolute", top: 20, right: 20, width: 40, height: 40, borderRadius: 20, backgroundColor: C.card, borderWidth: 1, borderColor: C.border, alignItems: "center", justifyContent: "center", zIndex: 10 },
  scroll: { padding: 24, flexGrow: 1, justifyContent: "center" },
  brand: { alignItems: "center", marginBottom: 28 },
  logoBox: {
    width: 72, height: 72, borderRadius: 20, backgroundColor: C.primary,
    alignItems: "center", justifyContent: "center",
    shadowColor: C.primary, shadowOpacity: 0.4, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 6,
  },
  brandTitle: { fontSize: 30, fontWeight: "800", color: C.textPrimary, marginTop: 14, letterSpacing: -0.5 },
  brandSub: { fontSize: 14, color: C.textSecondary, marginTop: 4 },
  card: {
    backgroundColor: C.card, borderRadius: 20, padding: 22, borderWidth: 1, borderColor: C.border,
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
  },
  btnText: { color: "#0A0612", fontWeight: "800", fontSize: 16, letterSpacing: 0.2 },
  urlBtn: { marginTop: 12, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 10 },
  urlBtnText: { color: C.textSecondary, fontSize: 12, fontWeight: "700", textDecorationLine: "underline" },
  footer: { flexDirection: "row", justifyContent: "center", gap: 6, marginTop: 18 },
  footerText: { color: C.textSecondary },
  link: { color: C.primary, fontWeight: "700" },
  aboutLink: { textAlign: "center", color: C.textMuted, marginTop: 18, fontSize: 12 },
  serverInfo: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, marginTop: 16 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: C.textMuted },
  serverText: { color: C.textMuted, fontSize: 11 },
  serverUrl: { color: C.textMuted, fontSize: 10, textAlign: "center", marginTop: 3, opacity: 0.6, paddingHorizontal: 16 },

  modalBg: { flex: 1, backgroundColor: "rgba(0,0,0,0.8)", justifyContent: "flex-end" },
  modalCard: { backgroundColor: C.card, borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: 24, paddingBottom: 36 },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  modalTitle: { color: C.textPrimary, fontSize: 18, fontWeight: "800" },
  modalDesc: { color: C.textSecondary, marginTop: 8, fontSize: 13, lineHeight: 18 },
  modalLabel: { color: C.textSecondary, marginTop: 18, fontSize: 12, fontWeight: "700" },
  modalInput: { marginTop: 6, backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, borderRadius: 12, padding: 14, color: C.textPrimary, fontSize: 14, fontFamily: Platform.OS === "ios" ? "Courier" : "monospace" },
  modalHint: { color: C.textMuted, fontSize: 11, marginTop: 6, lineHeight: 16 },
  testBox: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 12, padding: 10, borderRadius: 10, borderWidth: 1 },
  testOk: { backgroundColor: C.primaryLight, borderColor: C.primary },
  testFail: { backgroundColor: "#2A0E12", borderColor: C.danger },
  testText: { fontSize: 12, fontWeight: "700", flex: 1 },
  modalActions: { flexDirection: "row", gap: 10, marginTop: 18 },
  modalBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 14, borderRadius: 12 },
  modalBtnGhost: { backgroundColor: C.surfaceAlt, borderWidth: 1, borderColor: C.border },
  modalBtnPrimary: { backgroundColor: C.primary },
  modalBtnTextGhost: { color: C.primary, fontWeight: "800", fontSize: 13 },
  modalBtnTextPrimary: { color: "#0A0612", fontWeight: "800", fontSize: 13 },
  restoreBtn: { alignSelf: "center", padding: 10, marginTop: 14 },
  restoreText: { color: C.textMuted, fontSize: 12, textDecorationLine: "underline" },
  defaultUrl: { color: C.textMuted, fontSize: 10, textAlign: "center", marginTop: 6, opacity: 0.6 },
});
