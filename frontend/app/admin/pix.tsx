import React, { useEffect, useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert, ActivityIndicator, Platform,
  KeyboardAvoidingView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { api, formatApiError } from "../../src/api";
import { C } from "../../src/theme";

const TYPES = [
  { k: "cpf", label: "CPF" },
  { k: "cnpj", label: "CNPJ" },
  { k: "email", label: "Email" },
  { k: "telefone", label: "Telefone" },
  { k: "aleatoria", label: "Aleatória" },
];

export default function AdminPix() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [pixKey, setPixKey] = useState("");
  const [keyType, setKeyType] = useState("email");
  const [companyName, setCompanyName] = useState("LotePro Investimentos");
  const [city, setCity] = useState("SAO PAULO");

  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get("/settings/pix");
        setPixKey(data.pix_key);
        setKeyType(data.pix_key_type);
        setCompanyName(data.company_name);
        setCity(data.beneficiary_city || "SAO PAULO");
      } finally { setLoading(false); }
    })();
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      await api.put("/admin/settings/pix", {
        pix_key: pixKey.trim(), pix_key_type: keyType,
        company_name: companyName.trim(), beneficiary_city: city.trim().toUpperCase(),
      });
      Alert.alert("Salvo", "Configuração PIX atualizada.");
    } catch (e: any) {
      Alert.alert("Erro", formatApiError(e));
    } finally { setSaving(false); }
  };

  if (loading) return <SafeAreaView style={s.safe}><View style={s.center}><ActivityIndicator color={C.primary} /></View></SafeAreaView>;

  return (
    <SafeAreaView style={s.safe} edges={["top", "bottom"]}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <View style={s.header}>
          <TouchableOpacity onPress={() => router.back()} style={s.back} testID="admin-pix-back">
            <Ionicons name="chevron-back" size={22} color={C.textPrimary} />
          </TouchableOpacity>
          <Text style={s.h1}>Configurar PIX</Text>
          <View style={{ width: 36 }} />
        </View>

        <ScrollView contentContainerStyle={{ padding: 20 }} keyboardShouldPersistTaps="handled">
          <View style={s.info}>
            <Ionicons name="information-circle" size={16} color={C.primaryDark} />
            <Text style={s.infoText}>
              Esta é a chave PIX da sua empresa que aparece no QR Code de depósito para os usuários.
            </Text>
          </View>

          <Text style={s.label}>Tipo de chave</Text>
          <View style={s.chips}>
            {TYPES.map(t => (
              <TouchableOpacity key={t.k} style={[s.chip, keyType === t.k && s.chipActive]} onPress={() => setKeyType(t.k)} testID={`pix-type-${t.k}`}>
                <Text style={[s.chipText, keyType === t.k && { color: "#fff" }]}>{t.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={s.label}>Chave PIX</Text>
          <TextInput testID="pix-key" style={s.input} value={pixKey} onChangeText={setPixKey} autoCapitalize="none" placeholder="Chave PIX" placeholderTextColor={C.textMuted} />

          <Text style={s.label}>Nome da empresa (aparece no PIX)</Text>
          <TextInput testID="pix-company" style={s.input} value={companyName} onChangeText={setCompanyName} placeholder="Ex: LotePro" placeholderTextColor={C.textMuted} />

          <Text style={s.label}>Cidade (sem acentos, maiúsculas)</Text>
          <TextInput testID="pix-city" style={s.input} value={city} onChangeText={setCity} placeholder="SAO PAULO" placeholderTextColor={C.textMuted} />

          <TouchableOpacity style={[s.saveBtn, saving && { opacity: 0.7 }]} onPress={save} disabled={saving} testID="pix-save">
            {saving ? <ActivityIndicator color="#fff" /> : <Text style={s.saveText}>Salvar configuração</Text>}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.surface },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: C.border, backgroundColor: "#fff" },
  back: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  h1: { color: C.textPrimary, fontSize: 17, fontWeight: "800" },

  info: { flexDirection: "row", gap: 8, padding: 12, backgroundColor: C.primaryLight, borderRadius: 12, marginBottom: 16 },
  infoText: { flex: 1, color: C.primaryDark, fontSize: 12, lineHeight: 18 },

  label: { color: C.textSecondary, fontSize: 12, fontWeight: "700", marginTop: 14, marginBottom: 8 },
  chips: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: "#fff", borderWidth: 1, borderColor: C.border },
  chipActive: { backgroundColor: C.primary, borderColor: C.primary },
  chipText: { color: C.textSecondary, fontWeight: "700", fontSize: 12 },
  input: { backgroundColor: "#fff", borderWidth: 1, borderColor: C.border, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, color: C.textPrimary },

  saveBtn: { marginTop: 22, backgroundColor: C.primary, paddingVertical: 15, borderRadius: 14, alignItems: "center" },
  saveText: { color: "#fff", fontWeight: "800", fontSize: 15 },
});
