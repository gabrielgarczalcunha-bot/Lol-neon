import React, { useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, ActivityIndicator, Alert, Platform,
  KeyboardAvoidingView, Image,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import * as ImagePicker from "expo-image-picker";
import QRCode from "react-native-qrcode-svg";
import { useRouter } from "expo-router";
import { api, fmtBRL, formatApiError } from "../src/api";
import { C } from "../src/theme";

export default function Deposito() {
  const router = useRouter();
  const [step, setStep] = useState<"amount" | "pix" | "proof">("amount");
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(false);
  const [pix, setPix] = useState<{ pix_key: string; payload: string; company_name: string; pix_key_type: string } | null>(null);
  const [proof, setProof] = useState<string | null>(null);

  const next = async () => {
    const v = parseFloat(amount.replace(",", "."));
    if (!v || v <= 0) { Alert.alert("Atenção", "Informe um valor válido."); return; }
    if (v < 1) { Alert.alert("Atenção", "Valor mínimo: R$ 1,00"); return; }
    setLoading(true);
    try {
      const { data } = await api.get("/settings/pix", { params: { amount: v } });
      setPix(data);
      setStep("pix");
    } catch (e: any) {
      Alert.alert("Erro", formatApiError(e));
    } finally {
      setLoading(false);
    }
  };

  const copy = async (what: string) => {
    await Clipboard.setStringAsync(what);
    Alert.alert("Copiado!", "Cole no app do seu banco.");
  };

  const pickProof = async () => {
    const r = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.6, base64: true, allowsEditing: false,
    });
    if (!r.canceled && r.assets[0]?.base64) {
      setProof(`data:image/jpeg;base64,${r.assets[0].base64}`);
    }
  };

  const submit = async () => {
    if (!proof) {
      Alert.alert("Atenção", "Envie o comprovante do pagamento para aprovação.");
      return;
    }
    const v = parseFloat(amount.replace(",", "."));
    setLoading(true);
    try {
      await api.post("/deposits", { amount: v, proof_image: proof });
      Alert.alert(
        "Solicitação enviada!",
        "Seu comprovante foi recebido. Assim que o pagamento for confirmado pelo nosso time, o saldo será creditado na sua carteira.",
        [{ text: "OK", onPress: () => router.replace("/(tabs)/carteira") }]
      );
    } catch (e: any) {
      Alert.alert("Erro", formatApiError(e));
    } finally {
      setLoading(false);
    }
  };

  const goBack = () => {
    if (step === "proof") setStep("pix");
    else if (step === "pix") setStep("amount");
    else router.back();
  };

  return (
    <SafeAreaView style={s.safe} edges={["top", "bottom"]}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <View style={s.header}>
          <TouchableOpacity onPress={goBack} style={s.back} testID="deposit-back">
            <Ionicons name="chevron-back" size={22} color={C.textPrimary} />
          </TouchableOpacity>
          <Text style={s.h1}>Depositar via PIX</Text>
          <View style={{ width: 36 }} />
        </View>

        <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 60 }} keyboardShouldPersistTaps="handled">
          {step === "amount" ? (
            <>
              <View style={s.card}>
                <Text style={s.label}>Quanto deseja depositar?</Text>
                <View style={s.amountRow}>
                  <Text style={s.currency}>R$</Text>
                  <TextInput
                    testID="deposit-amount-input"
                    style={s.amountInput}
                    placeholder="0,00"
                    placeholderTextColor={C.textMuted}
                    keyboardType="decimal-pad"
                    value={amount}
                    onChangeText={setAmount}
                  />
                </View>
                <View style={s.quick}>
                  {[30, 50, 100, 200, 500].map((v) => (
                    <TouchableOpacity key={v} style={s.chip} onPress={() => setAmount(String(v))} testID={`quick-${v}`}>
                      <Text style={s.chipText}>R$ {v}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
              <View style={s.info}>
                <Ionicons name="information-circle" size={16} color={C.primaryDark} />
                <Text style={s.infoText}>
                  Na próxima etapa você verá o QR Code PIX. Depois de pagar, envie o comprovante para aprovação rápida.
                </Text>
              </View>
              <TouchableOpacity style={[s.btn, loading && { opacity: 0.7 }]} onPress={next} disabled={loading} testID="deposit-next">
                {loading ? <ActivityIndicator color="#fff" /> : <Text style={s.btnText}>Continuar</Text>}
              </TouchableOpacity>
            </>
          ) : step === "pix" ? (
            <>
              <View style={[s.card, { alignItems: "center" }]}>
                <Text style={s.label}>Pague {fmtBRL(parseFloat(amount.replace(",", ".")))}</Text>
                <View style={s.qrBox}>
                  {pix?.payload ? <QRCode value={pix.payload} size={200} backgroundColor="#fff" color="#111827" /> : null}
                </View>
                <Text style={s.keyLabel}>Chave PIX ({pix?.pix_key_type})</Text>
                <View style={s.keyRow}>
                  <Text style={s.keyValue} numberOfLines={1}>{pix?.pix_key}</Text>
                  <TouchableOpacity onPress={() => pix && copy(pix.pix_key)} testID="copy-pix-key">
                    <Ionicons name="copy-outline" size={18} color={C.primary} />
                  </TouchableOpacity>
                </View>
                <TouchableOpacity style={s.copyAll} onPress={() => pix && copy(pix.payload)} testID="copy-pix-payload">
                  <Ionicons name="qr-code-outline" size={16} color={C.primaryDark} />
                  <Text style={s.copyAllText}>Copiar PIX copia e cola</Text>
                </TouchableOpacity>
              </View>
              <View style={s.info}>
                <Ionicons name="shield-checkmark" size={16} color={C.primaryDark} />
                <Text style={s.infoText}>
                  Após pagar no app do seu banco, clique em "Já paguei" para enviar o comprovante.
                </Text>
              </View>
              <TouchableOpacity style={s.btn} onPress={() => setStep("proof")} testID="deposit-already-paid">
                <Ionicons name="checkmark-circle" size={18} color="#fff" />
                <Text style={s.btnText}>Já paguei</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <View style={s.card}>
                <Text style={s.h2}>Envie o comprovante</Text>
                <Text style={s.p}>
                  Para aprovação rápida, envie o print ou foto do comprovante do PIX de {fmtBRL(parseFloat(amount.replace(",", ".")))}.
                </Text>

                <TouchableOpacity style={s.picker} onPress={pickProof} testID="deposit-pick-proof">
                  {proof ? (
                    <Image source={{ uri: proof }} style={s.preview} resizeMode="contain" />
                  ) : (
                    <>
                      <Ionicons name="cloud-upload-outline" size={42} color={C.primary} />
                      <Text style={s.pickerTitle}>Toque para anexar o comprovante</Text>
                      <Text style={s.pickerSub}>Aceita imagem (PNG, JPG)</Text>
                    </>
                  )}
                </TouchableOpacity>

                {proof && (
                  <TouchableOpacity onPress={pickProof} style={s.changeBtn} testID="deposit-change-proof">
                    <Ionicons name="refresh" size={14} color={C.primaryDark} />
                    <Text style={s.changeBtnText}>Trocar imagem</Text>
                  </TouchableOpacity>
                )}
              </View>

              <View style={s.info}>
                <Ionicons name="information-circle" size={16} color={C.primaryDark} />
                <Text style={s.infoText}>
                  Assim que o admin verificar o comprovante, o saldo será creditado automaticamente na sua carteira.
                </Text>
              </View>

              <TouchableOpacity style={[s.btn, (!proof || loading) && { opacity: 0.6 }]} onPress={submit} disabled={!proof || loading} testID="deposit-submit">
                {loading ? <ActivityIndicator color="#fff" /> : (
                  <>
                    <Ionicons name="send" size={18} color="#fff" />
                    <Text style={s.btnText}>Enviar para aprovação</Text>
                  </>
                )}
              </TouchableOpacity>
            </>
          )}
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
  h2: { color: C.textPrimary, fontSize: 18, fontWeight: "800", marginBottom: 6 },
  p: { color: C.textSecondary, marginBottom: 14, lineHeight: 20, fontSize: 13 },

  card: { backgroundColor: "#fff", borderRadius: 18, padding: 20, borderWidth: 1, borderColor: C.border },
  label: { color: C.textSecondary, fontSize: 13, fontWeight: "600" },
  amountRow: { flexDirection: "row", alignItems: "flex-end", gap: 10, marginTop: 10, borderBottomWidth: 2, borderBottomColor: C.primary, paddingBottom: 10 },
  currency: { color: C.textPrimary, fontSize: 22, fontWeight: "700", marginBottom: 6 },
  amountInput: { flex: 1, fontSize: 38, fontWeight: "800", color: C.textPrimary, padding: 0 },
  quick: { flexDirection: "row", gap: 8, flexWrap: "wrap", marginTop: 14 },
  chip: { backgroundColor: C.primaryLight, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20 },
  chipText: { color: C.primaryDark, fontWeight: "700", fontSize: 13 },

  info: { flexDirection: "row", gap: 8, padding: 12, backgroundColor: C.primaryLight, borderRadius: 12, marginTop: 14 },
  infoText: { flex: 1, color: C.primaryDark, fontSize: 12, lineHeight: 18 },

  btn: { marginTop: 20, backgroundColor: C.primary, paddingVertical: 16, borderRadius: 14, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  btnText: { color: "#fff", fontWeight: "800", fontSize: 16 },

  qrBox: { padding: 16, backgroundColor: "#fff", borderWidth: 1, borderColor: C.border, borderRadius: 16, marginTop: 16 },
  keyLabel: { color: C.textMuted, fontSize: 11, marginTop: 14 },
  keyRow: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 4, backgroundColor: C.surface, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12, alignSelf: "stretch" },
  keyValue: { flex: 1, color: C.textPrimary, fontWeight: "700" },
  copyAll: { marginTop: 10, flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 14, paddingVertical: 8, backgroundColor: C.primaryLight, borderRadius: 20 },
  copyAllText: { color: C.primaryDark, fontWeight: "700", fontSize: 12 },

  picker: { marginTop: 10, borderWidth: 2, borderColor: C.border, borderStyle: "dashed", borderRadius: 14, minHeight: 220, alignItems: "center", justifyContent: "center", padding: 16 },
  pickerTitle: { color: C.textPrimary, fontWeight: "700", marginTop: 10 },
  pickerSub: { color: C.textMuted, fontSize: 12, marginTop: 2 },
  preview: { width: "100%", height: 260 },
  changeBtn: { marginTop: 10, alignSelf: "center", flexDirection: "row", gap: 4, alignItems: "center", backgroundColor: C.primaryLight, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
  changeBtnText: { color: C.primaryDark, fontWeight: "700", fontSize: 12 },
});
