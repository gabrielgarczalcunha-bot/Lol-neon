import React, { useCallback, useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Modal, Alert, ActivityIndicator,
  KeyboardAvoidingView, Platform, Image, Switch,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter, useFocusEffect } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { api, fmtBRL, formatApiError } from "../../src/api";
import { C } from "../../src/theme";

type Lote = {
  id: string; name: string; description: string; price: number; hourly_yield: number;
  duration_days: number; image_url: string; active: boolean;
};

export default function AdminLotes() {
  const router = useRouter();
  const [items, setItems] = useState<Lote[]>([]);
  const [loading, setLoading] = useState(true);
  const [showEdit, setShowEdit] = useState(false);
  const [editing, setEditing] = useState<Partial<Lote> | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/admin/lotes");
      setItems(data);
    } finally { setLoading(false); }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const openNew = () => {
    setEditing({ name: "", description: "", price: 0, hourly_yield: 0, duration_days: 30, image_url: "", active: true });
    setShowEdit(true);
  };
  const openEdit = (l: Lote) => { setEditing(l); setShowEdit(true); };

  const pickImage = async () => {
    const r = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.6, base64: true, allowsEditing: true, aspect: [16, 9],
    });
    if (!r.canceled && r.assets[0]?.base64) {
      setEditing((e) => ({ ...(e || {}), image_url: `data:image/jpeg;base64,${r.assets[0].base64}` }));
    }
  };

  const save = async () => {
    if (!editing?.name || !editing.price || !editing.hourly_yield) {
      Alert.alert("Atenção", "Preencha nome, preço e rendimento.");
      return;
    }
    setSaving(true);
    try {
      const body: any = {
        name: editing.name, description: editing.description || "",
        price: Number(editing.price), hourly_yield: Number(editing.hourly_yield),
        duration_days: Number(editing.duration_days || 30),
        image_url: editing.image_url || "", active: editing.active !== false,
      };
      if ((editing as Lote).id) {
        await api.put(`/admin/lotes/${(editing as Lote).id}`, body);
      } else {
        await api.post("/admin/lotes", body);
      }
      setShowEdit(false);
      setEditing(null);
      await load();
    } catch (e: any) {
      Alert.alert("Erro", formatApiError(e));
    } finally {
      setSaving(false);
    }
  };

  const del = (id: string) => {
    Alert.alert("Excluir lote?", "Essa ação não pode ser desfeita.", [
      { text: "Cancelar", style: "cancel" },
      { text: "Excluir", style: "destructive", onPress: async () => {
        try { await api.delete(`/admin/lotes/${id}`); await load(); }
        catch (e: any) { Alert.alert("Erro", formatApiError(e)); }
      } },
    ]);
  };

  return (
    <SafeAreaView style={s.safe} edges={["top"]}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.back} testID="admin-lotes-back">
          <Ionicons name="chevron-back" size={22} color={C.textPrimary} />
        </TouchableOpacity>
        <Text style={s.h1}>Gerenciar Lotes</Text>
        <TouchableOpacity onPress={openNew} style={s.addBtn} testID="lote-new">
          <Ionicons name="add" size={22} color="#fff" />
        </TouchableOpacity>
      </View>

      {loading ? <View style={s.center}><ActivityIndicator color={C.primary} /></View> : (
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
          {items.length === 0 ? (
            <View style={s.empty}>
              <Ionicons name="cube-outline" size={42} color={C.textMuted} />
              <Text style={{ color: C.textMuted, marginTop: 8 }}>Nenhum lote cadastrado.</Text>
              <TouchableOpacity style={s.newBtn} onPress={openNew} testID="lote-new-empty">
                <Text style={s.newBtnText}>+ Criar primeiro lote</Text>
              </TouchableOpacity>
            </View>
          ) : items.map((l) => (
            <View key={l.id} style={s.card}>
              {l.image_url ? (
                <Image source={{ uri: l.image_url }} style={s.img} />
              ) : <View style={[s.img, { backgroundColor: C.primaryLight, alignItems: "center", justifyContent: "center" }]}><Ionicons name="cube" size={30} color={C.primary} /></View>}
              <View style={{ flex: 1, marginLeft: 12 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                  <Text style={s.name} numberOfLines={1}>{l.name}</Text>
                  {!l.active && <View style={s.inactive}><Text style={s.inactiveText}>Inativo</Text></View>}
                </View>
                <Text style={s.meta}>{fmtBRL(l.price)} • {fmtBRL(l.hourly_yield)}/h • {l.duration_days}d</Text>
                <View style={s.rowActions}>
                  <TouchableOpacity style={s.smBtn} onPress={() => openEdit(l)} testID={`edit-lote-${l.id}`}>
                    <Ionicons name="create-outline" size={14} color={C.primaryDark} />
                    <Text style={s.smBtnText}>Editar</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[s.smBtn, { backgroundColor: "#FEE2E2" }]} onPress={() => del(l.id)} testID={`delete-lote-${l.id}`}>
                    <Ionicons name="trash-outline" size={14} color={C.danger} />
                    <Text style={[s.smBtnText, { color: C.danger }]}>Excluir</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          ))}
        </ScrollView>
      )}

      <Modal visible={showEdit} animationType="slide" onRequestClose={() => setShowEdit(false)}>
        <SafeAreaView style={s.safe} edges={["top", "bottom"]}>
          <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
            <View style={s.header}>
              <TouchableOpacity onPress={() => setShowEdit(false)} style={s.back} testID="edit-close"><Ionicons name="close" size={22} color={C.textPrimary} /></TouchableOpacity>
              <Text style={s.h1}>{(editing as Lote)?.id ? "Editar lote" : "Novo lote"}</Text>
              <View style={{ width: 36 }} />
            </View>
            <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 60 }} keyboardShouldPersistTaps="handled">
              <TouchableOpacity style={s.imagePicker} onPress={pickImage} testID="lote-pick-image">
                {editing?.image_url ? (
                  <Image source={{ uri: editing.image_url }} style={s.imagePreview} />
                ) : (
                  <>
                    <Ionicons name="image-outline" size={32} color={C.textMuted} />
                    <Text style={{ color: C.textMuted, marginTop: 6, fontSize: 12 }}>Toque para escolher uma foto</Text>
                  </>
                )}
              </TouchableOpacity>

              <Field label="Nome do lote" value={editing?.name || ""} onChangeText={(v) => setEditing(e => ({ ...(e || {}), name: v }))} testID="lote-name" />
              <Field label="Descrição" value={editing?.description || ""} onChangeText={(v) => setEditing(e => ({ ...(e || {}), description: v }))} multiline testID="lote-desc" />
              <Field label="Preço (R$)" value={String(editing?.price ?? "")} onChangeText={(v) => setEditing(e => ({ ...(e || {}), price: Number(v.replace(",", ".")) || 0 }))} keyboardType="decimal-pad" testID="lote-price" />
              <Field label="Rendimento por hora (R$)" value={String(editing?.hourly_yield ?? "")} onChangeText={(v) => setEditing(e => ({ ...(e || {}), hourly_yield: Number(v.replace(",", ".")) || 0 }))} keyboardType="decimal-pad" testID="lote-hourly" />
              <Field label="Duração (dias)" value={String(editing?.duration_days ?? 30)} onChangeText={(v) => setEditing(e => ({ ...(e || {}), duration_days: Number(v) || 30 }))} keyboardType="number-pad" testID="lote-days" />

              <View style={s.switchRow}>
                <Text style={s.label}>Lote ativo (visível na loja)</Text>
                <Switch
                  testID="lote-active"
                  value={editing?.active !== false}
                  onValueChange={(v) => setEditing(e => ({ ...(e || {}), active: v }))}
                  trackColor={{ false: C.border, true: C.primary }}
                  thumbColor="#fff"
                />
              </View>

              <TouchableOpacity style={[s.saveBtn, saving && { opacity: 0.7 }]} onPress={save} disabled={saving} testID="lote-save">
                {saving ? <ActivityIndicator color="#fff" /> : <Text style={s.saveText}>Salvar</Text>}
              </TouchableOpacity>
            </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

function Field({ label, value, onChangeText, testID, ...rest }: any) {
  return (
    <View style={{ marginBottom: 12 }}>
      <Text style={s.label}>{label}</Text>
      <TextInput testID={testID} style={s.input} value={value} onChangeText={onChangeText} placeholderTextColor={C.textMuted} {...rest} />
    </View>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.surface },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: C.border, backgroundColor: C.card },
  back: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  h1: { color: C.textPrimary, fontSize: 17, fontWeight: "800" },
  addBtn: { width: 36, height: 36, borderRadius: 10, backgroundColor: C.primary, alignItems: "center", justifyContent: "center" },
  card: { flexDirection: "row", backgroundColor: C.card, padding: 12, borderRadius: 14, borderWidth: 1, borderColor: C.border, marginBottom: 10 },
  img: { width: 74, height: 74, borderRadius: 10, backgroundColor: C.surfaceAlt },
  name: { fontWeight: "800", color: C.textPrimary, fontSize: 15 },
  inactive: { backgroundColor: C.surfaceAlt, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  inactiveText: { color: C.textMuted, fontSize: 10, fontWeight: "700" },
  meta: { color: C.textSecondary, fontSize: 12, marginTop: 2 },
  rowActions: { flexDirection: "row", gap: 6, marginTop: 8 },
  smBtn: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: C.primaryLight, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 },
  smBtnText: { color: C.primaryDark, fontWeight: "700", fontSize: 12 },
  empty: { alignItems: "center", padding: 40 },
  newBtn: { marginTop: 16, backgroundColor: C.primary, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12 },
  newBtnText: { color: "#fff", fontWeight: "700" },

  imagePicker: { borderWidth: 2, borderColor: C.border, borderStyle: "dashed", borderRadius: 14, height: 140, alignItems: "center", justifyContent: "center", marginBottom: 14, overflow: "hidden" },
  imagePreview: { width: "100%", height: "100%" },
  label: { color: C.textSecondary, fontSize: 12, fontWeight: "700", marginBottom: 6 },
  input: { backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 12, color: C.textPrimary },
  switchRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: C.card, padding: 14, borderRadius: 12, borderWidth: 1, borderColor: C.border, marginBottom: 16 },
  saveBtn: { backgroundColor: C.primary, paddingVertical: 15, borderRadius: 12, alignItems: "center" },
  saveText: { color: "#fff", fontWeight: "800", fontSize: 15 },
});
