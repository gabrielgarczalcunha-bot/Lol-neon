import React, { useEffect, useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, Image, TouchableOpacity, ActivityIndicator, Alert, Modal,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { api, fmtBRL, formatApiError } from "../../src/api";
import { C } from "../../src/theme";

type Lote = {
  id: string; name: string; description: string; price: number;
  hourly_yield: number; duration_days: number; image_url: string;
};

export default function LoteDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [lote, setLote] = useState<Lote | null>(null);
  const [loading, setLoading] = useState(true);
  const [buying, setBuying] = useState(false);
  const [confirmVisible, setConfirmVisible] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get("/lotes");
        const found = data.find((l: Lote) => l.id === id);
        setLote(found || null);
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  const confirmBuy = async () => {
    if (!lote) return;
    setBuying(true);
    try {
      await api.post(`/lotes/${lote.id}/buy`);
      setConfirmVisible(false);
      Alert.alert("Sucesso!", "Lote adquirido. Seus rendimentos começarão a partir de agora.");
      router.replace("/(tabs)");
    } catch (e: any) {
      setConfirmVisible(false);
      Alert.alert("Erro", formatApiError(e));
    } finally {
      setBuying(false);
    }
  };

  if (loading) return <SafeAreaView style={s.safe}><View style={s.center}><ActivityIndicator size="large" color={C.primary} /></View></SafeAreaView>;
  if (!lote) return (
    <SafeAreaView style={s.safe}>
      <View style={s.center}><Text style={{ color: C.textPrimary }}>Lote não encontrado.</Text></View>
    </SafeAreaView>
  );

  const totalReturn = lote.hourly_yield * 24 * lote.duration_days;
  const profit = totalReturn - lote.price;

  return (
    <SafeAreaView style={s.safe} edges={["bottom"]}>
      <ScrollView contentContainerStyle={{ paddingBottom: 120 }}>
        <View style={{ position: "relative" }}>
          {lote.image_url ? (
            <Image source={{ uri: lote.image_url }} style={s.img} />
          ) : (
            <View style={[s.img, { backgroundColor: C.primaryLight, alignItems: "center", justifyContent: "center" }]}>
              <Ionicons name="cube" size={80} color={C.primary} />
            </View>
          )}
          <TouchableOpacity style={s.back} onPress={() => router.back()} testID="lote-back">
            <Ionicons name="chevron-back" size={22} color="#fff" />
          </TouchableOpacity>
        </View>

        <View style={s.body}>
          <Text style={s.name}>{lote.name}</Text>
          {!!lote.description && <Text style={s.desc}>{lote.description}</Text>}

          <View style={s.priceBox}>
            <Text style={s.priceLabel}>Preço</Text>
            <Text style={s.priceValue}>{fmtBRL(lote.price)}</Text>
          </View>

          <Text style={s.sectionTitle}>Rendimento estimado</Text>
          <View style={s.row}>
            <Stat icon="time" label="Por hora" value={fmtBRL(lote.hourly_yield)} />
            <Stat icon="calendar" label="Por dia" value={fmtBRL(lote.hourly_yield * 24)} />
          </View>
          <View style={s.row}>
            <Stat icon="stopwatch" label={`Em ${lote.duration_days} dias`} value={fmtBRL(totalReturn)} />
            <Stat icon="cash" label="Lucro líquido" value={fmtBRL(profit)} highlight />
          </View>

          <View style={s.info}>
            <Ionicons name="information-circle" size={16} color={C.primary} />
            <Text style={s.infoText}>
              Os rendimentos são acumulados por hora automaticamente durante {lote.duration_days} dias. Você pode coletá-los a qualquer momento na sua Carteira.
            </Text>
          </View>
        </View>
      </ScrollView>

      <View style={s.footer}>
        <View>
          <Text style={s.footerLabel}>Valor</Text>
          <Text style={s.footerValue}>{fmtBRL(lote.price)}</Text>
        </View>
        <TouchableOpacity style={s.buy} onPress={() => setConfirmVisible(true)} testID="lote-buy-button">
          <Text style={s.buyText}>Comprar agora</Text>
          <Ionicons name="arrow-forward" size={18} color="#0A0612" />
        </TouchableOpacity>
      </View>

      <Modal visible={confirmVisible} transparent animationType="fade" onRequestClose={() => setConfirmVisible(false)}>
        <View style={s.modalBg}>
          <View style={s.modalCard}>
            <View style={s.modalIcon}><Ionicons name="cart" size={28} color={C.primary} /></View>
            <Text style={s.modalTitle}>Confirmar compra</Text>
            <Text style={s.modalDesc}>
              Deseja comprar o {lote.name} por <Text style={{ color: C.primary, fontWeight: "800" }}>{fmtBRL(lote.price)}</Text>?{"\n\n"}
              O valor será debitado do seu saldo e o rendimento começa em seguida.
            </Text>
            <View style={s.modalActions}>
              <TouchableOpacity style={s.modalCancel} onPress={() => setConfirmVisible(false)} disabled={buying} testID="confirm-cancel">
                <Text style={s.modalCancelText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.modalOk, buying && { opacity: 0.7 }]} onPress={confirmBuy} disabled={buying} testID="confirm-buy">
                {buying ? <ActivityIndicator color="#0A0612" /> : <Text style={s.modalOkText}>Comprar</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function Stat({ icon, label, value, highlight }: any) {
  return (
    <View style={[s.stat, highlight && { backgroundColor: C.primaryLight, borderColor: C.primary }]}>
      <Ionicons name={icon} size={16} color={highlight ? C.primary : C.textSecondary} />
      <Text style={s.statLabel}>{label}</Text>
      <Text style={[s.statValue, highlight && { color: C.primary }]}>{value}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  img: { width: "100%", height: 280, backgroundColor: C.surfaceAlt },
  back: { position: "absolute", top: 14, left: 14, width: 40, height: 40, borderRadius: 20, backgroundColor: "rgba(0,0,0,0.55)", alignItems: "center", justifyContent: "center" },
  body: { padding: 20 },
  name: { color: C.textPrimary, fontSize: 26, fontWeight: "800" },
  desc: { color: C.textSecondary, marginTop: 8, lineHeight: 20 },
  priceBox: { marginTop: 18, padding: 16, borderRadius: 16, backgroundColor: C.surface, borderWidth: 1, borderColor: C.border },
  priceLabel: { color: C.textMuted, fontSize: 12 },
  priceValue: { color: C.textPrimary, fontSize: 28, fontWeight: "800", marginTop: 4 },
  sectionTitle: { color: C.textPrimary, fontSize: 16, fontWeight: "800", marginTop: 22, marginBottom: 10 },
  row: { flexDirection: "row", gap: 10, marginBottom: 10 },
  stat: { flex: 1, backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, borderRadius: 14, padding: 14 },
  statLabel: { color: C.textMuted, fontSize: 11, marginTop: 6 },
  statValue: { color: C.textPrimary, fontSize: 16, fontWeight: "800", marginTop: 2 },
  info: { flexDirection: "row", gap: 8, padding: 12, backgroundColor: C.primaryLight, borderRadius: 12, marginTop: 10 },
  infoText: { flex: 1, color: C.primary, fontSize: 12, lineHeight: 18 },
  footer: { position: "absolute", bottom: 0, left: 0, right: 0, backgroundColor: C.card, borderTopWidth: 1, borderTopColor: C.border, padding: 16, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  footerLabel: { color: C.textMuted, fontSize: 11 },
  footerValue: { color: C.textPrimary, fontSize: 22, fontWeight: "800" },
  buy: { flex: 1, backgroundColor: C.primary, paddingVertical: 15, borderRadius: 14, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  buyText: { color: "#0A0612", fontWeight: "900", fontSize: 16 },

  modalBg: { flex: 1, backgroundColor: "rgba(0,0,0,0.7)", alignItems: "center", justifyContent: "center", padding: 24 },
  modalCard: { backgroundColor: C.card, borderRadius: 20, padding: 24, width: "100%", maxWidth: 380, borderWidth: 1, borderColor: C.border },
  modalIcon: { width: 56, height: 56, borderRadius: 16, backgroundColor: C.primaryLight, alignItems: "center", justifyContent: "center", alignSelf: "center", marginBottom: 14 },
  modalTitle: { color: C.textPrimary, fontSize: 19, fontWeight: "800", textAlign: "center" },
  modalDesc: { color: C.textSecondary, marginTop: 10, lineHeight: 20, textAlign: "center", fontSize: 13 },
  modalActions: { flexDirection: "row", gap: 10, marginTop: 22 },
  modalCancel: { flex: 1, backgroundColor: C.surfaceAlt, paddingVertical: 13, borderRadius: 12, alignItems: "center" },
  modalCancelText: { color: C.textPrimary, fontWeight: "700" },
  modalOk: { flex: 1, backgroundColor: C.primary, paddingVertical: 13, borderRadius: 12, alignItems: "center" },
  modalOkText: { color: "#0A0612", fontWeight: "900" },
});
