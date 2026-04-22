import React, { useEffect, useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, ActivityIndicator, Alert, Platform, KeyboardAvoidingView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { api, fmtBRL, formatApiError } from "../src/api";
import { C } from "../src/theme";

const KEY_TYPES = [
  { k: "cpf", label: "CPF" },
  { k: "email", label: "Email" },
  { k: "telefone", label: "Telefone" },
  { k: "aleatoria", label: "Aleatória" },
];

export default function Saque() {
  const router = useRouter();
  const [balance, setBalance] = useState(0);
  const [amount, setAmount] = useState("");
  const [pixKey, setPixKey] = useState("");
  const [keyType, setKeyType] = useState<"cpf" | "email" | "telefone" | "aleatoria">("aleatoria");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get("/wallet");
        setBalance(data.balance || 0);
      } catch {}
    })();
  }, []);

  const submit = async () => {
    const v = parseFloat(amount.replace(",", "."));
    if (!v || v <= 0) { Alert.alert("Atenção", "Informe um valor válido."); return; }
    if (v > balance) { Alert.alert("Atenção", "Saldo insuficiente."); return; }
    if (!pixKey.trim()) { Alert.alert("Atenção", "Informe a chave PIX de destino."); return; }
    setLoading(true);
    try {
      await api.post("/withdrawals", { amount: v, pix_key: pixKey.trim(), pix_key_type: keyType });
      Alert.alert("Saque solicitado", "Seu saque foi registrado e será processado em até 24h.", [
        { text: "OK", onPress: () => router.replace("/(tabs)/carteira") },
      ]);
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
            <TouchableOpacity onPress={() => setAmount(String(balance.toFixed(2)))} testID="withdraw-max">
              <Text style={s.max}>Usar saldo total</Text>
            </TouchableOpacity>
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
          </View>

          <View style={s.info}>
            <Ionicons name="time-outline" size={16} color={C.primaryDark} />
            <Text style={s.infoText}>
              O valor será reservado imediatamente e repassado via PIX em até 24h após aprovação.
            </Text>
          </View>

          <TouchableOpacity style={[s.btn, loading && { opacity: 0.7 }]} onPress={submit} disabled={loading} testID="withdraw-submit">
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={s.btnText}>Solicitar saque</Text>}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.surface },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: C.border, backgroundColor: "#fff" },
  back: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  h1: { color: C.textPrimary, fontSize: 17, fontWeight: "800" },

  balanceCard: { backgroundColor: C.primary, borderRadius: 18, padding: 20, marginBottom: 16 },
  balanceLabel: { color: "#D1FAE5", fontSize: 12 },
  balanceValue: { color: "#fff", fontSize: 26, fontWeight: "800", marginTop: 4 },

  card: { backgroundColor: "#fff", borderRadius: 18, padding: 18, borderWidth: 1, borderColor: C.border, marginBottom: 14 },
  label: { color: C.textSecondary, fontSize: 13, fontWeight: "600" },
  amountRow: { flexDirection: "row", alignItems: "flex-end", gap: 10, marginTop: 10, borderBottomWidth: 2, borderBottomColor: C.primary, paddingBottom: 10 },
  currency: { color: C.textPrimary, fontSize: 20, fontWeight: "700", marginBottom: 6 },
  amountInput: { flex: 1, fontSize: 32, fontWeight: "800", color: C.textPrimary, padding: 0 },
  max: { color: C.primary, fontWeight: "700", fontSize: 12, marginTop: 10 },

  chips: { flexDirection: "row", gap: 8, marginTop: 10, flexWrap: "wrap" },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: C.surface, borderWidth: 1, borderColor: C.border },
  chipActive: { backgroundColor: C.primary, borderColor: C.primary },
  chipText: { color: C.textSecondary, fontWeight: "700", fontSize: 12 },
  input: { backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 14, color: C.textPrimary, marginTop: 6 },

  info: { flexDirection: "row", gap: 8, padding: 12, backgroundColor: C.primaryLight, borderRadius: 12 },
  infoText: { flex: 1, color: C.primaryDark, fontSize: 12, lineHeight: 18 },

  btn: { marginTop: 18, backgroundColor: C.primary, paddingVertical: 16, borderRadius: 14, alignItems: "center" },
  btnText: { color: "#fff", fontWeight: "800", fontSize: 16 },
});
