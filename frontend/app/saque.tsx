import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, ActivityIndicator, Alert, Platform, KeyboardAvoidingView, Modal,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import { api, fmtBRL, formatApiError, loadToken } from "../src/api";
import { C } from "../src/theme";

const KEY_TYPES = [
  { k: "cpf", label: "CPF" },
  { k: "email", label: "Email" },
  { k: "telefone", label: "Telefone" },
  { k: "aleatoria", label: "Aleatória" },
];

type Rules = { is_first_withdrawal: boolean; min_amount: number; tax_pct: number; message: string };

export default function Saque() {
  const router = useRouter();
  const [balance, setBalance] = useState(0);
  const [rules, setRules] = useState<Rules | null>(null);
  const [hasWPwd, setHasWPwd] = useState<boolean>(false);
  const [amount, setAmount] = useState("");
  const [pixKey, setPixKey] = useState("");
  const [keyType, setKeyType] = useState<"cpf" | "email" | "telefone" | "aleatoria">("aleatoria");
  const [withdrawPassword, setWithdrawPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [successOpen, setSuccessOpen] = useState(false);

  useFocusEffect(useCallback(() => {
    let cancelled = false;
    (async () => {
      const token = await loadToken();
      if (!token || cancelled) return;
      try {
        const [w, r, me] = await Promise.all([api.get("/wallet"), api.get("/withdrawals/rules"), api.get("/auth/me")]);
        if (cancelled) return;
        setBalance(w.data.balance || 0);
        setRules(r.data);
        setHasWPwd(!!me.data.has_withdraw_password);
      } catch (e: any) {
        if (!cancelled) Alert.alert("Erro", formatApiError(e));
      }
    })();
    return () => { cancelled = true; };
  }, []));

  const gross = parseFloat(amount.replace(",", ".")) || 0;
  const taxPct = rules?.tax_pct || 0;
  const taxAmount = useMemo(() => +(gross * taxPct / 100).toFixed(2), [gross, taxPct]);
  const netAmount = useMemo(() => +(gross - taxAmount).toFixed(2), [gross, taxAmount]);

  const submit = async () => {
    if (!rules) return;
    if (!hasWPwd) {
      Alert.alert(
        "Senha de saque necessária",
        "Cadastre uma senha de saque para continuar.",
        [{ text: "Cadastrar agora", onPress: () => router.push("/senha-saque?redirect=saque") }]
      );
      return;
    }
    if (!gross || gross <= 0) { Alert.alert("Atenção", "Informe um valor válido."); return; }
    if (gross < rules.min_amount) {
      Alert.alert("Atenção", `Valor mínimo: ${fmtBRL(rules.min_amount)}`);
      return;
    }
    if (gross > balance) { Alert.alert("Atenção", "Saldo insuficiente."); return; }
    if (!pixKey.trim()) { Alert.alert("Atenção", "Informe a chave PIX de destino."); return; }
    if (!withdrawPassword) { Alert.alert("Atenção", "Informe sua senha de saque."); return; }

    setLoading(true);
    try {
      await api.post("/withdrawals", {
        amount: gross, pix_key: pixKey.trim(), pix_key_type: keyType,
        withdraw_password: withdrawPassword,
      });
      setSuccessOpen(true);
    } catch (e: any) {
      Alert.alert("Erro", formatApiError(e));
    } finally {
      setLoading(false);
    }
  };

  if (!rules) {
    return <SafeAreaView style={s.safe}><View style={s.center}><ActivityIndicator color={C.primary} /></View></SafeAreaView>;
  }

  return (
    <SafeAreaView style={s.safe} edges={["top", "bottom"]}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <View style={s.header}>
          <TouchableOpacity onPress={() => router.back()} style={s.back} testID="withdraw-back">
            <Ionicons name="chevron-back" size={22} color={C.textPrimary} />
          </TouchableOpacity>
          <Text style={s.h1}>Sacar via PIX</Text>
          <View style={{ width: 36 }} />
        </View>

        <ScrollView contentContainerStyle={{ padding: 20 }} keyboardShouldPersistTaps="handled">
          <View style={s.balanceCard}>
            <Text style={s.balanceLabel}>Saldo disponível</Text>
            <Text style={s.balanceValue}>{fmtBRL(balance)}</Text>
          </View>

          <View style={[s.rules, rules.is_first_withdrawal ? { borderColor: C.primary } : { borderColor: C.pending }]}>
            <Ionicons
              name={rules.is_first_withdrawal ? "gift" : "receipt"}
              size={18}
              color={rules.is_first_withdrawal ? C.primary : C.pending}
            />
            <Text style={s.rulesText}>{rules.message}</Text>
          </View>

          <View style={s.card}>
            <Text style={s.label}>Valor do saque</Text>
            <View style={s.amountRow}>
              <Text style={s.currency}>R$</Text>
              <TextInput
                testID="withdraw-amount-input"
                style={s.amountInput}
                placeholder="0,00"
                placeholderTextColor={C.textMuted}
                keyboardType="decimal-pad"
                value={amount}
                onChangeText={setAmount}
              />
            </View>
            <View style={s.quickRow}>
              <Text style={s.hint}>Mín. {fmtBRL(rules.min_amount)}</Text>
              <TouchableOpacity onPress={() => setAmount(String(balance.toFixed(2)))} testID="withdraw-max">
                <Text style={s.max}>Usar saldo total</Text>
              </TouchableOpacity>
            </View>

            {gross > 0 && taxPct > 0 && (
              <View style={s.breakdown}>
                <Row k="Valor solicitado" v={fmtBRL(gross)} />
                <Row k={`Taxa (${taxPct}%)`} v={`- ${fmtBRL(taxAmount)}`} negative />
                <View style={s.sep} />
                <Row k="Você recebe" v={fmtBRL(netAmount)} highlight />
              </View>
            )}
          </View>

          <View style={s.card}>
            <Text style={s.label}>Tipo de chave PIX</Text>
            <View style={s.chips}>
              {KEY_TYPES.map((k) => (
                <TouchableOpacity
                  key={k.k}
                  style={[s.chip, keyType === k.k && s.chipActive]}
                  onPress={() => setKeyType(k.k as any)}
                  testID={`keytype-${k.k}`}
                >
                  <Text style={[s.chipText, keyType === k.k && { color: "#fff" }]}>{k.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={[s.label, { marginTop: 14 }]}>Chave PIX de destino</Text>
            <TextInput
              testID="withdraw-pix-key"
              style={s.input}
              placeholder="Sua chave PIX"
              placeholderTextColor={C.textMuted}
              value={pixKey}
              onChangeText={setPixKey}
              autoCapitalize="none"
            />

            <Text style={[s.label, { marginTop: 14 }]}>Senha de saque</Text>
            <TextInput
              testID="withdraw-password"
              style={s.input}
              placeholder={hasWPwd ? "Sua senha de saque" : "Cadastre antes no Perfil"}
              placeholderTextColor={C.textMuted}
              value={withdrawPassword}
              onChangeText={setWithdrawPassword}
              secureTextEntry
              keyboardType="number-pad"
              editable={hasWPwd}
            />
            {!hasWPwd && (
              <TouchableOpacity onPress={() => router.push("/senha-saque?redirect=saque")} testID="go-create-withdraw-pwd">
                <Text style={{ color: C.primary, fontWeight: "700", marginTop: 8, fontSize: 12 }}>+ Cadastrar senha de saque</Text>
              </TouchableOpacity>
            )}
          </View>

          <View style={s.info}>
            <Ionicons name="time-outline" size={16} color={C.primaryDark} />
            <Text style={s.infoText}>O valor é reservado no momento do pedido e enviado via PIX em até 24h após aprovação.</Text>
          </View>

          <TouchableOpacity style={[s.btn, loading && { opacity: 0.7 }]} onPress={submit} disabled={loading} testID="withdraw-submit">
            {loading ? <ActivityIndicator color="#0A0612" /> : <Text style={s.btnText}>Solicitar saque</Text>}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>

      <Modal visible={successOpen} transparent animationType="fade" onRequestClose={() => {}}>
        <View style={s.successBg}>
          <View style={s.successCard}>
            <View style={s.successIcon}><Ionicons name="checkmark-circle" size={56} color={C.primary} /></View>
            <Text style={s.successTitle}>Saque solicitado!</Text>
            <Text style={s.successDesc}>
              Aguarde até <Text style={{ fontWeight: "800", color: C.primary }}>24 horas</Text> para a aprovação do seu saque.{"\n\n"}
              Você receberá o PIX assim que o administrador aprovar.
            </Text>
            <TouchableOpacity
              style={s.successBtn}
              onPress={() => { setSuccessOpen(false); router.replace("/(tabs)"); }}
              testID="withdraw-success-ok"
            >
              <Text style={s.successBtnText}>Entendi</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function Row({ k, v, negative, highlight }: any) {
  return (
    <View style={s.brRow}>
      <Text style={[s.brKey, highlight && { color: C.textPrimary, fontWeight: "700" }]}>{k}</Text>
      <Text style={[s.brVal, negative && { color: C.danger }, highlight && { color: C.primary, fontSize: 17, fontWeight: "800" }]}>{v}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.surface },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: C.border, backgroundColor: C.card },
  back: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  h1: { color: C.textPrimary, fontSize: 17, fontWeight: "800" },

  balanceCard: { backgroundColor: C.primary, borderRadius: 18, padding: 20, marginBottom: 12 },
  balanceLabel: { color: "#D1FAE5", fontSize: 12 },
  balanceValue: { color: "#fff", fontSize: 26, fontWeight: "800", marginTop: 4 },

  rules: { flexDirection: "row", gap: 10, alignItems: "center", padding: 12, borderRadius: 12, backgroundColor: C.card, borderWidth: 1, marginBottom: 12 },
  rulesText: { flex: 1, color: C.textPrimary, fontSize: 12, fontWeight: "600" },

  card: { backgroundColor: C.card, borderRadius: 18, padding: 18, borderWidth: 1, borderColor: C.border, marginBottom: 12 },
  label: { color: C.textSecondary, fontSize: 13, fontWeight: "600" },
  amountRow: { flexDirection: "row", alignItems: "flex-end", gap: 10, marginTop: 10, borderBottomWidth: 2, borderBottomColor: C.primary, paddingBottom: 10 },
  currency: { color: C.textPrimary, fontSize: 20, fontWeight: "700", marginBottom: 6 },
  amountInput: { flex: 1, fontSize: 32, fontWeight: "800", color: C.textPrimary, padding: 0 },
  quickRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 10 },
  hint: { color: C.textMuted, fontSize: 12 },
  max: { color: C.primary, fontWeight: "700", fontSize: 12 },

  breakdown: { marginTop: 14, padding: 12, borderRadius: 10, backgroundColor: C.surface, borderWidth: 1, borderColor: C.border },
  brRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 4 },
  brKey: { color: C.textSecondary, fontSize: 13 },
  brVal: { color: C.textPrimary, fontSize: 13, fontWeight: "600" },
  sep: { height: 1, backgroundColor: C.border, marginVertical: 6 },

  chips: { flexDirection: "row", gap: 8, marginTop: 10, flexWrap: "wrap" },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: C.surface, borderWidth: 1, borderColor: C.border },
  chipActive: { backgroundColor: C.primary, borderColor: C.primary },
  chipText: { color: C.textSecondary, fontWeight: "700", fontSize: 12 },
  input: { backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 14, color: C.textPrimary, marginTop: 6 },

  info: { flexDirection: "row", gap: 8, padding: 12, backgroundColor: C.primaryLight, borderRadius: 12 },
  infoText: { flex: 1, color: C.primaryDark, fontSize: 12, lineHeight: 18 },

  btn: { marginTop: 18, backgroundColor: C.primary, paddingVertical: 16, borderRadius: 14, alignItems: "center" },
  btnText: { color: "#0A0612", fontWeight: "900", fontSize: 16 },
  successBg: { flex: 1, backgroundColor: "rgba(0,0,0,0.8)", alignItems: "center", justifyContent: "center", padding: 24 },
  successCard: { backgroundColor: C.card, borderRadius: 22, padding: 28, width: "100%", maxWidth: 380, borderWidth: 1, borderColor: C.border, alignItems: "center" },
  successIcon: { width: 90, height: 90, borderRadius: 45, backgroundColor: C.primaryLight, alignItems: "center", justifyContent: "center" },
  successTitle: { color: C.textPrimary, fontSize: 22, fontWeight: "900", marginTop: 14, textAlign: "center" },
  successDesc: { color: C.textSecondary, marginTop: 12, fontSize: 14, lineHeight: 22, textAlign: "center" },
  successBtn: { marginTop: 22, backgroundColor: C.primary, paddingVertical: 14, borderRadius: 12, alignItems: "center", alignSelf: "stretch" },
  successBtnText: { color: "#0A0612", fontWeight: "900", fontSize: 15 },
});
