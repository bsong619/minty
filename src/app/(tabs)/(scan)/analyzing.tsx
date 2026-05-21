import { useEffect, useRef, useState } from "react";
import { View, Text, Animated, Easing, Alert } from "react-native";
import { useRouter } from "expo-router";
import { Image } from "expo-image";
import * as FileSystem from "expo-file-system/legacy";
import { analyzeCard } from "@/lib/grading-engine";
import { saveCompleteScan } from "@/lib/card-service";
import { useAuth } from "@/components/auth-provider";
import { saveCard } from "@/lib/storage";
import { consumePendingImageUris } from "@/lib/pending-scan";
import { setPendingResultImages } from "@/lib/pending-result";
import { GradedCard } from "@/lib/types";
import { C } from "@/lib/theme";

async function persistImageLocally(uri: string): Promise<string> {
  // Web: blob URLs are session-only — convert to base64 data URL so they survive reloads
  if (process.env.EXPO_OS === "web") {
    if (uri.startsWith("blob:")) {
      try {
        const res = await fetch(uri);
        const blob = await res.blob();
        return await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });
      } catch {
        return uri;
      }
    }
    return uri; // data: or http: URLs already persist
  }
  // Native: copy temp URIs (e.g. from ImagePicker cache) to permanent document directory
  if (uri.startsWith(FileSystem.documentDirectory ?? "")) return uri;
  if (uri.startsWith("http") || uri.startsWith("data:")) return uri;
  const dir = `${FileSystem.documentDirectory}cards/`;
  await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
  const dest = `${dir}${Date.now()}.jpg`;
  await FileSystem.copyAsync({ from: uri, to: dest });
  return dest;
}

const STEPS = [
  "Identifying your card…",
  "Checking centering alignment…",
  "Inspecting corners & edges…",
  "Scanning surface for flaws…",
  "Calculating your grade…",
];

export default function AnalyzingScreen() {
  const [{ front: imageUri, back: backImageUri }] = useState(() => {
    const { front, back } = consumePendingImageUris();
    return { front: front ?? "", back };
  });
  const [stepIndex, setStepIndex] = useState(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const router = useRouter();
  const { userId, loading: authLoading } = useAuth();
  const pulseAnim = useRef(new Animated.Value(0.3)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;
  const scanLineAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1, duration: 900, easing: Easing.inOut(Easing.ease), useNativeDriver: false }),
        Animated.timing(pulseAnim, { toValue: 0.3, duration: 900, easing: Easing.inOut(Easing.ease), useNativeDriver: false }),
      ])
    ).start();
    Animated.loop(
      Animated.timing(rotateAnim, { toValue: 1, duration: 1600, easing: Easing.linear, useNativeDriver: true })
    ).start();
    Animated.loop(
      Animated.sequence([
        Animated.timing(scanLineAnim, { toValue: 294, duration: 2000, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(scanLineAnim, { toValue: 0, duration: 2000, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    ).start();
    const interval = setInterval(() => setStepIndex((i) => (i + 1) % STEPS.length), 1800);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!imageUri) {
      setErrorMsg("No image selected — please go back and pick a photo.");
      return;
    }
    // Wait for auth to finish resolving on cold start — otherwise we'd save
    // locally when it should have gone to Supabase, and the grade endpoint
    // would reject the request because there's no JWT yet.
    if (authLoading) return;
    setErrorMsg(null);
    let cancelled = false;
    (async () => {
      try {
        const result = await analyzeCard(imageUri, backImageUri ?? undefined);
        if (cancelled) return;
        let cardId: string;
        if (userId) {
          const saved = await saveCompleteScan({ userId, frontImageUri: imageUri, backImageUri: backImageUri ?? undefined, aiResult: result });
          cardId = saved.id;
          setPendingResultImages(imageUri);
        } else {
          const persistedUri = await persistImageLocally(imageUri);
          const card: GradedCard = { id: Date.now().toString(), imageUri: persistedUri, result, timestamp: Date.now(), favorite: false };
          await saveCard(card);
          cardId = card.id;
          setPendingResultImages(persistedUri);
        }
        if (!cancelled) router.replace({ pathname: "/(tabs)/(scan)/results", params: { cardId } });
      } catch (err: any) {
        if (cancelled) return;
        const msg = String(err?.message ?? err);
        if (msg.includes("Network request failed") || msg.includes("fetch")) {
          setErrorMsg("No internet connection. Please check your network and try again.");
        } else {
          setErrorMsg(msg);
        }
      }
    })();
    return () => { cancelled = true; };
  }, [imageUri, retryCount, userId, authLoading, backImageUri, router]);

  const spin = rotateAnim.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] });

  if (errorMsg) {
    return (
      <View style={{ flex: 1, backgroundColor: C.bg, justifyContent: "center", alignItems: "center", padding: 32 }}>
        <View style={{ width: "100%", maxWidth: 480, alignItems: "center", gap: 20 }}>
          <Text style={{ fontSize: 32 }}>⚠️</Text>
          <Text style={{ fontSize: 18, fontWeight: "700", color: C.text, textAlign: "center" }}>Something went wrong</Text>
          <View style={{ backgroundColor: C.surface, borderRadius: 12, padding: 16, borderWidth: 1, borderColor: C.border, width: "100%" }}>
            <Text selectable style={{ fontSize: 13, color: "#FF6B6B", lineHeight: 20 }}>{errorMsg}</Text>
          </View>
          <View style={{ flexDirection: "row", gap: 16, marginTop: 8 }}>
            <Text onPress={() => router.back()} style={{ fontSize: 16, color: C.textSecondary, fontWeight: "600" }}>← Go Back</Text>
            <Text onPress={() => setRetryCount((c) => c + 1)} style={{ fontSize: 16, color: C.red, fontWeight: "600" }}>Try Again →</Text>
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: C.bg, justifyContent: "center", alignItems: "center", padding: 40, gap: 40 }}>
      <View pointerEvents="none" style={{ position: "absolute", top: "20%", left: "50%", marginLeft: -150, width: 300, height: 300, borderRadius: 150, backgroundColor: "rgba(255,215,0,0.04)" }} />

      {/* Card preview with scanner overlay */}
      <View style={{ position: "relative", alignItems: "center", justifyContent: "center" }}>
        <View style={{ width: 210, height: 294, borderRadius: 16, overflow: "hidden" }}>
          {imageUri ? (
            <Image source={{ uri: imageUri }} style={{ width: 210, height: 294 } as any} contentFit="cover" />
          ) : (
            <View style={{ width: 210, height: 294, backgroundColor: C.surface, borderWidth: 1, borderColor: C.border }} />
          )}
          {/* Scanner line constrained inside card */}
          <Animated.View style={{ position: "absolute", left: 0, right: 0, height: 2, backgroundColor: C.gold, opacity: 0.6, transform: [{ translateY: scanLineAnim }] }} />
        </View>
        <Animated.View style={{ position: "absolute", top: -10, left: -10, right: -10, bottom: -10, borderRadius: 22, borderWidth: 2, borderColor: C.gold, opacity: pulseAnim }} />
        {/* Corner accents */}
        {([
          { top: -5, left: -5, borderRightWidth: 0, borderBottomWidth: 0, borderTopLeftRadius: 5 },
          { top: -5, right: -5, borderLeftWidth: 0, borderBottomWidth: 0, borderTopRightRadius: 5 },
          { bottom: -5, left: -5, borderRightWidth: 0, borderTopWidth: 0, borderBottomLeftRadius: 5 },
          { bottom: -5, right: -5, borderLeftWidth: 0, borderTopWidth: 0, borderBottomRightRadius: 5 },
        ] as any[]).map((style, i) => (
          <View key={i} style={[{ position: "absolute", width: 16, height: 16, borderColor: C.gold, borderWidth: 2.5 }, style]} />
        ))}
      </View>

      {/* Status */}
      <View style={{ alignItems: "center", gap: 14, width: "100%" }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
          <Animated.View style={{ transform: [{ rotate: spin }] }}>
            <View style={{ width: 20, height: 20, borderRadius: 10, borderWidth: 2.5, borderColor: C.red, borderTopColor: "transparent" }} />
          </Animated.View>
          <Text style={{ fontSize: 20, fontWeight: "800", color: C.text, letterSpacing: -0.3 }}>Analyzing Card</Text>
        </View>

        <View style={{ height: 36, justifyContent: "center" }}>
          <Text style={{ fontSize: 14, color: C.textSecondary, textAlign: "center" }}>{STEPS[stepIndex]}</Text>
        </View>

        {/* Progress dots */}
        <View style={{ flexDirection: "row", gap: 6, alignItems: "center" }}>
          {STEPS.map((_, i) => (
            <View key={i} style={{ height: 6, borderRadius: 3, backgroundColor: i === stepIndex ? C.gold : C.border, width: i === stepIndex ? 22 : 6 }} />
          ))}
        </View>
      </View>
    </View>
  );
}
