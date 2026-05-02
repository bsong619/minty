import { useEffect, useState } from "react";
import { View, Text, Pressable, Dimensions, StyleSheet } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Image } from "expo-image";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import Animated, {
  useSharedValue, useAnimatedStyle, withTiming, withSpring, withRepeat, withSequence, withDelay, Easing,
} from "react-native-reanimated";
import { useAuth } from "@/components/auth-provider";
import { getScannedCardById } from "@/lib/card-service";
import { getCards } from "@/lib/storage";
import { GradedCard } from "@/lib/types";
import { CardArt, artKindFor } from "@/components/card-art";
import { HoloFoil } from "@/components/holo-foil";
import { Icon } from "@/components/icon";
import { C, FONT, SHADOW } from "@/lib/theme";

const { width: SCREEN_W } = Dimensions.get("window");

export default function PackRevealScreen() {
  const router = useRouter();
  const { cardId } = useLocalSearchParams<{ cardId: string }>();
  const { userId } = useAuth();
  const [card, setCard] = useState<GradedCard | null>(null);

  // Card scale-in animation
  const scale = useSharedValue(0.6);
  const opacity = useSharedValue(0);
  const textOpacity = useSharedValue(0);
  const textY = useSharedValue(20);

  useEffect(() => {
    (async () => {
      try {
        const c = userId
          ? await getScannedCardById(cardId)
          : (await getCards()).find((x) => x.id === cardId) ?? null;
        if (c) setCard(c);
      } catch {}
    })();
  }, [cardId, userId]);

  useEffect(() => {
    if (!card) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    opacity.value = withTiming(1, { duration: 250 });
    scale.value = withSpring(1, { damping: 12, stiffness: 90 });
    textOpacity.value = withDelay(300, withTiming(1, { duration: 350 }));
    textY.value = withDelay(300, withSpring(0, { damping: 14 }));
    // Subtle float loop
    scale.value = withDelay(700, withRepeat(
      withSequence(
        withTiming(1.02, { duration: 1800, easing: Easing.inOut(Easing.ease) }),
        withTiming(1.0, { duration: 1800, easing: Easing.inOut(Easing.ease) }),
      ),
      -1,
      false,
    ));
  }, [card]);

  const cardStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));
  const textStyle = useAnimatedStyle(() => ({
    opacity: textOpacity.value,
    transform: [{ translateY: textY.value }],
  }));

  if (!card) {
    return (
      <View style={{ flex: 1, backgroundColor: C.bg, justifyContent: "center", alignItems: "center" }}>
        <Text style={{ color: C.textSecondary }}>Loading…</Text>
      </View>
    );
  }

  const grade = card.result.overallGrade;
  const isGem = grade >= 9.5;
  const accent = isGem ? C.gold : C.mint;

  const continueToBreakdown = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.back();
  };

  return (
    <Pressable
      onPress={continueToBreakdown}
      style={{ flex: 1, backgroundColor: C.bg }}
    >
      {/* Radial-style background via stacked gradients */}
      <LinearGradient
        colors={[`${accent}28`, "transparent"]}
        start={{ x: 0.5, y: 0.3 }}
        end={{ x: 0.5, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      {/* Floating particles */}
      {Array.from({ length: 16 }).map((_, i) => {
        const seed = (i * 73) % 100;
        const left = (seed / 100) * SCREEN_W;
        const top = ((seed * 1.3) % 100) / 100 * 700;
        const isGold = i % 3 === 0;
        return (
          <View key={i} style={{
            position: "absolute", left, top,
            width: 3, height: 3, borderRadius: 1.5,
            backgroundColor: isGold ? C.gold : C.mint,
            opacity: 0.6,
            ...({ boxShadow: `0px 0px 8px ${isGold ? C.gold : C.mint}` } as any),
          }} />
        );
      })}

      {/* Top bar */}
      <View style={{ paddingTop: 60, paddingHorizontal: 20, flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
        <Pressable onPress={continueToBreakdown} style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: C.surface, justifyContent: "center", alignItems: "center" }}>
          <Icon name="close" size={16} color={C.text} />
        </Pressable>
        <Text style={{ fontFamily: FONT.mono, fontSize: 10, color: C.textTertiary, letterSpacing: 1.5 }}>TAP TO CONTINUE</Text>
        <View style={{ width: 36 }} />
      </View>

      {/* Center stage */}
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", paddingHorizontal: 24 }}>
        {/* Burst behind card */}
        <View style={{ position: "absolute", width: 380, height: 380, borderRadius: 190, backgroundColor: `${accent}10` }} />

        {/* Card */}
        <Animated.View style={[
          {
            borderRadius: 18, overflow: "hidden",
            ...({ boxShadow: `0px 0px 80px ${accent}99, 0px 0px 160px ${C.mint}66, 0px 30px 80px rgba(0,0,0,0.7)` } as any),
          },
          cardStyle,
        ]}>
          <View style={{ position: "relative" }}>
            {card.imageUri ? (
              <Image source={{ uri: card.imageUri }} style={{ width: 240, height: 336, borderRadius: 18 }} contentFit="cover" />
            ) : (
              <CardArt kind={artKindFor(card.result.cardName)} width={240} height={336} />
            )}
            <HoloFoil intensity={isGem ? 0.8 : 0.5} />
          </View>
        </Animated.View>

        {/* Celebration text */}
        <Animated.View style={[{ marginTop: 28, alignItems: "center" }, textStyle]}>
          <View style={{ paddingVertical: 4, paddingHorizontal: 12, borderRadius: 100, backgroundColor: accent }}>
            <Text style={{ fontFamily: FONT.monoBold, fontSize: 11, color: C.onMint, letterSpacing: 1.5 }}>
              {isGem ? "★ GEM HIT" : "★ MINT HIT"}
            </Text>
          </View>
          <Text style={{ fontFamily: FONT.display, fontSize: 28, color: C.text, marginTop: 12, letterSpacing: -0.5 }}>
            You pulled a <Text style={{ color: accent }}>{Number.isInteger(grade) ? grade : grade.toString()}</Text>
          </Text>
          <Text style={{ fontSize: 13, color: C.textSecondary, marginTop: 6 }}>
            {card.result.bucket === "Lock 10" ? "Top 3% of all submissions" :
             card.result.bucket === "Strong 10 candidate" ? "Top 8% of all submissions" :
             "Top 15% of all submissions"}
          </Text>
        </Animated.View>

        <Pressable
          onPress={continueToBreakdown}
          style={({ pressed }) => ({
            marginTop: 28, paddingVertical: 14, paddingHorizontal: 28, borderRadius: 100,
            backgroundColor: C.mint, flexDirection: "row", alignItems: "center", gap: 8,
            opacity: pressed ? 0.85 : 1,
            ...({ boxShadow: SHADOW.glow } as any),
          })}
        >
          <Text style={{ fontFamily: FONT.uiBold, fontSize: 14, color: C.onMint }}>See the breakdown</Text>
          <Icon name="arrowR" size={14} color={C.onMint} strokeWidth={2.5} />
        </Pressable>
      </View>
    </Pressable>
  );
}
