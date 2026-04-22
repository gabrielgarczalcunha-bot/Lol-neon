import React from "react";
import { Stack } from "expo-router";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { AuthProvider } from "../src/AuthContext";

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <StatusBar style="dark" />
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: "#FFFFFF" } }}>
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
