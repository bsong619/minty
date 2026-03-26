import { useEffect } from "react";
import Stack from "expo-router/stack";
import { useRouter, useSegments } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { ThemeProvider } from "@/components/theme-provider";
import AuthProvider, { useAuth } from "@/components/auth-provider";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";

export const AUTH_FLOW_KEY = "auth_flow_seen";

function AuthGate() {
  const { loading, userId, pendingLogout, signOut } = useAuth();
  const router = useRouter();
  const segments = useSegments();

  // Handle explicit sign-out request from anywhere in the app
  useEffect(() => {
    if (!pendingLogout) return;
    AsyncStorage.removeItem(AUTH_FLOW_KEY)
      .then(() => signOut())
      .catch(() => {})
      .finally(() => router.replace("/login"));
  }, [pendingLogout]);

  // Redirect to login if auth flow hasn't been completed
  useEffect(() => {
    if (loading) return;
    AsyncStorage.getItem(AUTH_FLOW_KEY).then((val) => {
      const inLogin = segments[0] === "login";
      if (!val && !inLogin) router.replace("/login");
    });
  }, [loading, userId]);

  // Handle PASSWORD_RECOVERY deep link (from reset email)
  useEffect(() => {
    if (!isSupabaseConfigured) return;
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        router.push("/reset-password" as any);
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  return null;
}

export default function Layout() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <AuthGate />
        <Stack
          screenOptions={{
            headerShown: false,
            animation: "slide_from_right",
            contentStyle: { backgroundColor: "#0A0A0C" },
          }}
        >
          <Stack.Screen name="login" options={{ animation: "fade" }} />
          <Stack.Screen name="(tabs)" options={{ animation: "fade" }} />
          <Stack.Screen name="onboarding" options={{ animation: "slide_from_bottom" }} />
          <Stack.Screen name="forgot-password" options={{ presentation: "modal", animation: "slide_from_bottom", headerShown: false }} />
          <Stack.Screen name="reset-password" options={{ presentation: "modal", animation: "slide_from_bottom", headerShown: false }} />
          <Stack.Screen name="paywall" options={{ presentation: "modal", animation: "slide_from_bottom", headerShown: false }} />
          <Stack.Screen name="terms" options={{ presentation: "modal", animation: "slide_from_bottom", headerShown: false }} />
          <Stack.Screen name="privacy" options={{ presentation: "modal", animation: "slide_from_bottom", headerShown: false }} />
        </Stack>
      </AuthProvider>
    </ThemeProvider>
  );
}
