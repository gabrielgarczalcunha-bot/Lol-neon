import React, { useCallback, useEffect } from "react";
import { Stack } from "expo-router";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { View, LogBox } from "react-native";
import { useFonts } from "expo-font";
import { Ionicons, MaterialCommunityIcons, MaterialIcons, FontAwesome } from "@expo/vector-icons";
import * as SplashScreen from "expo-splash-screen";
import { AuthProvider } from "../src/AuthContext";
import { initApiBase } from "../src/api";

LogBox.ignoreAllLogs(true);
const g: any = globalThis as any;
if (g?.process?.on) { try { g.process.on("unhandledRejection", () => {}); } catch {} }
if (typeof window !== "undefined" && (window as any).addEventListener) {
  try { (window as any).addEventListener("unhandledrejection", (e: any) => { e?.preventDefault?.(); }); } catch {}
}

// Keep the native splash up until fonts and base config are ready
SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    ...Ionicons.font,
    ...MaterialCommunityIcons.font,
    ...MaterialIcons.font,
    ...FontAwesome.font,
  });

  useEffect(() => {
    (async () => { try { await initApiBase(); } catch {} })();
  }, []);

  const onLayoutRootView = useCallback(async () => {
    if (fontsLoaded || fontError) {
      try { await SplashScreen.hideAsync(); } catch {}
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) return null;

  return (
    <SafeAreaProvider>
      <View style={{ flex: 1, backgroundColor: "#0A0612" }} onLayout={onLayoutRootView}>
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
      </View>
    </SafeAreaProvider>
  );
}
