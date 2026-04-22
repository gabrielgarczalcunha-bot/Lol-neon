import React, { useEffect } from "react";
import { View, ActivityIndicator, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "../src/AuthContext";
import { C } from "../src/theme";

export default function Index() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (user) router.replace("/(tabs)");
    else router.replace("/(auth)/login");
  }, [loading, user]);

  return (
    <View style={s.c} testID="splash-screen">
      <ActivityIndicator size="large" color={C.primary} />
    </View>
  );
}

const s = StyleSheet.create({
  c: { flex: 1, backgroundColor: C.bg, alignItems: "center", justifyContent: "center" },
});
