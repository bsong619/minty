import { useEffect, useCallback, useState } from "react";
import { View, Text, ScrollView } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import ScanButton from "@/components/scan-button";
import { hasSeenOnboarding } from "@/lib/storage";
import { useAuth } from "@/components/auth-provider";
import { setPendingImageUri } from "@/lib/pending-scan";
import { C } from "@/lib/theme";

const TIPS = [
  { text: "Place card on a dark, flat surface" },
  { text: "Use even lighting — avoid glare and shadows" },
  { text: "Fill the frame entirely with the card" },
  { text: "Keep camera parallel and in focus" },
];

export default function ScanScreen() {
  const router = useRouter();
  const { userId } = useAuth();
  const insets = useSafeAreaInsets();

  const [appReady, setAppReady] = useState(false);

  // Delay onboarding check to avoid pushing during initial auth routing
  useEffect(() => {
    const timer = setTimeout(() => setAppReady(true), 500);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!userId || !appReady) return;
    hasSeenOnboarding().then((seen) => {
      if (!seen) router.push("/onboarding" as any);
    });
  }, [userId, appReady]);

  const handleImageSelected = useCallback((uri: string) => {
    setPendingImageUri(uri);
    router.push("/(tabs)/(scan)/analyzing");
  }, [router]);

  const proceed = useCallback(async (launcher: () => Promise<string | null>) => {
    try {
      const uri = await launcher();
      if (!uri) return;
      handleImageSelected(uri);
    } catch (err: any) {
      console.error("Scan error:", err);
    }
  }, [handleImageSelected]);

  const takePhoto = useCallback(() => {
    router.push("/(tabs)/(scan)/camera");
  }, [router]);

  const pickImage = useCallback(async () => {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.9 });
    if (result.canceled) return null;
    return result.assets[0].uri;
  }, []);

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      style={{ flex: 1, backgroundColor: C.bg }}
      contentContainerStyle={{ padding: 16, gap: 24, paddingBottom: insets.bottom + 90, paddingTop: 24 }}
    >
      {/* Hero */}
      <View style={{ alignItems: "center", gap: 12 }}>
        <View style={{ width: 64, height: 64, borderRadius: 16, borderCurve: "continuous", backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, justifyContent: "center", alignItems: "center" }}>
          <Text style={{ fontSize: 28, fontWeight: "900", color: C.red }}>M</Text>
        </View>
        <View style={{ alignItems: "center", gap: 6 }}>
          <Text style={{ fontSize: 28, fontWeight: "800", color: C.text, letterSpacing: -0.5 }}>Is It Minty?</Text>
          <Text style={{ fontSize: 14, color: C.textSecondary, textAlign: "center" }}>AI-powered PSA grade prediction in seconds</Text>
        </View>
      </View>

      {/* Scan buttons */}
      <View style={{ gap: 10 }}>
        <ScanButton icon="camera.fill" label="Snap Your Card" subtitle="Photograph your card for instant grading" onPress={takePhoto} />
        <ScanButton icon="photo.on.rectangle" label="Choose from Library" subtitle="Grade a card from your photo collection" onPress={() => proceed(pickImage)} />
        <ScanButton icon="checkmark.seal.fill" label="Try a Sample Card" subtitle="Grade this Charizard XY Evolutions card" onPress={() => handleImageSelected("https://images.pokemontcg.io/xy12/11_hires.png")} />
      </View>

      {/* Tips */}
      <View style={{ gap: 10 }}>
        <Text style={{ fontSize: 12, fontWeight: "700", color: C.textTertiary, textTransform: "uppercase", letterSpacing: 1, marginLeft: 2 }}>
          Trainer Tips
        </Text>
        <View style={{ borderRadius: 16, borderCurve: "continuous", backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, overflow: "hidden" }}>
          {TIPS.map(({ text }, i) => (
            <View key={i}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 14, padding: 14 }}>
                <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: C.goldFaint, justifyContent: "center", alignItems: "center" }}>
                  <Text style={{ fontSize: 13, fontWeight: "700", color: C.gold }}>{i + 1}</Text>
                </View>
                <Text style={{ fontSize: 14, color: C.textSecondary, flex: 1, lineHeight: 20 }}>{text}</Text>
              </View>
              {i < TIPS.length - 1 && <View style={{ height: 1, backgroundColor: C.borderSubtle, marginLeft: 60 }} />}
            </View>
          ))}
        </View>
      </View>

      <Text selectable style={{ fontSize: 11, color: C.textDisabled, textAlign: "center", lineHeight: 16 }}>
        Minty provides estimates only. Predicted grades may differ from official PSA results.
      </Text>
    </ScrollView>
  );
}
