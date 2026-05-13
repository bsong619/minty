import { useEffect, useState } from "react";
import { View } from "react-native";
import * as SplashScreen from "expo-splash-screen";
import * as Updates from "expo-updates";
import Stack from "expo-router/stack";
import { useRouter, useSegments } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  Inter_800ExtraBold,
} from "@expo-google-fonts/inter";
import { InstrumentSerif_400Regular, InstrumentSerif_400Regular_Italic } from "@expo-google-fonts/instrument-serif";
import { JetBrainsMono_500Medium, JetBrainsMono_700Bold } from "@expo-google-fonts/jetbrains-mono";
import { useFonts } from "expo-font";
import { ThemeProvider } from "@/components/theme-provider";
import AuthProvider, { useAuth } from "@/components/auth-provider";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { initIAP } from "@/lib/iap";

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

  // Init IAP once we know who the user is. No-op if RC isn't configured.
  useEffect(() => {
    if (loading) return;
    initIAP(userId).catch(() => {});
  }, [loading, userId]);

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

  // Bidirectional guard: signed-out users must stay in the auth flow, and
  // signed-in users must never reach a login/forgot/reset screen (e.g. via
  // swipe-back gesture). Runs on every navigation.
  useEffect(() => {
    if (!resolved || loading) return;
    AsyncStorage.getItem(AUTH_FLOW_KEY).then((val) => {
      const inAuthFlow =
        segments[0] === "login" ||
        segments[0] === "forgot-password" ||
        segments[0] === "reset-password" ||
        segments[0] === "auth";
      if (!val && !inAuthFlow) {
        router.replace("/login");
      } else if (val && inAuthFlow) {
        router.replace("/(tabs)/(scan)" as any);
      }
    });
  }, [segments, resolved]);

  // Handle PASSWORD_RECOVERY deep link
  useEffect(() => {
    if (!isSupabaseConfigured) return;
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event: string) => {
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
  const [fontsLoaded, fontError] = useFonts({
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    Inter_800ExtraBold,
    InstrumentSerif_400Regular,
    InstrumentSerif_400Regular_Italic,
    JetBrainsMono_500Medium,
    JetBrainsMono_700Bold,
  });
  // If a font fails to load, treat as "loaded" so we don't soft-lock the user
  // on a black screen. They get system font fallback.
  const [fontTimeout, setFontTimeout] = useState(false);
  const fontsReady = fontsLoaded || !!fontError || fontTimeout;
  useEffect(() => {
    const t = setTimeout(() => setFontTimeout(true), 5000);
    return () => clearTimeout(t);
  }, []);

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

  const [authResolved, setAuthResolved] = useState(false);
  const handleReady = () => setAuthResolved(true);

  useEffect(() => {
    if (fontsReady && authResolved) {
      setReady(true);
      SplashScreen.hideAsync();
    }
  }, [fontsReady, authResolved]);

  return (
    <ThemeProvider>
      <AuthProvider>
        <AuthGate onReady={handleReady} />
        {/* Black overlay hides the Stack contents until auth + fonts resolve */}
        {(!ready || !fontsReady) && (
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
          <Stack.Screen name="terms" options={{ presentation: "modal", animation: "slide_from_bottom", headerShown: false }} />
          <Stack.Screen name="privacy" options={{ presentation: "modal", animation: "slide_from_bottom", headerShown: false }} />
          <Stack.Screen name="paywall" options={{ presentation: "modal", animation: "slide_from_bottom", headerShown: false }} />
          <Stack.Screen name="scan-limit" options={{ presentation: "modal", animation: "slide_from_bottom", headerShown: false }} />
          <Stack.Screen name="customer-center" options={{ presentation: "modal", animation: "slide_from_bottom", headerShown: false }} />
          <Stack.Screen name="streak" options={{ presentation: "modal", animation: "slide_from_bottom", headerShown: false }} />
          <Stack.Screen name="share" options={{ presentation: "modal", animation: "slide_from_bottom", headerShown: false }} />
          <Stack.Screen name="reveal" options={{ presentation: "transparentModal", animation: "fade", headerShown: false }} />
        </Stack>
      </AuthProvider>
    </ThemeProvider>
  );
}
