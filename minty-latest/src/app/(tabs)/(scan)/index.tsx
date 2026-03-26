import { useEffect, useCallback } from "react";
import { View, Text, ScrollView, Alert } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { Asset } from "expo-asset";
import ScanButton from "@/components/scan-button";
import { hasSeenOnboarding } from "@/lib/storage";
import { useAuth } from "@/components/auth-provider";
import { setPendingImageUri } from "@/lib/pending-scan";
import { checkScanLimit } from "@/lib/card-service";
import { C, SHADOW } from "@/lib/theme";

// Pokéball drawn from primitives — no trademark, just the shape every collector knows
function Pokeball({ size = 64 }: { size?: number }) {
  const r = size / 2;
  return (
    <View style={{ width: size, height: size, borderRadius: r, borderWidth: 3, borderColor: C.red, overflow: "hidden", backgroundColor: "transparent" }}>
      <View style={{ width: size, height: r, backgroundColor: `${C.red}40` }} />
      <View style={{ width: size, height: r, backgroundColor: C.white04 }} />
      <View style={{ position: "absolute", top: r - 1.5, left: 0, right: 0, height: 3, backgroundColor: C.red }} />
      <View style={{ position: "absolute", top: r - 10, left: r - 10, width: 20, height: 20, borderRadius: 10, backgroundColor: C.bg, borderWidth: 3, borderColor: C.red }} />
      <View style={{ position: "absolute", top: r - 5, left: r - 5, width: 10, height: 10, borderRadius: 5, backgroundColor: `${C.red}60` }} />
    </View>
  );
}

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

  useEffect(() => {
    hasSeenOnboarding().then((seen) => {
      if (!seen) router.push("/onboarding" as any);
    });
  }, []);

  const handleImageSelected = useCallback((uri: string) => {
    setPendingImageUri(uri);
    router.push("/(tabs)/(scan)/analyzing");
  }, [router]);

  const checkLimitAndProceed = useCallback(async (launcher: () => Promise<string | null>) => {
    try {
      if (userId) {
        const limit = await checkScanLimit(userId);
        if (!limit.canScan) {
          Alert.alert(
            "Out of Energy!",
            "You've used all 3 free scans today. Go Pro for unlimited grading power!",
            [
              { text: "Not Now", style: "cancel" },
              { text: "Power Up!", onPress: () => router.push("/paywall" as any) },
            ]
          );
          return;
        }
      }
      const uri = await launcher();
      if (!uri) return;
      handleImageSelected(uri);
    } catch (err: any) {
      console.error("Scan error:", err);
    }
  }, [userId, handleImageSelected, router]);

  const takePhoto = useCallback(async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Camera Permission", "Camera access is needed to photograph your cards.");
      return null;
    }
    const result = await ImagePicker.launchCameraAsync({ mediaTypes: ["images"], quality: 0.9, allowsEditing: true, aspect: [63, 88] });
    if (result.canceled) return null;
    return result.assets[0].uri;
  }, []);

  const pickImage = useCallback(async () => {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.9 });
    if (result.canceled) return null;
    return result.assets[0].uri;
  }, []);

  const testScan = useCallback(async () => {
    const [asset] = await Asset.loadAsync(require("@/assets/test-card.png"));
    handleImageSelected(asset.localUri ?? asset.uri);
  }, [handleImageSelected]);

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      style={{ flex: 1, backgroundColor: C.bg }}
      contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: insets.bottom + 90, paddingTop: 8 }}
    >
      {/* Hero */}
      <View style={{ borderRadius: 20, borderCurve: "continuous", padding: 20, alignItems: "center", flexDirection: "row", gap: 16, backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, boxShadow: SHADOW.card, overflow: "hidden" }}>
        <Pokeball size={52} />
        <View style={{ flex: 1, gap: 4 }}>
          <Text style={{ fontSize: 20, fontWeight: "800", color: C.text, letterSpacing: -0.5 }}>
            Is It Minty?
          </Text>
          <Text style={{ fontSize: 13, color: C.textSecondary, lineHeight: 18 }}>
            AI-powered PSA grade prediction in seconds
          </Text>
        </View>
      </View>

      {/* Scan buttons */}
      <View style={{ gap: 10 }}>
        <ScanButton icon="camera.fill" label="Snap Your Card" subtitle="Photograph your card for instant grading" onPress={() => checkLimitAndProceed(takePhoto)} />
        <ScanButton icon="photo.on.rectangle" label="Choose from Library" subtitle="Grade a card from your photo collection" onPress={() => checkLimitAndProceed(pickImage)} />
        {__DEV__ && (
          <ScanButton icon="checkmark.seal.fill" label="Test Scan" subtitle="Grade a sample 1st Edition Charizard" onPress={testScan} />
        )}
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
                  <Text style={{ fontSize: 13, fontWeight: "700", color: C.gold }}>{ i + 1}</Text>
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
