import { useEffect, useState } from "react";
import { View, Text, ScrollView, Pressable, Alert } from "react-native";
import * as Haptics from "expo-haptics";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Image } from "expo-image";  // still used for card image display
import GradeBadge from "@/components/grade-badge";
import SubGradeBar from "@/components/sub-grade-bar";
import { getGradeColor, getConfidenceColor } from "@/lib/grade-colors";
import { getCards, toggleFavorite as localToggleFavorite } from "@/lib/storage";
import { getScannedCardById, toggleFavorite as sbToggleFavorite } from "@/lib/card-service";
import { useAuth } from "@/components/auth-provider";
import { GradedCard } from "@/lib/types";
import { C, SHADOW } from "@/lib/theme";
import { consumePendingResultImages } from "@/lib/pending-result";

const GRADE_LABELS: Record<number, string> = { 10: "Gem Mint ✨", 9: "Mint", 8: "Near Mint-Mint", 7: "Near Mint", 6: "Excellent-Mint", 5: "Excellent", 4: "Very Good-Excellent", 3: "Very Good", 2: "Good", 1: "Poor" };

export default function ResultsScreen() {
  const { cardId } = useLocalSearchParams<{ cardId: string }>();
  const router = useRouter();
  const { userId } = useAuth();
  const [card, setCard] = useState<GradedCard | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [{ imageUri: localImageUri, tcgImageUrl: navTcgImageUrl }] = useState(() => consumePendingResultImages());

  useEffect(() => {
    setLoadError(false);
    if (userId) {
      getScannedCardById(cardId).then((c) => {
        if (c) { setCard(c); Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); }
        else setLoadError(true);
      }).catch(() => setLoadError(true));
    } else {
      getCards().then((cards) => {
        const found = cards.find((c) => c.id === cardId);
        if (found) { setCard(found); Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); }
        else setLoadError(true);
      }).catch(() => setLoadError(true));
    }
  }, [cardId, userId]);

  if (loadError) {
    return (
      <View style={{ flex: 1, backgroundColor: C.bg, justifyContent: "center", alignItems: "center", padding: 32, gap: 16 }}>
        <Text style={{ fontSize: 32 }}>⚠️</Text>
        <Text style={{ fontSize: 17, fontWeight: "700", color: C.text, textAlign: "center" }}>Couldn't load results</Text>
        <Text style={{ fontSize: 14, color: C.textSecondary, textAlign: "center" }}>The scan completed but we couldn't retrieve the data. Please try scanning again.</Text>
        <Pressable onPress={() => router.back()} style={{ marginTop: 8, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12, backgroundColor: C.red }}>
          <Text style={{ color: "white", fontWeight: "600" }}>Go Back</Text>
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
  const gradeColor = getGradeColor(result.overallGrade);
  const confidenceColor = getConfidenceColor(result.confidence);
  const gradeLabel = GRADE_LABELS[result.overallGrade] ?? "Unknown";

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      style={{ flex: 1, backgroundColor: C.bg }}
      contentContainerStyle={{ padding: 20, gap: 16, paddingBottom: 40 }}
    >
      {/* Card + Grade Hero */}
      <View style={{ alignItems: "center", gap: 16, paddingVertical: 8 }}>
        <View style={{ borderRadius: 16, borderCurve: "continuous", overflow: "hidden", boxShadow: SHADOW.hero }}>
          <Image source={{ uri: localImageUri || card.imageUri || undefined }} style={{ width: 200, height: 280, borderRadius: 16 }} contentFit="cover" />
        </View>
        <GradeBadge grade={result.overallGrade} size="large" />
        <View style={{ alignItems: "center", gap: 6 }}>
          <Text style={{ fontSize: 26, fontWeight: "800", color: gradeColor, letterSpacing: -0.5 }}>
            PSA {result.overallGrade} — {gradeLabel}
          </Text>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 14, paddingVertical: 6, borderRadius: 100, backgroundColor: `${confidenceColor}18`, borderWidth: 1, borderColor: `${confidenceColor}40` }}>
            <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: confidenceColor }} />
            <Text style={{ fontSize: 13, color: confidenceColor, fontWeight: "600" }}>{result.confidence} Confidence</Text>
          </View>
        </View>
      </View>

      {/* Card ID */}
      <View style={{ borderRadius: 20, borderCurve: "continuous", backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, padding: 18, gap: 6 }}>
        <Text style={{ fontSize: 11, fontWeight: "600", color: C.textTertiary, textTransform: "uppercase", letterSpacing: 0.8 }}>Card Identified</Text>
        <Text selectable style={{ fontSize: 20, fontWeight: "700", color: C.text, letterSpacing: -0.3 }}>{result.cardName}</Text>
        <Text selectable style={{ fontSize: 14, color: C.textSecondary }}>{result.cardSet} ({result.cardYear}) · #{result.cardNumber}</Text>
      </View>

      {/* Sub-grades */}
      <View style={{ borderRadius: 20, borderCurve: "continuous", backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, padding: 18, gap: 14 }}>
        <Text style={{ fontSize: 11, fontWeight: "600", color: C.textTertiary, textTransform: "uppercase", letterSpacing: 0.8 }}>Sub-Grade Breakdown</Text>
        <SubGradeBar
          label="Centering"
          score={result.subGrades.centering}
          detail={
            result.centeringDetail.backLeftRight
              ? `Front: ${result.centeringDetail.leftRight} LR · ${result.centeringDetail.topBottom} TB  ·  Back: ${result.centeringDetail.backLeftRight} LR`
              : `${result.centeringDetail.leftRight} LR · ${result.centeringDetail.topBottom} TB`
          }
        />
        <SubGradeBar label="Corners" score={result.subGrades.corners} />
        <SubGradeBar label="Edges" score={result.subGrades.edges} />
        <SubGradeBar label="Surface" score={result.subGrades.surface} />
      </View>

      {/* Tips */}
      {result.tips.length > 0 && (
        <View style={{ borderRadius: 20, borderCurve: "continuous", backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, padding: 18, gap: 12 }}>
          <Text style={{ fontSize: 11, fontWeight: "600", color: C.textTertiary, textTransform: "uppercase", letterSpacing: 0.8 }}>Grade-Up Tips</Text>
          {result.tips.map((tip, i) => (
            <View key={i} style={{ flexDirection: "row", gap: 10, alignItems: "flex-start" }}>
              <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: C.goldFaint, justifyContent: "center", alignItems: "center", marginTop: 1 }}>
                <Text style={{ fontSize: 11, fontWeight: "700", color: C.gold }}>{i + 1}</Text>
              </View>
              <Text selectable style={{ fontSize: 14, color: C.textSecondary, lineHeight: 20, flex: 1 }}>{tip}</Text>
            </View>
          ))}
        </View>
      )}

      {/* Actions */}
      <View style={{ flexDirection: "row", gap: 10 }}>
        <Pressable
          onPress={async () => {
            if (!card) return;
            const newVal = !card.favorite;
            try {
              if (userId) await sbToggleFavorite(card.id, newVal);
              else await localToggleFavorite(card.id);
              setCard({ ...card, favorite: newVal });
            } catch {
              // favorite toggle failed silently — don't update UI
            }
          }}
          style={({ pressed }) => ({
            flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
            padding: 15, borderRadius: 16, borderCurve: "continuous",
            backgroundColor: card.favorite ? "rgba(255,59,48,0.12)" : C.surface,
            borderWidth: 1, borderColor: card.favorite ? "rgba(255,59,48,0.4)" : C.border,
            opacity: pressed ? 0.8 : 1,
          })}
        >
          <Text style={{ fontSize: 18 }}>{card.favorite ? "❤️" : "🤍"}</Text>
          <Text style={{ fontSize: 15, fontWeight: "600", color: card.favorite ? "#FF3B30" : C.textSecondary }}>{card.favorite ? "Saved" : "Save"}</Text>
        </Pressable>
        <Pressable
          onPress={() => router.dismissTo("/(scan)")}
          style={({ pressed }) => ({
            flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
            padding: 15, borderRadius: 16, borderCurve: "continuous",
            backgroundColor: C.red, opacity: pressed ? 0.85 : 1,
            boxShadow: SHADOW.glow,
          })}
        >
          <Text style={{ fontSize: 18 }}>📸</Text>
          <Text style={{ fontSize: 15, fontWeight: "600", color: "white" }}>Scan Another</Text>
        </Pressable>
      </View>

      <Text selectable style={{ fontSize: 11, color: C.textTertiary, textAlign: "center", lineHeight: 16 }}>
        This is an estimate only. Actual PSA grades may differ due to human subjectivity.
      </Text>
    </ScrollView>
  );
}
