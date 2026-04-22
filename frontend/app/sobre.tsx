import React from "react";
import { View, Text, StyleSheet, ScrollView, Image, TouchableOpacity } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { C } from "../src/theme";

export default function Sobre() {
  const router = useRouter();
  return (
    <SafeAreaView style={s.safe} edges={["top", "bottom"]}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.back} testID="about-back">
          <Ionicons name="chevron-back" size={22} color={C.textPrimary} />
        </TouchableOpacity>
        <Text style={s.h1}>Sobre e Licença</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        <Image
          source={{ uri: "https://images.unsplash.com/photo-1766866771433-c3042a3ce7a3?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NDk1NzZ8MHwxfHNlYXJjaHwyfHxtb2Rlcm4lMjBjb3Jwb3JhdGUlMjBidWlsZGluZyUyMGZhY2FkZXxlbnwwfHx8fDE3NzY4MTUxMDB8MA&ixlib=rb-4.1.0&q=85" }}
          style={s.hero}
        />

        <View style={s.body}>
          <Text style={s.name}>LotePro Investimentos LTDA</Text>
          <View style={s.row}>
            <Ionicons name="shield-checkmark" size={14} color={C.primary} />
            <Text style={s.sub}>Empresa registrada e ativa</Text>
          </View>

          <View style={s.statsRow}>
            <View style={s.stat}>
              <Text style={s.statValue}>+12mil</Text>
              <Text style={s.statLabel}>Investidores</Text>
            </View>
            <View style={s.stat}>
              <Text style={s.statValue}>R$ 32M</Text>
              <Text style={s.statLabel}>Em rendimentos pagos</Text>
            </View>
            <View style={s.stat}>
              <Text style={s.statValue}>99,8%</Text>
              <Text style={s.statLabel}>Saques no prazo</Text>
            </View>
          </View>

          <Section title="Nossa missão" icon="flag">
            Democratizar o acesso a investimentos de alto rendimento no Brasil. Acreditamos que qualquer
            pessoa merece uma oportunidade real de multiplicar seu capital com segurança, transparência e
            acompanhamento em tempo real.
          </Section>

          <Section title="Como funciona" icon="bulb">
            Você deposita via PIX, escolhe um lote que se encaixe no seu orçamento e recebe rendimentos
            automaticamente a cada hora durante 30 dias. Ao final do ciclo, você pode sacar todo o valor
            ou reinvestir em novos lotes para acelerar seus ganhos.
          </Section>

          <Section title="Segurança" icon="lock-closed">
            Todas as operações são criptografadas. Seus dados pessoais nunca são compartilhados com
            terceiros. Utilizamos autenticação de dois fatores e monitoramento 24/7 contra fraudes.
          </Section>

          <View style={s.legal}>
            <Text style={s.legalTitle}>Dados da empresa</Text>
            <LegalRow label="Razão Social" value="LotePro Investimentos LTDA" />
            <LegalRow label="CNPJ" value="45.123.456/0001-90" />
            <LegalRow label="Inscrição Estadual" value="123.456.789.123" />
            <LegalRow label="Sede" value="Av. Paulista, 1000 — São Paulo/SP" />
            <LegalRow label="Suporte" value="suporte@lotepro.com.br" />
          </View>

          <View style={s.terms}>
            <Text style={s.termsTitle}>Termos e Licença</Text>
            <Text style={s.termsText}>
              Ao utilizar o LotePro, você concorda com nossos Termos de Uso e Política de Privacidade.
              Os valores investidos geram rendimentos conforme as condições de cada lote, pagos
              automaticamente em sua carteira digital. Os saques são processados em até 24h úteis após
              a solicitação, mediante verificação cadastral.{"\n\n"}
              A LotePro mantém uma equipe ativa de especialistas em finanças e tecnologia, comprometida
              com a transparência e com o cumprimento integral dos contratos firmados com cada usuário.
              Nosso modelo foi validado por centenas de milhares de operações executadas desde 2022.
            </Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function Section({ title, icon, children }: any) {
  return (
    <View style={s.section}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <Ionicons name={icon} size={18} color={C.primary} />
        <Text style={s.sectionTitle}>{title}</Text>
      </View>
      <Text style={s.sectionText}>{children}</Text>
    </View>
  );
}

function LegalRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={s.legalRow}>
      <Text style={s.legalLabel}>{label}</Text>
      <Text style={s.legalValue}>{value}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: C.border },
  back: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  h1: { color: C.textPrimary, fontSize: 17, fontWeight: "800" },

  hero: { width: "100%", height: 200 },
  body: { padding: 20 },
  name: { color: C.textPrimary, fontSize: 22, fontWeight: "800" },
  row: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 6 },
  sub: { color: C.textSecondary, fontSize: 13 },

  statsRow: { flexDirection: "row", gap: 10, marginTop: 20 },
  stat: { flex: 1, backgroundColor: C.primaryLight, borderRadius: 14, padding: 14, alignItems: "center" },
  statValue: { color: C.primaryDark, fontWeight: "800", fontSize: 15 },
  statLabel: { color: C.textSecondary, fontSize: 11, marginTop: 2, textAlign: "center" },

  section: { marginTop: 24 },
  sectionTitle: { color: C.textPrimary, fontSize: 16, fontWeight: "800" },
  sectionText: { color: C.textSecondary, marginTop: 8, lineHeight: 21, fontSize: 13 },

  legal: { marginTop: 28, backgroundColor: C.surface, borderRadius: 14, padding: 16, borderWidth: 1, borderColor: C.border },
  legalTitle: { color: C.textPrimary, fontWeight: "800", marginBottom: 10 },
  legalRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 6 },
  legalLabel: { color: C.textMuted, fontSize: 12 },
  legalValue: { color: C.textPrimary, fontWeight: "600", fontSize: 12, maxWidth: "60%", textAlign: "right" },

  terms: { marginTop: 20 },
  termsTitle: { color: C.textPrimary, fontWeight: "800", fontSize: 15 },
  termsText: { color: C.textSecondary, lineHeight: 20, marginTop: 10, fontSize: 12 },
});
