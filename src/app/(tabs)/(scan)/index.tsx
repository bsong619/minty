import { useEffect, useCallback, useState } from "react";
import { View, Text, ScrollView, Pressable } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { hasSeenOnboarding } from "@/lib/storage";
import { useAuth } from "@/components/auth-provider";
import { setPendingImageUri } from "@/lib/pending-scan";
import { getScannedCards, refreshCardImageUrls } from "@/lib/card-service";
import { getCards } from "@/lib/storage";
import { GradedCard } from "@/lib/types";
import { CardArt, artKindFor } from "@/components/card-art";
import { HoloFoil } from "@/components/holo-foil";
import { Icon } from "@/components/icon";
import { C, FONT, SHADOW } from "@/lib/theme";
import { getGradeColor } from "@/lib/grade-colors";

const HORIZ = 20;

export default function ScanScreen() {
  const router = useRouter();
  const { userId, userEmail, isAnonymous } = useAuth();
  const insets = useSafeAreaInsets();

  const [appReady, setAppReady] = useState(false);
  const [recents, setRecents] = useState<GradedCard[]>([]);

  useEffect(() => {
    const t = setTimeout(() => setAppReady(true), 500);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (!userId || !appReady) return;
    hasSeenOnboarding().then((seen) => {
      if (!seen) router.push("/onboarding" as any);
    });
  }, [userId, appReady]);

  useEffect(() => {
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
  }, [userId]);

  const handleImageSelected = useCallback((uri: string) => {
    setPendingImageUri(uri);
    router.push("/(tabs)/(scan)/analyzing");
  }, [router]);

  const takePhoto = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push("/(tabs)/(scan)/camera");
  }, [router]);

  const pickImage = useCallback(async () => {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.9 });
    if (result.canceled) return;
    handleImageSelected(result.assets[0].uri);
  }, [handleImageSelected]);

  // Stat values — derived once we wire to real data; placeholders for now.
  const scansCount = recents.length;
  const gemsCount = recents.filter(r => r.result.overallGrade >= 9.5).length;
  const greeting = greetingFor(new Date());
  const displayName = isAnonymous ? "FRIEND" : (userEmail?.split("@")[0]?.toUpperCase() ?? "FRIEND");

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      style={{ flex: 1, backgroundColor: C.bg }}
      contentContainerStyle={{ paddingBottom: insets.bottom + 100, paddingTop: 6 }}
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <View style={{ paddingHorizontal: HORIZ, paddingTop: 12, flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
          <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: C.surface, borderWidth: 1, borderColor: C.borderStrong, justifyContent: "center", alignItems: "center" }}>
            <Icon name="shield" size={18} color={C.mint} strokeWidth={1.8} />
          </View>
          <View>
            <Text style={{ fontFamily: FONT.display, fontSize: 22, lineHeight: 22, color: C.text, letterSpacing: -0.5 }}>Minty</Text>
            <Text style={{ fontFamily: FONT.mono, fontSize: 10, color: C.textTertiary, marginTop: 2, letterSpacing: 0.5 }}>{greeting}, {displayName}</Text>
          </View>
        </View>
        <Pressable onPress={() => router.push("/streak" as any)} style={({ pressed }) => ({
          flexDirection: "row", alignItems: "center", gap: 6,
          paddingVertical: 6, paddingHorizontal: 10, borderRadius: 100,
          backgroundColor: C.surface, borderWidth: 1, borderColor: C.mintFaint,
          opacity: pressed ? 0.7 : 1,
        })}>
          <Text style={{ fontSize: 14 }}>🔥</Text>
          <Text style={{ fontFamily: FONT.monoBold, fontSize: 13, color: C.mint }}>{Math.min(recents.length, 14)}</Text>
          <Text style={{ fontFamily: FONT.mono, fontSize: 10, color: C.textSecondary, letterSpacing: 0.5 }}>DAY</Text>
        </Pressable>
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
                <CardArt kind="drake" width={120} height={168} />
                <HoloFoil intensity={0.5} />
              </View>
            </View>
            <View style={{ position: "absolute", right: 60, top: 30, transform: [{ rotate: "-6deg" }], opacity: 0.7 }}>
              <View style={{ borderRadius: 10, overflow: "hidden", ...({ boxShadow: SHADOW.card } as any) }}>
                <CardArt kind="champion" width={110} height={154} />
              </View>
            </View>

            <View style={{ maxWidth: 200 }}>
              <View style={{ flexDirection: "row", alignSelf: "flex-start", alignItems: "center", gap: 5, paddingVertical: 3, paddingHorizontal: 8, borderRadius: 100, backgroundColor: C.mint }}>
                <Text style={{ fontSize: 8, color: C.onMint }}>●</Text>
                <Text style={{ fontFamily: FONT.monoBold, fontSize: 9, color: C.onMint, letterSpacing: 1 }}>READY</Text>
              </View>
              <Text style={{ fontFamily: FONT.display, fontSize: 36, color: C.text, lineHeight: 38, letterSpacing: -1.5, marginTop: 12 }}>
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
                <Text style={{ fontFamily: FONT.uiBold, fontSize: 14, color: C.onMint }}>Scan a card</Text>
              </Pressable>
            </View>
          </LinearGradient>
        </View>
      </View>

      {/* Daily challenge */}
      <View style={{ paddingHorizontal: HORIZ, paddingTop: 14 }}>
        <Pressable onPress={() => router.push("/streak" as any)} style={({ pressed }) => ({
          backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, borderRadius: 16, padding: 14,
          flexDirection: "row", alignItems: "center", gap: 12,
          opacity: pressed ? 0.85 : 1,
        })}>
          <View style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: C.goldFaint, borderWidth: 1, borderColor: `${C.gold}40`, justifyContent: "center", alignItems: "center" }}>
            <Text style={{ fontSize: 22 }}>🎯</Text>
          </View>
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <Text style={{ fontSize: 13, fontFamily: FONT.uiBold, color: C.text }}>Daily Challenge</Text>
              <Text style={{ fontFamily: FONT.mono, fontSize: 10, color: C.gold, letterSpacing: 0.5 }}>+50 XP</Text>
            </View>
            <Text style={{ fontSize: 11, color: C.textSecondary, marginTop: 2 }}>Scan 3 cards today · {Math.min(scansCount, 3)}/3 done</Text>
            <View style={{ marginTop: 6, height: 4, backgroundColor: C.bgRaised, borderRadius: 2, overflow: "hidden" }}>
              <LinearGradient
                colors={[C.gold, C.mint]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={{ width: `${Math.min(scansCount / 3, 1) * 100}%`, height: "100%", borderRadius: 2 }}
              />
            </View>
          </View>
        </Pressable>
      </View>

      {/* Stats */}
      <View style={{ paddingHorizontal: HORIZ, paddingTop: 14, flexDirection: "row", gap: 8 }}>
        {[
          { v: String(scansCount), l: "SCANS", c: C.text },
          { v: pickImageOrPlaceholderUI(recents) ? `$${(scansCount * 65).toLocaleString()}` : "$0", l: "VAULT", c: C.mint },
          { v: String(gemsCount), l: "GEMS", c: C.gold },
        ].map((s) => (
          <View key={s.l} style={{ flex: 1, backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, borderRadius: 12, paddingVertical: 10, paddingHorizontal: 12 }}>
            <Text style={{ fontFamily: FONT.display, fontSize: 24, color: s.c, lineHeight: 24, letterSpacing: -0.5 }}>{s.v}</Text>
            <Text style={{ fontFamily: FONT.mono, fontSize: 9, color: C.textTertiary, marginTop: 4, letterSpacing: 1, fontWeight: "600" }}>{s.l}</Text>
          </View>
        ))}
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
          <Text style={{ fontSize: 14, color: C.text, fontFamily: FONT.uiBold, textAlign: "center" }}>Your first scan awaits</Text>
          <Text style={{ fontSize: 12, color: C.textSecondary, textAlign: "center", maxWidth: 260, lineHeight: 18 }}>
            Tap &ldquo;Scan a card&rdquo; above to get an AI grade in seconds.
          </Text>
          <Pressable onPress={pickImage}>
            <Text style={{ fontSize: 12, color: C.mint, fontFamily: FONT.uiBold, marginTop: 4 }}>Or pick from library →</Text>
          </Pressable>
        </View>
      )}
    </ScrollView>
  );
}

function pickImageOrPlaceholderUI(_recents: GradedCard[]): boolean {
  return _recents.length > 0;
}

function greetingFor(now: Date): string {
  const h = now.getHours();
  if (h < 12) return "GOOD MORNING";
  if (h < 18) return "GOOD AFTERNOON";
  return "GOOD EVENING";
}
