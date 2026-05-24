import React from "react";
import { View, Text, StyleSheet, TouchableOpacity, Image, ImageBackground } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { C } from "../../src/theme";

export default function Welcome() {
  const router = useRouter();

  return (
    <View style={s.root}>
      <View style={s.bgGlow1} />
      <View style={s.bgGlow2} />

      <SafeAreaView style={{ flex: 1 }} edges={["top", "bottom"]}>
        <View style={s.content}>
          <View style={s.brand}>
            <View style={s.logoBox}>
              <Ionicons name="leaf" size={42} color="#0A0612" />
            </View>
            <Text style={s.title}>Neon<Text style={{ color: C.accent }}> Farm</Text></Text>
            <Text style={s.tag}>Cultive seus rendimentos.</Text>
            <Text style={s.tag}>Colha lucros a cada hora.</Text>
          </View>

          <View style={s.features}>
            <Feature icon="flash" text="Rendimento ao vivo, hora a hora" />
            <Feature icon="shield-checkmark" text="Pagamentos via PIX com aprovação ágil" />
            <Feature icon="trending-up" text="Lotes com lucro até 30 dias" />
          </View>

          <View style={s.actions}>
            <TouchableOpacity
              style={s.primaryBtn}
              onPress={() => router.push("/(auth)/register")}
              testID="welcome-register"
              activeOpacity={0.85}
            >
              <Text style={s.primaryText}>Criar conta grátis</Text>
              <Ionicons name="arrow-forward" size={18} color="#0A0612" />
            </TouchableOpacity>

            <TouchableOpacity
              style={s.secondaryBtn}
              onPress={() => router.push("/(auth)/login")}
              testID="welcome-login"
              activeOpacity={0.85}
            >
              <Text style={s.secondaryText}>Já tenho conta — entrar</Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={() => router.push("/sobre")} testID="welcome-about">
              <Text style={s.about}>Sobre a Neon Farm</Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    </View>
  );
}

function Feature({ icon, text }: { icon: any; text: string }) {
  return (
    <View style={s.feature}>
      <View style={s.featIcon}>
        <Ionicons name={icon} size={16} color={C.primary} />
      </View>
      <Text style={s.featText}>{text}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg, overflow: "hidden" },
  bgGlow1: { position: "absolute", top: -120, right: -120, width: 320, height: 320, borderRadius: 160, backgroundColor: C.primary, opacity: 0.18 },
  bgGlow2: { position: "absolute", bottom: -160, left: -120, width: 360, height: 360, borderRadius: 180, backgroundColor: C.accent, opacity: 0.15 },

  content: { flex: 1, padding: 28, justifyContent: "space-between" },
  brand: { marginTop: 40, alignItems: "flex-start" },
  logoBox: {
    width: 76, height: 76, borderRadius: 22, backgroundColor: C.primary, alignItems: "center", justifyContent: "center",
    shadowColor: C.primary, shadowOpacity: 0.85, shadowRadius: 22, shadowOffset: { width: 0, height: 0 }, elevation: 10,
  },
  title: { color: C.textPrimary, fontSize: 44, fontWeight: "900", marginTop: 18, letterSpacing: -1 },
  tag: { color: C.textSecondary, fontSize: 15, marginTop: 6, fontWeight: "500" },

  features: { marginVertical: 30, gap: 14 },
  feature: { flexDirection: "row", alignItems: "center", gap: 12 },
  featIcon: { width: 30, height: 30, borderRadius: 8, backgroundColor: C.primaryLight, alignItems: "center", justifyContent: "center" },
  featText: { color: C.textPrimary, fontSize: 14, flex: 1 },

  actions: { gap: 12 },
  primaryBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    backgroundColor: C.primary, paddingVertical: 18, borderRadius: 16,
    shadowColor: C.primary, shadowOpacity: 0.6, shadowRadius: 18, shadowOffset: { width: 0, height: 0 }, elevation: 8,
  },
  primaryText: { color: "#0A0612", fontWeight: "900", fontSize: 16, letterSpacing: 0.3 },
  secondaryBtn: {
    paddingVertical: 16, borderRadius: 16, alignItems: "center", justifyContent: "center",
    borderWidth: 1, borderColor: C.borderStrong, backgroundColor: C.card,
  },
  secondaryText: { color: C.textPrimary, fontWeight: "700", fontSize: 15 },
  about: { color: C.textMuted, textAlign: "center", marginTop: 8, fontSize: 12 },
});
