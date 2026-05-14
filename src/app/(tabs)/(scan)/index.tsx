import { useEffect, useCallback, useState } from "react";
import { View, Text, ScrollView, Pressable, Alert } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter, useFocusEffect } from "expo-router";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { hasSeenOnboarding, markOnboardingSeen } from "@/lib/storage";
import { useAuth } from "@/components/auth-provider";
import { setPendingImageUri } from "@/lib/pending-scan";
import { getScannedCards, refreshCardImageUrls } from "@/lib/card-service";
import { getCards } from "@/lib/storage";
import { GradedCard } from "@/lib/types";
import { CardArt, artKindFor } from "@/components/card-art";
import { HoloFoil } from "@/components/holo-foil";
import { Icon, type IconName } from "@/components/icon";
import { C, FONT, SHADOW } from "@/lib/theme";
import { getGradeColor } from "@/lib/grade-colors";
import { canScan, getQuota, FREE_DAILY_LIMIT, type QuotaSnapshot } from "@/lib/scan-quota";

const HORIZ = 20;

export default function ScanScreen() {
  const router = useRouter();
  const { userId, userEmail, isAnonymous, firstName } = useAuth();
  const insets = useSafeAreaInsets();

  const [appReady, setAppReady] = useState(false);
  const [recents, setRecents] = useState<GradedCard[]>([]);
  const [quota, setQuota] = useState<QuotaSnapshot>({ used: 0, limit: FREE_DAILY_LIMIT, remaining: FREE_DAILY_LIMIT, isPro: false });

  // Refresh quota whenever the scan tab regains focus — it changes after every
  // successful grade and after the paywall.
  useFocusEffect(
    useCallback(() => {
      getQuota().then(setQuota);
    }, [])
  );

  useEffect(() => {
    const t = setTimeout(() => setAppReady(true), 500);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (!userId || !appReady) return;
    hasSeenOnboarding().then((seen) => {
      if (!seen) {
        markOnboardingSeen().catch(() => {});
        router.push("/onboarding" as any);
      }
    });
  }, [userId, appReady]);

  useFocusEffect(
    useCallback(() => {
      (async () => {
        try {
          if (userId) {
            const cards = await getScannedCards(userId, { limit: 8 });
            setRecents(await refreshCardImageUrls(cards));
          } else {
            const cards = await getCards();
            setRecents(cards.slice(0, 8));
          }
        } catch {}
      })();
    }, [userId])
  );

  const handleImageSelected = useCallback((uri: string) => {
    setPendingImageUri(uri);
    router.push("/(tabs)/(scan)/analyzing");
  }, [router]);

  // Apple Guideline 2.1 (AI): consent surfaced via a persistent visible
  // banner on this screen (see "AI disclosure" below) + Privacy Policy.
  // No blocking modal — using the Scan button is itself the consent action.
  const takePhoto = useCallback(async () => {
    if (!(await canScan())) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      router.push("/scan-limit" as any);
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push("/(tabs)/(scan)/camera");
  }, [router]);

  const pickImage = useCallback(async () => {
    if (!(await canScan())) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      router.push("/scan-limit" as any);
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.9 });
    if (result.canceled) return;
    handleImageSelected(result.assets[0].uri);
  }, [handleImageSelected, router]);

  const greeting = greetingFor(new Date());
  const displayName = isAnonymous
    ? "FRIEND"
    : (firstName?.toUpperCase() || userEmail?.split("@")[0]?.toUpperCase() || "FRIEND");

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      style={{ flex: 1, backgroundColor: C.bg }}
      contentContainerStyle={{ paddingBottom: 24, paddingTop: 6 }}
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <View style={{ paddingHorizontal: HORIZ, paddingTop: 12, flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10, flexShrink: 1, minWidth: 0 }}>
          <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: C.surface, borderWidth: 1, borderColor: C.borderStrong, justifyContent: "center", alignItems: "center" }}>
            <Icon name="shield" size={18} color={C.mint} strokeWidth={1.8} />
          </View>
          <View style={{ flexShrink: 1, minWidth: 0 }}>
            <Text style={{ fontFamily: FONT.display, fontSize: 22, lineHeight: 22, color: C.text, letterSpacing: -0.5 }}>Salty 🧪</Text>
            <Text numberOfLines={1} style={{ fontFamily: FONT.mono, fontSize: 10, color: C.textTertiary, marginTop: 2, letterSpacing: 0.5 }}>{greeting}, {displayName}</Text>
          </View>
        </View>
        {/* Scan-counter pill — Pro hides it; free tier shows N / 5 LEFT. Tap = paywall. */}
        {quota.isPro ? (
          <View style={{
            flexDirection: "row", alignItems: "center", gap: 6,
            paddingVertical: 6, paddingHorizontal: 10, borderRadius: 100,
            backgroundColor: C.surface, borderWidth: 1, borderColor: C.mintFaint,
          }}>
            <Text style={{ fontSize: 11 }}>✦</Text>
            <Text style={{ fontFamily: FONT.monoBold, fontSize: 11, color: C.mint, letterSpacing: 0.5 }}>PRO</Text>
          </View>
        ) : (
          <View
            style={{
              flexDirection: "row", alignItems: "center", gap: 6,
              paddingVertical: 7, paddingHorizontal: 12, borderRadius: 100,
              backgroundColor: C.surface, borderWidth: 1, borderColor: C.border,
              flexShrink: 0,
            }}
          >
            <Text style={{ fontFamily: FONT.uiBold, fontSize: 12, color: C.mint }}>{quota.remaining}</Text>
            <Text numberOfLines={1} style={{ fontFamily: FONT.ui, fontSize: 11, color: C.textSecondary }}>scans left today</Text>
          </View>
        )}
      </View>

      {/* Hero card */}
      <View style={{ paddingHorizontal: HORIZ, paddingTop: 20 }}>
        <View style={{ borderRadius: 24, overflow: "hidden", borderWidth: 1, borderColor: C.mintFaint, position: "relative", minHeight: 200 }}>
          <LinearGradient
            colors={["rgba(72,229,176,0.18)", "rgba(122,174,240,0.12)", C.bg]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            locations={[0, 0.6, 1]}
            style={{ padding: 22, minHeight: 200 }}
          >
            {/* Floating sample cards (decorative) */}
            <View style={{ position: "absolute", right: -30, top: 16, transform: [{ rotate: "8deg" }], opacity: 0.85, ...({ boxShadow: SHADOW.hero } as any) }}>
              <View style={{ borderRadius: 10, overflow: "hidden", position: "relative" }}>
                <CardArt kind="charizard" width={120} height={168} />
                <HoloFoil intensity={0.5} />
              </View>
            </View>
            <View style={{ position: "absolute", right: 60, top: 30, transform: [{ rotate: "-6deg" }], opacity: 0.7 }}>
              <View style={{ borderRadius: 10, overflow: "hidden", ...({ boxShadow: SHADOW.card } as any) }}>
                <CardArt kind="pikachu" width={110} height={154} />
              </View>
            </View>

            <View>
              <View style={{ flexDirection: "row", alignSelf: "flex-start", alignItems: "center", gap: 5, paddingVertical: 3, paddingHorizontal: 8, borderRadius: 100, backgroundColor: C.mint }}>
                <Text style={{ fontSize: 8, color: C.onMint }}>●</Text>
                <Text style={{ fontFamily: FONT.monoBold, fontSize: 9, color: C.onMint, letterSpacing: 1 }}>READY</Text>
              </View>
              <Text style={{ fontFamily: FONT.display, fontSize: 36, color: C.text, lineHeight: 38, letterSpacing: -1.5, marginTop: 12, maxWidth: 200 }}>
                What&apos;s in{"\n"}your stack?
              </Text>
              <Pressable
                onPress={takePhoto}
                style={({ pressed }) => ({
                  marginTop: 16, alignSelf: "flex-start",
                  flexDirection: "row", alignItems: "center", gap: 8,
                  paddingVertical: 12, paddingHorizontal: 18, borderRadius: 12,
                  backgroundColor: C.mint,
                  opacity: pressed ? 0.85 : 1,
                  ...({ boxShadow: SHADOW.glow } as any),
                })}
              >
                <Icon name="camera" size={15} color={C.onMint} strokeWidth={2.5} />
                <Text style={{ fontFamily: FONT.uiBold, fontSize: 14, color: C.onMint, paddingRight: 3 }}>Scan a card</Text>
              </Pressable>
            </View>
          </LinearGradient>
        </View>
      </View>

      {/* AI disclosure banner — Apple Guideline 2.1 in-UI consent surface */}
      <Pressable
        onPress={() => router.push("/privacy" as any)}
        style={({ pressed }) => ({
          marginHorizontal: HORIZ, marginTop: 10,
          flexDirection: "row", alignItems: "center", gap: 8,
          paddingVertical: 8, paddingHorizontal: 12, borderRadius: 10,
          backgroundColor: C.surface, borderWidth: 1, borderColor: C.borderSubtle,
          opacity: pressed ? 0.7 : 1,
        })}
      >
        <Icon name="info" size={12} color={C.textTertiary} />
        <Text numberOfLines={2} style={{ flex: 1, fontSize: 11, color: C.textTertiary, lineHeight: 15 }}>
          Scans are analyzed by AI. Not used to train models.{" "}
          <Text style={{ color: C.mint, fontFamily: FONT.uiBold }}>Learn more</Text>
        </Text>
      </Pressable>

      {/* Every scan includes — v2 value strip */}
      <View style={{ paddingHorizontal: HORIZ, paddingTop: 18 }}>
        <Text style={{ fontFamily: FONT.monoBold, fontSize: 10, color: C.textTertiary, letterSpacing: 1.5, marginBottom: 10 }}>EVERY SCAN INCLUDES</Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          {([
            { i: "sparkles", t: "AI grade 1–10",   d: "Centering, corners, edges, surface" },
            { i: "trend",    t: "Market value",    d: "Live estimates from recent listings" },
            { i: "stack",    t: "Vault entry",     d: "Saved automatically to your collection" },
            { i: "share",    t: "Share card",      d: "Beautiful image to share anywhere" },
          ] as { i: IconName; t: string; d: string }[]).map((f) => (
            <View key={f.t} style={{
              width: "48.5%",
              backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, borderRadius: 12, padding: 12,
            }}>
              <View style={{ width: 32, height: 32, borderRadius: 8, backgroundColor: C.mintFaint, justifyContent: "center", alignItems: "center", marginBottom: 8 }}>
                <Icon name={f.i} size={14} color={C.mint} />
              </View>
              <Text style={{ fontSize: 12, fontFamily: FONT.uiBold, color: C.text }}>{f.t}</Text>
              <Text style={{ fontSize: 10, color: C.textTertiary, marginTop: 3, lineHeight: 13 }}>{f.d}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* Recent grades */}
      {recents.length > 0 && (
        <View style={{ paddingTop: 22 }}>
          <View style={{ paddingHorizontal: HORIZ, flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <Text style={{ fontSize: 14, fontFamily: FONT.uiBold, color: C.text }}>Recent grades</Text>
            <Pressable onPress={() => router.push("/(tabs)/(collection)" as any)}>
              <Text style={{ fontSize: 12, color: C.mint, fontFamily: FONT.uiBold }}>See all</Text>
            </Pressable>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingHorizontal: HORIZ, paddingBottom: 4 }}>
            {recents.slice(0, 6).map((c) => {
              const color = getGradeColor(c.result.overallGrade);
              return (
                <Pressable
                  key={c.id}
                  onPress={() => router.push({ pathname: "/(tabs)/(collection)/details", params: { cardId: c.id } } as any)}
                  style={{ width: 116 }}
                >
                  <View style={{ borderRadius: 10, overflow: "hidden", position: "relative" }}>
                    {c.imageUri ? (
                      <Image source={{ uri: c.imageUri }} style={{ width: 116, height: 162, borderRadius: 10 }} contentFit="cover" />
                    ) : (
                      <CardArt kind={artKindFor(c.result.cardName)} width={116} height={162} />
                    )}
                    {c.result.overallGrade >= 9.5 && <HoloFoil intensity={0.3} />}
                    <View style={{
                      position: "absolute", top: 6, right: 6,
                      paddingVertical: 3, paddingHorizontal: 8, borderRadius: 6,
                      backgroundColor: "rgba(11,13,14,0.85)", borderWidth: 1, borderColor: `${color}80`,
                    }}>
                      <Text style={{ fontFamily: FONT.display, fontSize: 14, color, lineHeight: 14 }}>{c.result.overallGrade}</Text>
                    </View>
                  </View>
                  <Text numberOfLines={1} style={{ fontSize: 11, color: C.text, marginTop: 6, fontFamily: FONT.uiBold }}>{c.result.cardName}</Text>
                  <Text numberOfLines={1} style={{ fontFamily: FONT.mono, fontSize: 9, color: C.textTertiary, letterSpacing: 0.3 }}>
                    {c.result.cardYear} · {(c.result.cardSet || "").toUpperCase()}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      )}

      {/* Empty state if no recents */}
      {recents.length === 0 && (
        <View style={{ paddingHorizontal: HORIZ, paddingTop: 30, alignItems: "center", gap: 12 }}>
          <View style={{ width: 64, height: 64, borderRadius: 18, backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, justifyContent: "center", alignItems: "center" }}>
            <Icon name="sparkles" size={28} color={C.mint} strokeWidth={1.5} />
          </View>
          <Text style={{ fontSize: 14, color: C.text, fontFamily: FONT.uiBold, textAlign: "center", alignSelf: "stretch" }}>Your first scan awaits</Text>
          <Text style={{ fontSize: 12, color: C.textSecondary, textAlign: "center", maxWidth: 260, lineHeight: 18 }}>
            Tap &ldquo;Scan a card&rdquo; above to get an AI grade in seconds.
          </Text>
        </View>
      )}
    </ScrollView>
  );
}

function greetingFor(now: Date): string {
  const h = now.getHours();
  if (h < 12) return "GOOD MORNING";
  if (h < 18) return "GOOD AFTERNOON";
  return "GOOD EVENING";
}
