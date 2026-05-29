import React, { useEffect, useState } from "react";
import { Stack } from "expo-router";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { View, ActivityIndicator, LogBox } from "react-native";
import * as Font from "expo-font";
import { Ionicons } from "@expo/vector-icons";
import { AuthProvider } from "../src/AuthContext";
import { initApiBase } from "../src/api";

// Silence the LogBox red banner that shows on Expo Go for unhandled promise
// rejections (they don't affect functionality and confuse users).
LogBox.ignoreAllLogs(true);

// Swallow unhandled promise rejections so they don't show as a red banner.
// (Common when polling endpoints fail intermittently on slow mobile networks.)
const g: any = globalThis as any;
if (g?.process?.on) {
  try { g.process.on("unhandledRejection", () => {}); } catch {}
}
if (typeof window !== "undefined" && (window as any).addEventListener) {
  try {
    (window as any).addEventListener("unhandledrejection", (e: any) => { e?.preventDefault?.(); });
  } catch {}
}

export default function RootLayout() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    (async () => {
      try { await initApiBase(); } catch {}
      try {
        // Load Ionicons font explicitly so icons render reliably on Expo Go
        await Font.loadAsync(Ionicons.font);
      } catch {}
      setReady(true);
    })();
  }, []);

  if (!ready) {
    return (
      <SafeAreaProvider>
        <View style={{ flex: 1, backgroundColor: "#0A0612", alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator color="#39FF14" />
        </View>
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <AuthProvider>
        <StatusBar style="light" />
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: "#0A0612" } }}>
          <Stack.Screen name="index" />
          <Stack.Screen name="(auth)" />
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="lote/[id]" options={{ presentation: "card" }} />
          <Stack.Screen name="deposito" />
          <Stack.Screen name="saque" />
          <Stack.Screen name="sobre" />
          <Stack.Screen name="admin" />
        </Stack>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
