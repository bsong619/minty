import { useEffect, useState } from "react";
import { View, Text, ScrollView, Pressable, Linking } from "react-native";
import * as Haptics from "expo-haptics";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Image } from "expo-image";
import { getGradeColor } from "@/lib/grade-colors";
import { getCards, toggleFavorite as localToggleFavorite } from "@/lib/storage";
import { getScannedCardById, toggleFavorite as sbToggleFavorite } from "@/lib/card-service";
import { useAuth } from "@/components/auth-provider";
import { GradedCard } from "@/lib/types";
import { CardArt, artKindFor } from "@/components/card-art";
import { HoloFoil } from "@/components/holo-foil";
import { Icon } from "@/components/icon";
import { C, FONT, SHADOW } from "@/lib/theme";
import { consumePendingResultImages } from "@/lib/pending-result";
import { fetchComps, formatCompPrice, CompsResult } from "@/lib/comps-service";

const TIER_LABEL: Record<string, string> = {
  "Lock 10": "Gem Mint",
  "Strong 10 candidate": "Mint+",
  "Coin-flip 9/10": "Mint",
  "Likely 9": "Near Mint",
  "Below 9": "Below 9",
};

export default function ResultsScreen() {
  const { cardId } = useLocalSearchParams<{ cardId: string }>();
  const router = useRouter();
  const { userId } = useAuth();
  const [card, setCard] = useState<GradedCard | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [{ imageUri: localImageUri }] = useState(() => consumePendingResultImages());
  const [comps, setComps] = useState<CompsResult | null>(null);
  const [compsLoading, setCompsLoading] = useState(false);

  useEffect(() => {
    setLoadError(false);
    const isFreshScan = !!localImageUri;
    const onLoaded = (c: GradedCard | null) => {
      if (c) {
        setCard(c);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        // Trigger pack reveal for Gem-tier hits — only on fresh scans, not when
        // re-opening a saved Gem from the vault.
        if (isFreshScan && c.result.overallGrade >= 9.5) {
          router.push({ pathname: "/reveal", params: { cardId: c.id } } as any);
        }
      } else {
        setLoadError(true);
      }
    };
    if (userId) {
      getScannedCardById(cardId).then(onLoaded).catch(() => setLoadError(true));
    } else {
      getCards().then((cards) => onLoaded(cards.find((c) => c.id === cardId) ?? null)).catch(() => setLoadError(true));
    }
  }, [cardId, userId, router]);

  useEffect(() => {
    if (!card) return;
    // Skip comp lookup for low grades — the eBay slab market for PSA 1–6
    // is thin enough that the median is noise, not signal.
    if (card.result.overallGrade < 7) return;
    let cancelled = false;
    setCompsLoading(true);
    fetchComps({
      cardName: card.result.cardName,
      cardSet: card.result.cardSet,
      cardYear: card.result.cardYear,
      cardNumber: card.result.cardNumber,
      grade: Math.floor(card.result.overallGrade),
    })
      .then((c) => { if (!cancelled) setComps(c); })
      .catch(() => { /* silently hide block */ })
      .finally(() => { if (!cancelled) setCompsLoading(false); });
    return () => { cancelled = true; };
  }, [card]);

  if (loadError) {
    return (
      <View style={{ flex: 1, backgroundColor: C.bg, justifyContent: "center", alignItems: "center", padding: 32, gap: 16 }}>
        <Icon name="info" size={32} color={C.danger} />
        <Text style={{ fontSize: 17, fontFamily: FONT.uiBold, color: C.text, textAlign: "center" }}>Couldn&apos;t load results</Text>
        <Text style={{ fontSize: 14, color: C.textSecondary, textAlign: "center" }}>The scan completed but we couldn&apos;t retrieve the data. Try scanning again.</Text>
        <Pressable onPress={() => router.back()} style={{ marginTop: 8, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12, backgroundColor: C.mint }}>
          <Text style={{ color: C.onMint, fontFamily: FONT.uiBold }}>Go Back</Text>
        </Pressable>
      </View>
    );
  }

  if (!card) {
    return (
      <View style={{ flex: 1, backgroundColor: C.bg, justifyContent: "center", alignItems: "center" }}>
        <Text style={{ color: C.textSecondary }}>Loading results…</Text>
      </View>
    );
  }

  const { result } = card;
  const grade = result.overallGrade;
  const gradeColor = getGradeColor(grade);
  const tierName = TIER_LABEL[result.bucket] ?? "Mint";
  const heroUri = localImageUri || card.imageUri || undefined;
  const reportNum = card.id.slice(0, 5).toUpperCase();
  const confPct = result.psa10Likelihood != null
    ? Math.round(result.psa10Likelihood * 100)
    : result.confidence === "High" ? 90 : result.confidence === "Medium" ? 65 : 40;

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      style={{ flex: 1, backgroundColor: C.bg }}
      contentContainerStyle={{ paddingBottom: 40 }}
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 20, paddingBottom: 0 }}>
        <Pressable onPress={() => router.back()}><Icon name="back" size={20} color={C.text} /></Pressable>
        <Pressable onPress={() => router.push({ pathname: "/share", params: { cardId: card.id } } as any)}>
          <Icon name="share" size={20} color={C.text} />
        </Pressable>
      </View>

      {/* Card + grade */}
      <View style={{ paddingHorizontal: 20, paddingTop: 16, flexDirection: "row", gap: 14, alignItems: "flex-start" }}>
        <View style={{ borderRadius: 12, overflow: "hidden", ...({ boxShadow: SHADOW.hero } as any), position: "relative" }}>
          {heroUri ? (
            <Image source={{ uri: heroUri }} style={{ width: 130, height: 182, borderRadius: 12 }} contentFit="cover" />
          ) : (
            <CardArt kind={artKindFor(result.cardName)} width={130} height={182} />
          )}
          {grade >= 9.5 && <HoloFoil intensity={0.4} />}
        </View>
        <View style={{ flex: 1, paddingTop: 4 }}>
          <Text style={{ fontFamily: FONT.mono, fontSize: 9, color: C.textTertiary, letterSpacing: 1.5 }}>FINAL GRADE</Text>
          <View style={{ flexDirection: "row", alignItems: "baseline", gap: 4, marginTop: 4 }}>
            <Text style={{ fontFamily: FONT.display, fontSize: 80, color: gradeColor, lineHeight: 100, paddingHorizontal: 4 }}>
              {Number.isInteger(grade) ? grade : Math.floor(grade)}
            </Text>
            {!Number.isInteger(grade) && (
              <Text style={{ fontFamily: FONT.display, fontSize: 24, color: gradeColor, lineHeight: 30 }}>.5</Text>
            )}
            {Number.isInteger(grade) && (
              <Text style={{ fontFamily: FONT.display, fontSize: 24, color: gradeColor, lineHeight: 30 }}>.0</Text>
            )}
          </View>
          <Text style={{ fontFamily: FONT.displayItalic, fontSize: 18, color: C.text, marginTop: 2, paddingHorizontal: 2 }}>{tierName}</Text>
        </View>
      </View>

      {/* Card meta */}
      <View style={{ paddingHorizontal: 20, paddingTop: 16 }}>
        <Text selectable style={{ fontSize: 17, fontFamily: FONT.uiBold, color: C.text }}>{result.cardName}</Text>
        <Text selectable style={{ fontSize: 12, color: C.textSecondary, marginTop: 2 }}>
          {[result.cardSet, result.cardYear, result.cardNumber ? `#${result.cardNumber}` : null].filter(Boolean).join(" · ")}
        </Text>
      </View>

      {/* Sub-grades */}
      <View style={{ paddingHorizontal: 20, paddingTop: 16 }}>
        <Text style={{ fontFamily: FONT.monoBold, fontSize: 10, color: C.textTertiary, letterSpacing: 1.5, marginBottom: 10 }}>SUB-GRADES</Text>
        <View style={{ backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, borderRadius: 14, paddingHorizontal: 14 }}>
          {([
            ["Centering", result.subGrades.centering],
            ["Corners",   result.subGrades.corners],
            ["Edges",     result.subGrades.edges],
            ["Surface",   result.subGrades.surface],
          ] as const).map(([label, val], i, arr) => {
            const c = getGradeColor(val);
            return (
              <View key={label} style={{
                flexDirection: "row", alignItems: "center", gap: 12,
                paddingTop: i === 0 ? 14 : 12, paddingBottom: i === arr.length - 1 ? 14 : 12,
                borderBottomWidth: i === arr.length - 1 ? 0 : 1, borderBottomColor: C.borderSubtle,
              }}>
                <View style={{ width: 80 }}>
                  <Text style={{ fontSize: 13, fontFamily: FONT.uiBold, color: C.text }}>{label}</Text>
                </View>
                <View style={{ flex: 1, height: 5, backgroundColor: C.bgRaised, borderRadius: 3, overflow: "hidden" }}>
                  <View style={{ width: `${val * 10}%`, height: "100%", backgroundColor: c, borderRadius: 3, ...({ boxShadow: `0px 0px 8px ${c}80` } as any) }} />
                </View>
                <Text style={{ fontFamily: FONT.display, fontSize: 22, color: c, width: 48, textAlign: "right", lineHeight: 28, paddingRight: 4 }}>{val}</Text>
              </View>
            );
          })}
        </View>
      </View>

      {/* Active listings — eBay Browse API. Asking prices, not sold comps. */}
      {(compsLoading || (comps && comps.count > 0)) && (
        <View style={{ paddingHorizontal: 20, paddingTop: 16 }}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
            <Text style={{ fontFamily: FONT.monoBold, fontSize: 10, color: C.textTertiary, letterSpacing: 1.5 }}>
              ACTIVE LISTINGS · GRADE {Math.floor(grade)}
            </Text>
            {comps && comps.count > 0 && (
              <Text style={{ fontFamily: FONT.mono, fontSize: 9, color: C.textTertiary, letterSpacing: 0.5 }}>
                {comps.count} on eBay
              </Text>
            )}
          </View>

          <View style={{ backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, borderRadius: 14, padding: 14 }}>
            {compsLoading && !comps ? (
              <Text style={{ fontSize: 13, color: C.textTertiary }}>Loading comps…</Text>
            ) : comps && comps.median != null ? (
              <>
                <View style={{ flexDirection: "row", alignItems: "baseline", gap: 8 }}>
                  <Text style={{ fontFamily: FONT.display, fontSize: 36, color: C.text, lineHeight: 44, letterSpacing: -1, paddingHorizontal: 2 }}>
                    {formatCompPrice(comps.median, comps.currency)}
                  </Text>
                  <Text style={{ fontSize: 11, color: C.textSecondary, fontFamily: FONT.mono }}>median ask</Text>
                </View>
                {comps.low != null && comps.high != null && comps.low !== comps.high && (
                  <Text style={{ fontSize: 12, color: C.textSecondary, marginTop: 2, fontFamily: FONT.mono }}>
                    {formatCompPrice(comps.low, comps.currency)} – {formatCompPrice(comps.high, comps.currency)}
                  </Text>
                )}

                {comps.samples.length > 0 && (
                  <View style={{ marginTop: 14, gap: 8 }}>
                    {comps.samples.slice(0, 3).map((s, i) => (
                      <Pressable
                        key={i}
                        onPress={() => s.url && Linking.openURL(s.url)}
                        style={({ pressed }) => ({
                          flexDirection: "row", alignItems: "center", gap: 10,
                          paddingVertical: 8, paddingHorizontal: 10, borderRadius: 10,
                          backgroundColor: pressed ? C.surfaceHover : C.bgRaised,
                          borderWidth: 1, borderColor: C.borderSubtle,
                        })}
                      >
                        {s.thumbnail ? (
                          <Image source={{ uri: s.thumbnail }} style={{ width: 36, height: 50, borderRadius: 4 }} contentFit="cover" />
                        ) : (
                          <View style={{ width: 36, height: 50, borderRadius: 4, backgroundColor: C.surfaceLow }} />
                        )}
                        <View style={{ flex: 1 }}>
                          <Text numberOfLines={2} style={{ fontSize: 11, color: C.textSecondary, lineHeight: 14 }}>{s.title}</Text>
                        </View>
                        <Text style={{ fontFamily: FONT.monoBold, fontSize: 13, color: C.text }}>
                          {formatCompPrice(s.price, s.currency)}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                )}

                <Text style={{ fontSize: 10, color: C.textTertiary, marginTop: 12, lineHeight: 14 }}>
                  Asking prices from active eBay listings — not sold comps. Real sale prices vary.
                </Text>
              </>
            ) : null}
          </View>
        </View>
      )}

      {/* Tips */}
      {result.tips.length > 0 && (
        <View style={{ paddingHorizontal: 20, paddingTop: 16 }}>
          <Text style={{ fontFamily: FONT.monoBold, fontSize: 10, color: C.textTertiary, letterSpacing: 1.5, marginBottom: 10 }}>WHAT&apos;S KEEPING IT FROM A 10</Text>
          <View style={{ backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, borderRadius: 14, padding: 14, gap: 12 }}>
            {result.tips.map((tip, i) => (
              <View key={i} style={{ flexDirection: "row", gap: 10, alignItems: "flex-start" }}>
                <View style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: C.goldFaint, justifyContent: "center", alignItems: "center", marginTop: 1 }}>
                  <Text style={{ fontSize: 11, fontFamily: FONT.monoBold, color: C.gold }}>{i + 1}</Text>
                </View>
                <Text selectable style={{ fontSize: 13, color: C.textSecondary, lineHeight: 19, flex: 1 }}>{tip}</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* Actions — Share/social removed for v1.0 (not wired up yet) */}
      <View style={{ paddingHorizontal: 20, paddingTop: 16 }}>
        <Pressable
          onPress={async () => {
            const newVal = !card.favorite;
            try {
              if (userId) await sbToggleFavorite(card.id, newVal);
              else await localToggleFavorite(card.id);
              setCard({ ...card, favorite: newVal });
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            } catch {}
          }}
          style={({ pressed }) => ({
            paddingVertical: 14, borderRadius: 12,
            backgroundColor: card.favorite ? C.mint : C.surface,
            borderWidth: 1, borderColor: card.favorite ? C.mint : C.border,
            flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
            opacity: pressed ? 0.85 : 1,
          })}
        >
          <Icon name="heart" size={16} color={card.favorite ? C.onMint : C.text} fill={card.favorite ? C.onMint : "none"} strokeWidth={2.2} />
          <Text style={{ fontFamily: FONT.uiBold, fontSize: 14, color: card.favorite ? C.onMint : C.text, paddingRight: 2 }}>
            {card.favorite ? "Saved to favorites" : "Add to favorites"}
          </Text>
        </Pressable>
      </View>

      <Text selectable style={{ fontSize: 11, color: C.textTertiary, textAlign: "center", lineHeight: 16, paddingHorizontal: 24, paddingTop: 16 }}>
        AI estimate only — not an official grade. Results may differ from professional grading services. Don&apos;t rely on this for purchase or sale decisions.
      </Text>
    </ScrollView>
  );
}

function summaryFor(detail: any): string | null {
  if (!detail) return null;
  if (detail.notes) return detail.notes;
  // Surface a salient location if present
  const v = Object.values(detail).find((x) => typeof x === "string" && x);
  return (v as string) || null;
}
