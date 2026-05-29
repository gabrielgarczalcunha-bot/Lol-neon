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
  const [generatingAI, setGeneratingAI] = useState(false);
  const [deleteFor, setDeleteFor] = useState<Lote | null>(null);
  const [deleting, setDeleting] = useState(false);

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

  const generateAIImage = async () => {
    const name = (editing?.name || "").trim();
    if (!name) {
      Alert.alert("Atenção", "Digite o nome do lote primeiro para a IA gerar uma imagem.");
      return;
    }
    setGeneratingAI(true);
    try {
      const { data } = await api.post("/admin/generate-image", { prompt: name }, { timeout: 90000 });
      if (data.image_url) {
        setEditing((e) => ({ ...(e || {}), image_url: data.image_url }));
      }
    } catch (e: any) {
      Alert.alert("Erro ao gerar imagem", formatApiError(e));
    } finally {
      setGeneratingAI(false);
    }
  };

  const save = async () => {
    if (!editing?.name || !editing.price || !editing.hourly_yield) {
      Alert.alert("Atenção", "Preencha nome, preço e rendimento.");
      return;
    }
    const days = Number(editing.duration_days);
    if (!days || days < 1 || days > 365) {
      Alert.alert("Atenção", "Duração inválida. Use entre 1 e 365 dias.");
      return;
    }
    setSaving(true);
    try {
      const body: any = {
        name: editing.name, description: editing.description || "",
        price: Number(editing.price), hourly_yield: Number(editing.hourly_yield),
        duration_days: days,
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

  const confirmDelete = async () => {
    if (!deleteFor) return;
    setDeleting(true);
    try {
      await api.delete(`/admin/lotes/${deleteFor.id}`);
      setDeleteFor(null);
      await load();
    } catch (e: any) {
      Alert.alert("Erro", formatApiError(e));
    } finally {
      setDeleting(false);
    }
  };

  const PRESET_DAYS = [7, 15, 30, 60, 90, 180, 365];

  return (
    <SafeAreaView style={s.safe} edges={["top"]}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.back} testID="admin-lotes-back">
          <Ionicons name="chevron-back" size={22} color={C.textPrimary} />
        </TouchableOpacity>
        <Text style={s.h1}>Gerenciar Lotes</Text>
        <TouchableOpacity onPress={openNew} style={s.addBtn} testID="lote-new">
          <Ionicons name="add" size={22} color="#0A0612" />
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
                    <Ionicons name="create-outline" size={14} color={C.primary} />
                    <Text style={s.smBtnText}>Editar</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[s.smBtn, { backgroundColor: "#2A0E12", borderColor: C.danger }]} onPress={() => setDeleteFor(l)} testID={`delete-lote-${l.id}`}>
                    <Ionicons name="trash-outline" size={14} color={C.danger} />
                    <Text style={[s.smBtnText, { color: C.danger }]}>Excluir</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          ))}
        </ScrollView>
      )}

      {/* Edit Modal */}
      <Modal visible={showEdit} animationType="slide" onRequestClose={() => setShowEdit(false)}>
        <SafeAreaView style={s.safe} edges={["top", "bottom"]}>
          <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
            <View style={s.header}>
              <TouchableOpacity onPress={() => setShowEdit(false)} style={s.back} testID="edit-close"><Ionicons name="close" size={22} color={C.textPrimary} /></TouchableOpacity>
              <Text style={s.h1}>{(editing as Lote)?.id ? "Editar lote" : "Novo lote"}</Text>
              <View style={{ width: 36 }} />
            </View>
            <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 60 }} keyboardShouldPersistTaps="handled">
              {/* Image picker */}
              <TouchableOpacity style={s.imagePicker} onPress={pickImage} testID="lote-pick-image" disabled={generatingAI}>
                {editing?.image_url ? (
                  <Image source={{ uri: editing.image_url }} style={s.imagePreview} />
                ) : (
                  <>
                    <Ionicons name="image-outline" size={32} color={C.textMuted} />
                    <Text style={{ color: C.textMuted, marginTop: 6, fontSize: 12 }}>Toque para escolher uma foto</Text>
                  </>
                )}
                {generatingAI && (
                  <View style={s.aiOverlay}>
                    <ActivityIndicator color={C.primary} size="large" />
                    <Text style={s.aiOverlayText}>Gerando imagem com IA…</Text>
                  </View>
                )}
              </TouchableOpacity>

              {/* AI Generate button */}
              <TouchableOpacity
                style={[s.aiBtn, (generatingAI || !editing?.name) && { opacity: 0.6 }]}
                onPress={generateAIImage}
                disabled={generatingAI || !editing?.name}
                testID="lote-ai-generate"
              >
                <Ionicons name="sparkles" size={16} color="#0A0612" />
                <Text style={s.aiBtnText}>
                  {generatingAI ? "Gerando…" : `Gerar imagem com IA${editing?.name ? ` (${editing.name})` : ""}`}
                </Text>
              </TouchableOpacity>
              <Text style={s.aiHint}>A IA cria uma arte automática com base no nome do lote (PC Gamer, Sítio, Carro…)</Text>

              <Field label="Nome do lote" value={editing?.name || ""} onChangeText={(v: string) => setEditing(e => ({ ...(e || {}), name: v }))} testID="lote-name" placeholder="Ex: PC Gamer, Sítio Rural, Mercado…" />
              <Field label="Descrição" value={editing?.description || ""} onChangeText={(v: string) => setEditing(e => ({ ...(e || {}), description: v }))} multiline testID="lote-desc" placeholder="Detalhes do lote (opcional)" />
              <Field label="Preço (R$)" value={String(editing?.price ?? "")} onChangeText={(v: string) => setEditing(e => ({ ...(e || {}), price: Number(v.replace(",", ".")) || 0 }))} keyboardType="decimal-pad" testID="lote-price" placeholder="Ex: 30" />
              <Field label="Rendimento por hora (R$)" value={String(editing?.hourly_yield ?? "")} onChangeText={(v: string) => setEditing(e => ({ ...(e || {}), hourly_yield: Number(v.replace(",", ".")) || 0 }))} keyboardType="decimal-pad" testID="lote-hourly" placeholder="Ex: 0.50" />

              {/* Duration with presets */}
              <Text style={s.label}>Duração (dias) — entre 1 e 365</Text>
              <View style={s.presetsRow}>
                {PRESET_DAYS.map(d => (
                  <TouchableOpacity
                    key={d}
                    style={[s.presetChip, Number(editing?.duration_days) === d && s.presetChipActive]}
                    onPress={() => setEditing(e => ({ ...(e || {}), duration_days: d }))}
                    testID={`days-preset-${d}`}
                  >
                    <Text style={[s.presetText, Number(editing?.duration_days) === d && s.presetTextActive]}>{d}d</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <TextInput
                testID="lote-days"
                style={s.input}
                value={String(editing?.duration_days ?? "")}
                onChangeText={(v) => {
                  const n = parseInt(v.replace(/[^0-9]/g, ""), 10);
                  setEditing(e => ({ ...(e || {}), duration_days: isNaN(n) ? undefined as any : n }));
                }}
                keyboardType="number-pad"
                placeholder="Ex: 30"
                placeholderTextColor={C.textMuted}
              />
              <Text style={s.subHint}>Personalize manualmente acima ou use os atalhos.</Text>

              <View style={s.switchRow}>
                <Text style={[s.label, { marginBottom: 0 }]}>Lote ativo (visível na loja)</Text>
                <Switch
                  testID="lote-active"
                  value={editing?.active !== false}
                  onValueChange={(v) => setEditing(e => ({ ...(e || {}), active: v }))}
                  trackColor={{ false: C.border, true: C.primary }}
                  thumbColor="#fff"
                />
              </View>

              <TouchableOpacity style={[s.saveBtn, saving && { opacity: 0.7 }]} onPress={save} disabled={saving} testID="lote-save">
                {saving ? <ActivityIndicator color="#0A0612" /> : <Text style={s.saveText}>Salvar</Text>}
              </TouchableOpacity>
            </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal visible={!!deleteFor} transparent animationType="fade" onRequestClose={() => !deleting && setDeleteFor(null)}>
        <View style={s.confBg}>
          <View style={s.confCard}>
            <View style={s.confIcon}><Ionicons name="trash" size={36} color={C.danger} /></View>
            <Text style={s.confTitle}>Excluir lote?</Text>
            <Text style={s.confDesc}>
              Tem certeza que deseja excluir <Text style={{ fontWeight: "800", color: C.textPrimary }}>{deleteFor?.name}</Text>?
              Esta ação não pode ser desfeita. Usuários que já compraram continuarão recebendo rendimentos até o fim do prazo.
            </Text>
            <View style={s.confActions}>
              <TouchableOpacity style={[s.confBtn, { backgroundColor: C.surfaceAlt }]} onPress={() => setDeleteFor(null)} disabled={deleting} testID="del-cancel">
                <Text style={{ color: C.textPrimary, fontWeight: "700" }}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.confBtn, { backgroundColor: C.danger }]} onPress={confirmDelete} disabled={deleting} testID="del-confirm">
                {deleting ? <ActivityIndicator color="#fff" /> : <Text style={{ color: "#fff", fontWeight: "800" }}>Excluir</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
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
  smBtn: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: C.primaryLight, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, borderWidth: 1, borderColor: "transparent" },
  smBtnText: { color: C.primary, fontWeight: "700", fontSize: 12 },
  empty: { alignItems: "center", padding: 40 },
  newBtn: { marginTop: 16, backgroundColor: C.primary, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12 },
  newBtnText: { color: "#0A0612", fontWeight: "800" },

  imagePicker: { borderWidth: 2, borderColor: C.border, borderStyle: "dashed", borderRadius: 14, height: 180, alignItems: "center", justifyContent: "center", marginBottom: 10, overflow: "hidden", position: "relative" },
  imagePreview: { width: "100%", height: "100%" },
  aiOverlay: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(10,6,18,0.85)", alignItems: "center", justifyContent: "center", gap: 8 },
  aiOverlayText: { color: C.primary, fontWeight: "800", fontSize: 14 },

  aiBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: C.primary, paddingVertical: 12, borderRadius: 12, marginBottom: 6 },
  aiBtnText: { color: "#0A0612", fontWeight: "800", fontSize: 13 },
  aiHint: { color: C.textMuted, fontSize: 11, textAlign: "center", marginBottom: 14, lineHeight: 16 },

  label: { color: C.textSecondary, fontSize: 12, fontWeight: "700", marginBottom: 6 },
  input: { backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 12, color: C.textPrimary },
  presetsRow: { flexDirection: "row", gap: 6, flexWrap: "wrap", marginBottom: 8 },
  presetChip: { backgroundColor: C.card, borderWidth: 1, borderColor: C.border, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20 },
  presetChipActive: { backgroundColor: C.primary, borderColor: C.primary },
  presetText: { color: C.textSecondary, fontWeight: "700", fontSize: 12 },
  presetTextActive: { color: "#0A0612" },
  subHint: { color: C.textMuted, fontSize: 11, marginTop: 6, marginBottom: 14 },

  switchRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: C.card, padding: 14, borderRadius: 12, borderWidth: 1, borderColor: C.border, marginBottom: 16 },
  saveBtn: { backgroundColor: C.primary, paddingVertical: 15, borderRadius: 12, alignItems: "center" },
  saveText: { color: "#0A0612", fontWeight: "900", fontSize: 15 },

  confBg: { flex: 1, backgroundColor: "rgba(0,0,0,0.8)", alignItems: "center", justifyContent: "center", padding: 24 },
  confCard: { backgroundColor: C.card, borderRadius: 22, padding: 24, width: "100%", maxWidth: 400, borderWidth: 1, borderColor: C.border, alignItems: "center" },
  confIcon: { width: 76, height: 76, borderRadius: 38, backgroundColor: "#2A0E12", alignItems: "center", justifyContent: "center" },
  confTitle: { color: C.textPrimary, fontSize: 20, fontWeight: "900", marginTop: 14 },
  confDesc: { color: C.textSecondary, marginTop: 8, fontSize: 13, lineHeight: 20, textAlign: "center" },
  confActions: { flexDirection: "row", gap: 10, marginTop: 22, alignSelf: "stretch" },
  confBtn: { flex: 1, paddingVertical: 13, borderRadius: 12, alignItems: "center", justifyContent: "center" },
});
