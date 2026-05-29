import React, { useCallback, useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Share, Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import * as Clipboard from "expo-clipboard";
import { api, fmtBRL } from "../src/api";
import { C } from "../src/theme";

type Ref = { name: string; email: string; bonus_amount: number; status: string; created_at: string; paid_at?: string };

export default function Indicacao() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [code, setCode] = useState("");
  const [totalEarned, setTotalEarned] = useState(0);
  const [totalRefs, setTotalRefs] = useState(0);
  const [paidRefs, setPaidRefs] = useState(0);
  const [bonusPct, setBonusPct] = useState(10);
  const [bonusCap, setBonusCap] = useState(50);
  const [items, setItems] = useState<Ref[]>([]);
  const [toast, setToast] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/me/referrals");
      setCode(data.code);
      setTotalEarned(data.total_earned || 0);
      setTotalRefs(data.total_referrals || 0);
      setPaidRefs(data.paid_referrals || 0);
      setBonusPct(data.bonus_pct || 10);
      setBonusCap(data.bonus_cap || 50);
      setItems(data.referrals || []);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 1800);
  };

  const copyCode = async () => {
    await Clipboard.setStringAsync(code);
    showToast("Código copiado!");
  };

  const copyMessage = async () => {
    const msg = `🌱 Vem ganhar dinheiro com a Neon Farm! Use meu código de indicação: ${code} ao se cadastrar e comece a render lucros diários.`;
    await Clipboard.setStringAsync(msg);
    showToast("Convite copiado!");
  };

  const shareCode = async () => {
    const msg = `🌱 Vem ganhar dinheiro com a Neon Farm!\n\nUse meu código de indicação: *${code}* ao se cadastrar e comece a render lucros diários.`;
    try {
      if (Platform.OS === "web") {
        await Clipboard.setStringAsync(msg);
        showToast("Mensagem copiada para compartilhar!");
      } else {
        await Share.share({ message: msg });
      }
    } catch { /* user cancelled */ }
  };

  return (
    <SafeAreaView style={s.safe} edges={["top", "bottom"]}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.back} testID="ref-back">
          <Ionicons name="chevron-back" size={22} color={C.textPrimary} />
        </TouchableOpacity>
        <Text style={s.h1}>Indique e Ganhe</Text>
        <View style={{ width: 36 }} />
      </View>

      {loading ? (
        <View style={s.center}><ActivityIndicator color={C.primary} /></View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 60 }}>
          {/* Hero */}
          <View style={s.hero}>
            <View style={s.heroIcon}>
              <Ionicons name="gift" size={32} color="#0A0612" />
            </View>
            <Text style={s.heroTitle}>Ganhe {bonusPct.toFixed(0)}% por indicação</Text>
            <Text style={s.heroDesc}>
              Indique amigos e receba {bonusPct.toFixed(0)}% do primeiro depósito de cada um.
              Bônus de até <Text style={{ color: C.primary, fontWeight: "800" }}>{fmtBRL(bonusCap)}</Text> por amigo.
            </Text>
          </View>

          {/* Code card */}
          <View style={s.codeCard}>
            <Text style={s.codeLabel}>Seu código de indicação</Text>
            <View style={s.codeRow}>
              <Text style={s.codeValue} testID="ref-code">{code}</Text>
              <TouchableOpacity style={s.copyBtn} onPress={copyCode} testID="ref-copy">
                <Ionicons name="copy-outline" size={18} color={C.primary} />
              </TouchableOpacity>
            </View>
            <View style={s.actionsRow}>
              <TouchableOpacity style={[s.actBtn, { backgroundColor: C.primary }]} onPress={shareCode} testID="ref-share">
                <Ionicons name="share-social" size={16} color="#0A0612" />
                <Text style={[s.actBtnText, { color: "#0A0612" }]}>Compartilhar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.actBtn, s.actBtnGhost]} onPress={copyMessage} testID="ref-copy-message">
                <Ionicons name="chatbubble-ellipses-outline" size={16} color={C.primary} />
                <Text style={[s.actBtnText, { color: C.primary }]}>Copiar mensagem</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Stats */}
          <View style={s.statsRow}>
            <View style={s.statCard}>
              <Text style={s.statLabel}>Indicados</Text>
              <Text style={s.statValue}>{totalRefs}</Text>
              <Text style={s.statHint}>{paidRefs} ativos</Text>
            </View>
            <View style={s.statCard}>
              <Text style={s.statLabel}>Total ganho</Text>
              <Text style={[s.statValue, { color: C.primary }]}>{fmtBRL(totalEarned)}</Text>
              <Text style={s.statHint}>creditado na carteira</Text>
            </View>
          </View>

          {/* How it works */}
          <View style={s.howCard}>
            <Text style={s.howTitle}>Como funciona</Text>
            <Step n="1" text="Compartilhe seu código com amigos" />
            <Step n="2" text="Eles se cadastram usando seu código" />
            <Step n="3" text={`Quando fizerem o primeiro depósito aprovado, você ganha ${bonusPct.toFixed(0)}% direto na sua carteira`} />
          </View>

          {/* Referrals list */}
          <Text style={s.sectionTitle}>Seus indicados ({totalRefs})</Text>
          {items.length === 0 ? (
            <View style={s.empty}>
              <Ionicons name="people-outline" size={42} color={C.textMuted} />
              <Text style={s.emptyText}>Você ainda não indicou ninguém. Compartilhe seu código agora!</Text>
            </View>
          ) : items.map((r, i) => (
            <View key={i} style={s.refRow}>
              <View style={[s.refAvatar, r.status === "paid" && { backgroundColor: C.primary }]}>
                <Text style={[s.refAvatarText, r.status === "paid" && { color: "#0A0612" }]}>{(r.name || "?").substring(0, 1).toUpperCase()}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.refName}>{r.name}</Text>
                <Text style={s.refDate}>{new Date(r.created_at).toLocaleDateString("pt-BR")}</Text>
              </View>
              {r.status === "paid" ? (
                <View style={{ alignItems: "flex-end" }}>
                  <Text style={s.refBonus}>+ {fmtBRL(r.bonus_amount)}</Text>
                  <View style={s.paidBadge}><Text style={s.paidText}>Recebido</Text></View>
                </View>
              ) : (
                <View style={s.pendingBadge}><Text style={s.pendingText}>Aguardando depósito</Text></View>
              )}
            </View>
          ))}
        </ScrollView>
      )}

      {toast && (
        <View style={s.toast} pointerEvents="none">
          <Ionicons name="checkmark-circle" size={16} color={C.primary} />
          <Text style={s.toastText}>{toast}</Text>
        </View>
      )}
    </SafeAreaView>
  );
}

function Step({ n, text }: { n: string; text: string }) {
  return (
    <View style={s.stepRow}>
      <View style={s.stepNum}><Text style={s.stepNumText}>{n}</Text></View>
      <Text style={s.stepText}>{text}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.surface },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: C.border, backgroundColor: C.card },
  back: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  h1: { color: C.textPrimary, fontSize: 17, fontWeight: "800" },

  hero: { backgroundColor: C.card, borderRadius: 22, padding: 22, borderWidth: 1, borderColor: C.primary, alignItems: "center" },
  heroIcon: { width: 72, height: 72, borderRadius: 36, backgroundColor: C.primary, alignItems: "center", justifyContent: "center" },
  heroTitle: { color: C.textPrimary, fontSize: 22, fontWeight: "900", marginTop: 14, textAlign: "center" },
  heroDesc: { color: C.textSecondary, marginTop: 8, fontSize: 14, lineHeight: 20, textAlign: "center" },

  codeCard: { backgroundColor: C.card, borderRadius: 18, padding: 18, borderWidth: 1, borderColor: C.border, marginTop: 14 },
  codeLabel: { color: C.textMuted, fontSize: 12, fontWeight: "600" },
  codeRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 8, backgroundColor: C.surface, borderWidth: 2, borderColor: C.primary, borderStyle: "dashed", borderRadius: 14, paddingHorizontal: 18, paddingVertical: 14 },
  codeValue: { color: C.primary, fontWeight: "900", fontSize: 28, letterSpacing: 4 },
  copyBtn: { width: 40, height: 40, backgroundColor: C.primaryLight, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  actionsRow: { flexDirection: "row", gap: 10, marginTop: 14 },
  actBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 12, borderRadius: 12 },
  actBtnGhost: { backgroundColor: C.surfaceAlt, borderWidth: 1, borderColor: C.border },
  actBtnText: { fontWeight: "800", fontSize: 13 },

  statsRow: { flexDirection: "row", gap: 10, marginTop: 14 },
  statCard: { flex: 1, backgroundColor: C.card, borderRadius: 16, padding: 14, borderWidth: 1, borderColor: C.border },
  statLabel: { color: C.textMuted, fontSize: 11 },
  statValue: { color: C.textPrimary, fontSize: 24, fontWeight: "900", marginTop: 4 },
  statHint: { color: C.textMuted, fontSize: 11, marginTop: 2 },

  howCard: { backgroundColor: C.card, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: C.border, marginTop: 14 },
  howTitle: { color: C.textPrimary, fontSize: 15, fontWeight: "800", marginBottom: 10 },
  stepRow: { flexDirection: "row", alignItems: "flex-start", gap: 10, marginTop: 6 },
  stepNum: { width: 26, height: 26, borderRadius: 13, backgroundColor: C.primaryLight, alignItems: "center", justifyContent: "center" },
  stepNumText: { color: C.primary, fontWeight: "900", fontSize: 13 },
  stepText: { flex: 1, color: C.textSecondary, fontSize: 13, lineHeight: 20, paddingTop: 4 },

  sectionTitle: { color: C.textPrimary, fontSize: 14, fontWeight: "800", marginTop: 22, marginBottom: 8 },
  empty: { alignItems: "center", padding: 30, backgroundColor: C.card, borderRadius: 16, borderWidth: 1, borderColor: C.border, gap: 8 },
  emptyText: { color: C.textMuted, textAlign: "center", fontSize: 13 },

  refRow: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: C.card, padding: 14, borderRadius: 14, borderWidth: 1, borderColor: C.border, marginBottom: 8 },
  refAvatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: C.surfaceAlt, alignItems: "center", justifyContent: "center" },
  refAvatarText: { color: C.textPrimary, fontWeight: "800" },
  refName: { color: C.textPrimary, fontWeight: "700" },
  refDate: { color: C.textMuted, fontSize: 11, marginTop: 2 },
  refBonus: { color: C.primary, fontWeight: "900", fontSize: 14 },
  paidBadge: { marginTop: 2, backgroundColor: C.primaryLight, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 },
  paidText: { color: C.primary, fontSize: 10, fontWeight: "700" },
  pendingBadge: { backgroundColor: C.surfaceAlt, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
  pendingText: { color: C.textMuted, fontSize: 10, fontWeight: "700" },

  toast: { position: "absolute", bottom: 30, left: 30, right: 30, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: C.card, borderWidth: 1, borderColor: C.primary, paddingVertical: 12, borderRadius: 12 },
  toastText: { color: C.textPrimary, fontWeight: "700", fontSize: 13 },
});
