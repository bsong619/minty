import { useEffect, useRef, useState } from "react";
import { View, Text, Pressable, Alert } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import * as Sharing from "expo-sharing";
import { captureRef } from "react-native-view-shot";
import { useAuth } from "@/components/auth-provider";
import { getScannedCardById } from "@/lib/card-service";
import { getCards } from "@/lib/storage";
import { GradedCard } from "@/lib/types";
import { CardArt, artKindFor } from "@/components/card-art";
import { HoloFoil } from "@/components/holo-foil";
import { Icon } from "@/components/icon";
import { C, FONT, SHADOW } from "@/lib/theme";

export default function ShareScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { cardId } = useLocalSearchParams<{ cardId: string }>();
  const { userId } = useAuth();
  const [card, setCard] = useState<GradedCard | null>(null);
  const [busy, setBusy] = useState(false);
  const previewRef = useRef<View>(null);

  useEffect(() => {
    (async () => {
      try {
        if (userId) setCard(await getScannedCardById(cardId));
        else setCard((await getCards()).find((c) => c.id === cardId) ?? null);
      } catch {}
    })();
  }, [cardId, userId]);

  const handleShare = async () => {
    if (!previewRef.current || busy) return;
    setBusy(true);
    try {
      const uri = await captureRef(previewRef.current, { format: "png", quality: 1 });
      const ok = await Sharing.isAvailableAsync();
      if (!ok) {
        Alert.alert("Sharing unavailable", "This device doesn't support sharing.");
        return;
      }
      await Sharing.shareAsync(uri, { dialogTitle: "Share your hit" });
    } catch (e: any) {
      Alert.alert("Couldn't share", e?.message ?? "Please try again.");
    } finally {
      setBusy(false);
    }
  };

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
  const tierLabel = isGem ? "★ GEM MINT" : grade >= 9 ? "★ MINT" : "★ MINT-";

  return (
    <View style={{ flex: 1, backgroundColor: C.bg, paddingTop: insets.top }}>
      {/* Top bar */}
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 16 }}>
        <Pressable onPress={() => router.back()} hitSlop={8}>
          <Icon name="back" size={20} color={C.text} />
        </Pressable>
        <Text style={{ fontFamily: FONT.uiBold, fontSize: 14, color: C.text }}>Share your hit</Text>
        <View style={{ width: 20 }} />
      </View>

      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 20, gap: 18 }}>
        {/* Shareable preview card — captured by view-shot */}
        <View
          ref={previewRef}
          collapsable={false}
          style={{
            width: 280, height: 498, borderRadius: 24, overflow: "hidden", position: "relative",
            borderWidth: 1, borderColor: C.borderStrong,
            ...({ boxShadow: SHADOW.hero } as any),
          }}
        >
          <LinearGradient
            colors={[`${C.mint}40`, `${C.gold}28`, C.bgDeep]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            locations={[0, 0.6, 1]}
            style={{ flex: 1 }}
          >
            {/* Watermark */}
            <View style={{ position: "absolute", top: 16, left: 16, flexDirection: "row", alignItems: "center", gap: 6 }}>
              <View style={{ width: 22, height: 22, borderRadius: 6, backgroundColor: C.surface, justifyContent: "center", alignItems: "center" }}>
                <Icon name="shield" size={12} color={C.mint} strokeWidth={2} />
              </View>
              <Text style={{ fontFamily: FONT.display, fontSize: 14, color: C.text }}>Minty</Text>
            </View>

            {/* Card */}
            <View style={{ position: "absolute", top: 60, left: "50%", marginLeft: -85, borderRadius: 12, overflow: "hidden", ...({ boxShadow: `0px 0px 40px ${accent}80, 0px 20px 50px rgba(0,0,0,0.7)` } as any) }}>
              {card.imageUri ? (
                <Image source={{ uri: card.imageUri }} style={{ width: 170, height: 238, borderRadius: 12 }} contentFit="cover" />
              ) : (
                <CardArt kind={artKindFor(card.result.cardName)} width={170} height={238} />
              )}
              <HoloFoil intensity={0.6} />
            </View>

            {/* Grade chip */}
            <View style={{ position: "absolute", bottom: 110, left: 0, right: 0, alignItems: "center" }}>
              <View style={{ paddingVertical: 3, paddingHorizontal: 10, borderRadius: 100, backgroundColor: accent }}>
                <Text style={{ fontFamily: FONT.monoBold, fontSize: 9, color: C.onMint, letterSpacing: 1.5 }}>{tierLabel}</Text>
              </View>
              <Text style={{ fontFamily: FONT.display, fontSize: 60, color: accent, lineHeight: 60, letterSpacing: -2, marginTop: 6 }}>
                {Number.isInteger(grade) ? grade : grade.toString()}
              </Text>
            </View>

            {/* Bottom info */}
            <View style={{ position: "absolute", bottom: 18, left: 18, right: 18, alignItems: "center" }}>
              <Text numberOfLines={1} style={{ fontSize: 13, fontFamily: FONT.uiBold, color: C.text }}>{card.result.cardName}</Text>
              <Text style={{ fontFamily: FONT.mono, fontSize: 9, color: C.textSecondary, letterSpacing: 0.5, marginTop: 3 }}>graded with minty.app</Text>
            </View>
          </LinearGradient>
        </View>

        {/* Share button */}
        <Pressable
          onPress={handleShare}
          disabled={busy}
          style={({ pressed }) => ({
            marginTop: 4, flexDirection: "row", alignItems: "center", gap: 8,
            paddingVertical: 14, paddingHorizontal: 28, borderRadius: 100,
            backgroundColor: C.mint, opacity: pressed || busy ? 0.85 : 1,
            ...({ boxShadow: SHADOW.glow } as any),
          })}
        >
          <Icon name="share" size={16} color={C.onMint} strokeWidth={2.5} />
          <Text style={{ fontFamily: FONT.uiBold, fontSize: 14, color: C.onMint }}>{busy ? "Preparing…" : "Share"}</Text>
        </Pressable>
        <Text style={{ fontSize: 11, color: C.textTertiary, textAlign: "center" }}>Save to camera roll, send to Stories, or share via any app</Text>
      </View>
    </View>
  );
}
