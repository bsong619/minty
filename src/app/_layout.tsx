import { useEffect, useState } from "react";
import { View } from "react-native";
import * as SplashScreen from "expo-splash-screen";
import * as Updates from "expo-updates";
import Stack from "expo-router/stack";
import { useRouter, useSegments } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { ThemeProvider } from "@/components/theme-provider";
import AuthProvider, { useAuth } from "@/components/auth-provider";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";

export const AUTH_FLOW_KEY = "auth_flow_seen";

export const unstable_settings = {
  initialRouteName: "login",
};

// Keep native splash visible until we're ready
SplashScreen.preventAutoHideAsync();

function AuthGate({ onReady }: { onReady: () => void }) {
  const { loading, userId, pendingLogout, signOut } = useAuth();
  const router = useRouter();
  const segments = useSegments();
  const [resolved, setResolved] = useState(false);

  // Handle explicit sign-out
  useEffect(() => {
    if (!pendingLogout) return;
    AsyncStorage.removeItem(AUTH_FLOW_KEY)
      .then(() => signOut())
      .catch(() => {})
      .finally(() => router.replace("/login"));
  }, [pendingLogout]);

  // Auth routing — runs once loading completes
  useEffect(() => {
    if (loading) return;

    AsyncStorage.getItem(AUTH_FLOW_KEY).then((val) => {
      const inAuthFlow =
        segments[0] === "login" ||
        segments[0] === "forgot-password" ||
        segments[0] === "reset-password" ||
        segments[0] === "auth";

      if (val && inAuthFlow) {
        router.replace("/(tabs)/(scan)" as any);
      } else if (!val && !inAuthFlow) {
        router.replace("/login");
      }

      // Signal that auth routing is done
      if (!resolved) {
        setResolved(true);
        // Wait for navigation to actually commit before hiding splash
        setTimeout(() => onReady(), 300);
      }
    });
  }, [loading, userId]);

  // Redirect to login on subsequent checks (e.g. after token expiry)
  useEffect(() => {
    if (!resolved || loading) return;
    AsyncStorage.getItem(AUTH_FLOW_KEY).then((val) => {
      if (!val && segments[0] !== "login") {
        router.replace("/login");
      }
    });
  }, [segments, resolved]);

  // Handle PASSWORD_RECOVERY deep link
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
  const [ready, setReady] = useState(false);

  // Check for OTA updates on launch
  useEffect(() => {
    if (__DEV__) return;
    (async () => {
      try {
        const update = await Updates.checkForUpdateAsync();
        if (update.isAvailable) {
          await Updates.fetchUpdateAsync();
          await Updates.reloadAsync();
        }
      } catch (_) {}
    })();
  }, []);

  const handleReady = () => {
    setReady(true);
    SplashScreen.hideAsync();
  };

  return (
    <ThemeProvider>
      <AuthProvider>
        <AuthGate onReady={handleReady} />
        {/* Black overlay hides the Stack contents until auth resolves */}
        {!ready && (
          <View
            style={{
              position: "absolute",
              top: 0, left: 0, right: 0, bottom: 0,
              backgroundColor: "#0A0A0C",
              zIndex: 9999,
            }}
          />
        )}
        <Stack
          screenOptions={{
            headerShown: false,
            animation: "none",
            contentStyle: { backgroundColor: "#0A0A0C" },
          }}
        >
          <Stack.Screen name="login" options={{ animation: "none" }} />
          <Stack.Screen name="(tabs)" options={{ animation: "none" }} />
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
