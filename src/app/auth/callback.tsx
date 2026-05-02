import { useEffect } from "react";
import { View, ActivityIndicator } from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { supabase } from "@/lib/supabase";
import { C } from "@/lib/theme";

export default function AuthCallbackScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ code?: string }>();

  useEffect(() => {
    async function handleCallback() {
      if (params.code && supabase) {
        try {
          await supabase.auth.exchangeCodeForSession(params.code);
        } catch {
          // exchange failed — fall through to scan; AuthGate will redirect to login if no session
        }
      }
      router.replace("/(tabs)/(scan)" as any);
    }
    handleCallback();
  }, [params.code]);

  return (
    <View style={{ flex: 1, backgroundColor: C.bg, justifyContent: "center", alignItems: "center" }}>
      <ActivityIndicator color={C.red} size="large" />
    </View>
  );
}
