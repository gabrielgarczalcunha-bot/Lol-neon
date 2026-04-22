import { Stack } from "expo-router";
import { Redirect } from "expo-router";
import { useAuth } from "../../src/AuthContext";

export default function AdminLayout() {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (!user || user.role !== "admin") return <Redirect href="/(tabs)" />;
  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: "#FFFFFF" } }} />;
}
